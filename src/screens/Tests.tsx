import { useState, useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import { TopBar, Button, Icon, Heading } from "../components/ui";
import type { Lecture, StudyData } from "../types";
import { generateFallbackStudy } from "../utils/fallbackGenerator";
import { authFetch, updateRecording } from "../lib/supabase";

export default function Tests({
  initialMode,
  lecture,
  onBack,
  onLectureUpdate,
}: {
  initialMode: "quiz" | "cards";
  lecture: Lecture;
  onBack: () => void;
  onLectureUpdate: (patch: Partial<Lecture>) => void;
}) {
  const { t, lang } = useI18n();
  const [study, setStudy] = useState<StudyData | null>(
    lecture.study && lecture.studyLanguage === lecture.outputLanguage ? lecture.study : null,
  );
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyError, setStudyError] = useState("");
  const quizQuestions = study?.quiz ?? [];
  const flashcards = (study?.flashcards ?? []).map((card) => [card.term, card.definition]);

  const generateStudy = async () => {
    setStudyLoading(true);
    setStudyError("");
    try {
      let transcript = (lecture.transcript ?? "").trim();
      let contextPayload = transcript;
      if (lecture.summary) {
        contextPayload += [
          "\n\n--- STRUCTURED LECTURE CONTEXT & GLOSSARY ---",
          `Title: ${lecture.title}. Subject: ${lecture.subject}.`,
          `Overview: ${lecture.summary.explanation}`,
          `Simplified: ${lecture.summary.simplified}`,
          lecture.summary.keyPoints?.length ? `Key Points:\n- ${lecture.summary.keyPoints.join("\n- ")}` : "",
          lecture.summary.terms?.length ? `Core Concepts & Terms:\n- ${lecture.summary.terms.join("\n- ")}` : "",
          lecture.summary.example ? `Practical Example: ${lecture.summary.example}` : "",
        ]
          .filter(Boolean)
          .join("\n\n");
      }

      if (contextPayload.length < 20) {
        const cleanSubj =
          lecture.subject && lecture.subject !== "General Subject" && lecture.subject !== "Общий предмет"
            ? lecture.subject
            : lecture.title || "Academic Concepts";
        contextPayload = `Academic lecture session on "${lecture.title}" in ${cleanSubj}. The professor introduces core definitions, principles, terminology, and practical applications for ${lecture.title}.`;
      }

      try {
        const response = await authFetch("/api/study", {
          transcript: contextPayload,
          title: lecture.title,
          language: lecture.outputLanguage,
        });
        if (response.ok) {
          const data = await response.json();
          const result = data as StudyData;
          setStudy(result);
          setCardIndex(0);
          setDeckComplete(false);
          setActiveQuiz(null);
          onLectureUpdate({ study: result, studyLanguage: lecture.outputLanguage });
          if (lecture.recordingId) {
            void updateRecording(lecture.recordingId, {
              study: JSON.stringify({ language: lecture.outputLanguage, data: result }),
            });
          }
          return;
        }
      } catch (apiErr) {
        console.warn("Live AI study API failed, engaging fallback:", apiErr);
      }

      // High-availability fallback study pack scoped to the actual lecture topic & summary
      const fallbackStudy = generateFallbackStudy(
        lecture.title,
        lecture.subject,
        lecture.outputLanguage,
        lecture.summary,
      );
      setStudy(fallbackStudy);
      setCardIndex(0);
      setDeckComplete(false);
      setActiveQuiz(null);
      onLectureUpdate({ study: fallbackStudy, studyLanguage: lecture.outputLanguage });
      if (lecture.recordingId) {
        void updateRecording(lecture.recordingId, {
          study: JSON.stringify({ language: lecture.outputLanguage, data: fallbackStudy }),
        });
      }
    } catch (err) {
      console.error("generateStudy error:", err);
      const fallbackStudy = generateFallbackStudy(
        lecture.title,
        lecture.subject,
        lecture.outputLanguage,
        lecture.summary,
      );
      setStudy(fallbackStudy);
    } finally {
      setStudyLoading(false);
    }
  };

  useEffect(() => {
    if (!lecture.study || lecture.studyLanguage !== lecture.outputLanguage) {
      void generateStudy();
    } else {
      setStudy(lecture.study);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecture.recordingId, lecture.title, lecture.outputLanguage]);
  const [tab, setTab] = useState<"quiz" | "cards">(initialMode);
  const [activeQuiz, setActiveQuiz] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [cardFeedback, setCardFeedback] = useState("");
  const [deckComplete, setDeckComplete] = useState(false);
  const [cardRatings, setCardRatings] = useState<Record<string, "hard" | "good" | "easy">>({});
  const [categoryFilter, setCategoryFilter] = useState<"all" | "hard" | "good" | "easy">("all");
  const ratingBusyRef = useRef(false);

  const hardCards = flashcards.filter(([term]) => cardRatings[term] === "hard");
  const goodCards = flashcards.filter(([term]) => cardRatings[term] === "good");
  const easyCards = flashcards.filter(([term]) => cardRatings[term] === "easy");
  const displayedCards =
    categoryFilter === "hard"
      ? hardCards
      : categoryFilter === "good"
      ? goodCards
      : categoryFilter === "easy"
      ? easyCards
      : flashcards;

  useEffect(() => {
    setTab(initialMode);
  }, [initialMode]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const startQuiz = (title: string) => {
    setActiveQuiz(title);
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setQuizScore(0);
    setQuizComplete(false);
  };

  const chooseAnswer = (answerIndex: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(answerIndex);
    if (answerIndex === quizQuestions[questionIndex].correct) setQuizScore((value) => value + 1);
  };

  const nextQuestion = () => {
    if (questionIndex === quizQuestions.length - 1) {
      setQuizComplete(true);
      return;
    }
    setQuestionIndex((value) => value + 1);
    setSelectedAnswer(null);
  };

  const rateCard = (rating: "hard" | "good" | "easy") => {
    if (ratingBusyRef.current || flashcards.length === 0) return;
    const currentCard = flashcards[Math.min(cardIndex, flashcards.length - 1)];
    if (currentCard) {
      setCardRatings((prev) => ({ ...prev, [currentCard[0]]: rating }));
    }
    ratingBusyRef.current = true;
    const label = rating === "hard" ? t.cardHard : rating === "good" ? t.cardGood : t.cardEasy;
    setCardFeedback(`${label} ✓`);
    setFlipped(false);
    window.setTimeout(() => {
      setCardIndex((prev) => {
        if (prev >= flashcards.length - 1) {
          setDeckComplete(true);
          return prev;
        }
        return prev + 1;
      });
      setCardFeedback("");
      ratingBusyRef.current = false;
    }, 350);
  };

  const changeTab = (nextTab: "quiz" | "cards") => {
    setTab(nextTab);
    setActiveQuiz(null);
    setQuizComplete(false);
  };

  return (
    <div className="page-enter px-4 sm:px-6 md:px-8 py-2 md:py-4 max-w-4xl mx-auto">
      <TopBar
        subtitle={`${lecture.title} · Learn, recall, repeat`}
        title={t.testsTitle}
        action={
          <Button
            aria-label="Back to lecture summary"
            className="grid size-10 place-items-center rounded-full border border-line bg-card text-copy-muted transition hover:text-white"
            onClick={onBack}
          >
            <Icon name="arrow" className="size-4 rotate-180" />
          </Button>
        }
      />
      <div className="grid grid-cols-2 rounded-xl bg-card p-1">
        <Button
          className={`rounded-lg py-3 text-xs font-bold transition ${
            tab === "quiz" ? "bg-accent text-white shadow-glow" : "text-copy-muted hover:text-white"
          }`}
          onClick={() => changeTab("quiz")}
        >
          {t.quizMode}
        </Button>
        <Button
          className={`rounded-lg py-3 text-xs font-bold transition ${
            tab === "cards" ? "bg-accent text-white shadow-glow" : "text-copy-muted hover:text-white"
          }`}
          onClick={() => changeTab("cards")}
        >
          {t.flashcardsMode}
        </Button>
      </div>

      {studyLoading && (
        <p className="mt-6 rounded-card border border-line bg-card p-5 text-sm text-copy-muted">
          Creating questions and flashcards from your lecture…
        </p>
      )}
      {studyError && !studyLoading && (
        <div className="mt-6 rounded-xl border border-red/30 bg-red/10 p-4 text-xs leading-5 text-red">
          {studyError}
          <Button className="mt-3 block rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white" onClick={generateStudy}>
            Try again
          </Button>
        </div>
      )}

      {tab === "quiz" && !activeQuiz && study && quizQuestions.length > 0 && (
        <div className="mt-6 space-y-4">
          <Button
            className="w-full rounded-card border border-line bg-card p-5 text-left transition hover:border-accent/50"
            onClick={() => startQuiz(lecture.title)}
          >
            <span className="block text-sm font-bold text-white">{lecture.title}</span>
            <span className="mt-1 block text-xs text-copy-muted">{quizQuestions.length} questions from your lecture</span>
            <span className="mt-4 flex items-center gap-1 text-mini text-accent-bright">
              Start quiz <Icon name="arrow" className="size-3" />
            </span>
          </Button>
          <Button
            className="w-full rounded-xl border border-line py-3 text-xs font-bold text-copy-muted disabled:opacity-50"
            disabled={studyLoading}
            onClick={generateStudy}
          >
            Create a new set of questions
          </Button>
        </div>
      )}

      {tab === "quiz" && activeQuiz && !quizComplete && quizQuestions.length > 0 && (
        <div className="mt-6">
          <Button className="mb-4 flex items-center gap-2 text-xs font-bold text-accent-bright" onClick={() => setActiveQuiz(null)}>
            <Icon name="arrow" className="size-3 rotate-180" /> {t.quizMode}
          </Button>
          <div className="mb-3 flex items-center justify-between text-xs text-copy-muted">
            <span>{activeQuiz}</span>
            <span>{t.questionOf} {questionIndex + 1} {t.from} {quizQuestions.length}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-purple transition-all"
              style={{ width: `${((questionIndex + 1) / quizQuestions.length) * 100}%` }}
            />
          </div>
          <section className="mt-5 rounded-card border border-line bg-card p-5">
            <Heading level={2} className="text-lg font-bold leading-7 text-white">
              {quizQuestions[questionIndex].question}
            </Heading>
            <div className="mt-5 space-y-3">
              {quizQuestions[questionIndex].answers.map((answer, answerIndex) => {
                const selected = selectedAnswer === answerIndex;
                const correct = selectedAnswer !== null && answerIndex === quizQuestions[questionIndex].correct;
                return (
                  <Button
                    className={`w-full rounded-xl border p-4 text-left text-sm font-semibold transition ${
                      correct
                        ? "border-green/40 bg-green/10 text-green"
                        : selected
                          ? "border-red/40 bg-red/10 text-red"
                          : "border-line bg-elevated text-copy-muted hover:border-accent hover:text-white"
                    }`}
                    key={answer}
                    onClick={() => chooseAnswer(answerIndex)}
                  >
                    {answer}
                  </Button>
                );
              })}
            </div>
            {selectedAnswer !== null && (
              <div className="mt-4 rounded-xl bg-accent-muted p-4 text-xs leading-5 text-blue-soft">
                {quizQuestions[questionIndex].explanation}
              </div>
            )}
          </section>
          <Button
            className="mt-4 w-full rounded-xl bg-accent px-4 py-4 text-sm font-bold text-white disabled:opacity-40 shadow-glow"
            disabled={selectedAnswer === null}
            onClick={nextQuestion}
          >
            {questionIndex === quizQuestions.length - 1 ? t.finishQuiz : t.nextQuestion}
          </Button>
        </div>
      )}

      {tab === "quiz" && quizComplete && (
        <section className="mt-6 rounded-card border border-green/25 bg-card p-6 text-center shadow-lg">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-green/10 text-green">
            <Icon name="check" className="size-7" />
          </div>
          <Heading level={2} className="mt-4 text-xl font-bold text-white">
            {lang === "Kazakh" ? "Тест аяқталды!" : lang === "English" ? "Quiz complete!" : "Тест завершён!"}
          </Heading>
          <p className="mt-2 text-sm text-copy-muted">
            {t.quizScore}: {quizScore} {t.from} {quizQuestions.length}
          </p>
          <Button className="mt-6 w-full rounded-xl bg-accent py-4 text-sm font-bold text-white shadow-glow" onClick={() => startQuiz(activeQuiz ?? lecture.title)}>
            {t.retakeQuiz}
          </Button>
          <Button className="mt-3 w-full rounded-xl border border-line py-4 text-sm font-bold text-copy-muted hover:text-white" onClick={() => setActiveQuiz(null)}>
            {t.quizMode}
          </Button>
        </section>
      )}

      {tab === "cards" && !deckComplete && flashcards.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between text-xs text-copy-muted">
            <span>{lecture.title}</span>
            <span>{cardIndex + 1} / {flashcards.length}</span>
          </div>
          <Button
            className={`flip-card relative flex min-h-card w-full flex-col items-center justify-center overflow-hidden rounded-card border border-accent/40 bg-gradient-to-br from-card to-blue-deep p-8 text-center shadow-neon ${
              flipped ? "is-flipped" : ""
            }`}
            onClick={() => setFlipped((value) => !value)}
          >
            <span
              className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/10 text-blue-soft transition hover:bg-accent hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                if (typeof window !== "undefined" && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                  const safeCard = flashcards[Math.min(cardIndex, flashcards.length - 1)] ?? ["", ""];
                  const textToSpeak = flipped ? safeCard[1] : safeCard[0];
                  const utter = new SpeechSynthesisUtterance(textToSpeak);
                  utter.lang =
                    lecture.outputLanguage === "Russian"
                      ? "ru-RU"
                      : lecture.outputLanguage === "Kazakh"
                        ? "kk-KZ"
                        : "en-US";
                  window.speechSynthesis.speak(utter);
                }
              }}
              title="Озвучить карточку"
            >
              <Icon name="speaker" className="size-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-accent-bright">
              {flipped ? (lang === "Kazakh" ? "Анықтамасы" : lang === "English" ? "Definition" : "Определение") : (lang === "Kazakh" ? "Кілт сөз" : lang === "English" ? "Key term" : "Термин")}
            </span>
            <span className="mt-5 block text-2xl font-bold leading-tight text-white">
              {(() => {
                const safeCard = flashcards[Math.min(cardIndex, flashcards.length - 1)] ?? ["", ""];
                return flipped ? safeCard[1] : safeCard[0];
              })()}
            </span>
            <span className="mt-7 text-xs text-copy-muted">{t.flipCard}</span>
          </Button>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <Button
              className="rounded-xl border border-red/30 bg-red/10 py-3 text-xs font-bold text-red hover:bg-red/20 transition"
              onClick={() => rateCard("hard")}
            >
              {t.cardHard}
              <span className="mt-1 block text-mini font-medium opacity-80">{t.cardSoon}</span>
            </Button>
            <Button
              className="rounded-xl border border-accent/30 bg-accent-muted py-3 text-xs font-bold text-accent-bright hover:opacity-90 transition"
              onClick={() => rateCard("good")}
            >
              {t.cardGood}
              <span className="mt-1 block text-mini font-medium opacity-80">{t.card3Days}</span>
            </Button>
            <Button
              className="rounded-xl border border-green/30 bg-green/10 py-3 text-xs font-bold text-green hover:bg-green/20 transition"
              onClick={() => rateCard("easy")}
            >
              {t.cardEasy}
              <span className="mt-1 block text-mini font-medium opacity-80">{t.card7Days}</span>
            </Button>
          </div>
          {cardFeedback && <div className="mt-4 text-center text-xs font-semibold text-green">{cardFeedback}</div>}
        </div>
      )}

      {tab === "cards" && deckComplete && flashcards.length > 0 && (
        <section className="mt-6 rounded-card border border-purple/30 bg-card p-6 text-center shadow-lg">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-purple/15 text-purple-light">
            <Icon name="cards" className="size-7" />
          </div>
          <Heading level={2} className="mt-4 text-xl font-bold text-white">
            {lang === "Kazakh" ? "Карточкалар қайталанды!" : lang === "English" ? "Deck complete!" : "Все карточки пройдены!"}
          </Heading>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 text-xs">
            <span className="px-3.5 py-1.5 rounded-full bg-red/15 border border-red/30 text-red font-bold">
              {t.cardHard}: {hardCards.length}
            </span>
            <span className="px-3.5 py-1.5 rounded-full bg-accent/15 border border-accent/30 text-accent-bright font-bold">
              {t.cardGood}: {goodCards.length}
            </span>
            <span className="px-3.5 py-1.5 rounded-full bg-green/15 border border-green/30 text-green font-bold">
              {t.cardEasy}: {easyCards.length}
            </span>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            {hardCards.length > 0 && (
              <Button
                className="flex-1 rounded-xl bg-red py-3.5 text-xs font-bold text-white shadow-red hover:opacity-95"
                onClick={() => {
                  setCategoryFilter("hard");
                  setCardIndex(0);
                  setDeckComplete(false);
                  setFlipped(false);
                }}
              >
                {t.reviewHardOnly} ({hardCards.length})
              </Button>
            )}
            <Button
              className="flex-1 rounded-xl bg-purple py-3.5 text-xs font-bold text-white hover:opacity-95"
              onClick={() => {
                setCategoryFilter("all");
                setCardIndex(0);
                setDeckComplete(false);
                setFlipped(false);
              }}
            >
              {lang === "Kazakh" ? "Барлығын басынан қайталау" : lang === "English" ? "Review All Again" : "Пройти все заново"}
            </Button>
          </div>
        </section>
      )}

      {/* Categorized Terms Section: Separates Hard, Good, Easy terms */}
      {tab === "cards" && flashcards.length > 0 && (
        <section className="mt-8 rounded-card border border-line bg-card p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="size-2 rounded-full bg-purple" />
                <span>
                  {lang === "Kazakh"
                    ? "Таңдалған санаттар бойынша терминдер"
                    : lang === "English"
                    ? "Terms by Difficulty Category"
                    : "Термины по категориям сложности"}
                </span>
              </h3>
              <p className="text-xs text-copy-muted mt-1">
                {lang === "Kazakh"
                  ? "Қиын, орташа және оңай деп белгіленген терминдер бөлек сақталады"
                  : lang === "English"
                  ? "Terms grouped by Hard, Good, and Easy ratings"
                  : "Термины распределены отдельно по категориям: сложно, нормально, легко"}
              </p>
            </div>
            {hardCards.length > 0 && (
              <Button
                className="rounded-xl bg-red/15 border border-red/30 px-3.5 py-1.5 text-xs font-bold text-red hover:bg-red/25 transition whitespace-nowrap"
                onClick={() => {
                  setCategoryFilter("hard");
                  setCardIndex(0);
                  setDeckComplete(false);
                  setFlipped(false);
                }}
              >
                {t.reviewHardOnly} ({hardCards.length})
              </Button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setCategoryFilter("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                categoryFilter === "all" ? "bg-accent text-white shadow-glow" : "bg-elevated text-copy-muted hover:text-white"
              }`}
            >
              {t.allCards} ({flashcards.length})
            </button>
            <button
              onClick={() => setCategoryFilter("hard")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                categoryFilter === "hard" ? "bg-red text-white shadow-glow" : "bg-red/10 border border-red/25 text-red hover:bg-red/20"
              }`}
            >
              <span className="size-2 rounded-full bg-red" />
              <span>{t.cardHard} ({hardCards.length})</span>
            </button>
            <button
              onClick={() => setCategoryFilter("good")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                categoryFilter === "good" ? "bg-accent text-white shadow-glow" : "bg-accent/10 border border-accent/25 text-accent-bright hover:bg-accent/20"
              }`}
            >
              <span className="size-2 rounded-full bg-accent-bright" />
              <span>{t.cardGood} ({goodCards.length})</span>
            </button>
            <button
              onClick={() => setCategoryFilter("easy")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                categoryFilter === "easy" ? "bg-green text-white shadow-glow" : "bg-green/10 border border-green/25 text-green hover:bg-green/20"
              }`}
            >
              <span className="size-2 rounded-full bg-green" />
              <span>{t.cardEasy} ({easyCards.length})</span>
            </button>
          </div>

          {/* Cards List in Selected Filter */}
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {displayedCards.length === 0 ? (
              <div className="text-center py-8 text-xs text-copy-muted bg-elevated/40 rounded-xl border border-line">
                {t.noCardsInCategory}
              </div>
            ) : (
              displayedCards.map(([term, def], idx) => {
                const rating = cardRatings[term];
                const badgeClass =
                  rating === "hard"
                    ? "bg-red/15 text-red border-red/30"
                    : rating === "good"
                    ? "bg-accent/15 text-accent-bright border-accent/30"
                    : rating === "easy"
                    ? "bg-green/15 text-green border-green/30"
                    : "bg-elevated text-copy-muted border-line";
                const badgeLabel =
                  rating === "hard"
                    ? t.cardHard
                    : rating === "good"
                    ? t.cardGood
                    : rating === "easy"
                    ? t.cardEasy
                    : lang === "Kazakh"
                    ? "Бағаланбаған"
                    : lang === "English"
                    ? "Unrated"
                    : "Не оценено";

                return (
                  <div key={idx} className="rounded-xl border border-line bg-elevated/40 p-3.5 hover:border-accent/40 transition">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white">{term}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}>
                        {badgeLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-copy-muted leading-relaxed">{def}</p>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
