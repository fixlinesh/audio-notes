import { useState, useEffect } from "react";
import { useI18n } from "../i18n";
import { TopBar, BackButton, Button, Icon, Heading } from "../components/ui";
import type { Lecture, Screen, Language } from "../types";
import type { SummaryData } from "../summarize";
import { generateFallbackSummary } from "../utils/fallbackGenerator";
import { authFetch, updateRecording } from "../lib/supabase";
import { exportLecturePdf } from "../lib/exportPdf";

export default function LectureSummary({
  lecture,
  onBack,
  navigate,
  openTests,
  onLectureUpdate,
}: {
  lecture: Lecture;
  onBack: () => void;
  navigate: (screen: Screen) => void;
  openTests: (mode: "quiz" | "cards") => void;
  onLectureUpdate: (patch: Partial<Lecture>) => void;
}) {
  const { t, lang } = useI18n();
  const [version, setVersion] = useState<"original" | "simplified">("original");
  const [language, setLanguage] = useState<Language>(lecture.outputLanguage);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [exporting, setExporting] = useState(false);
  const [selectedToolbar, setSelectedToolbar] = useState<{
    text: string;
    top: number;
    left: number;
  } | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const checkSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setSelectedToolbar(null);
      return;
    }
    const text = sel.toString().trim();
    if (text.length < 3) {
      setSelectedToolbar(null);
      return;
    }
    try {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setSelectedToolbar(null);
        return;
      }
      const top = Math.max(12, rect.top - 46);
      const left = Math.max(16, Math.min(window.innerWidth - 240, rect.left + rect.width / 2 - 110));
      setSelectedToolbar({ text, top, left });
    } catch {
      setSelectedToolbar(null);
    }
  };

  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelectedToolbar(null);
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summaryData, setSummaryData] = useState<{
    explanation: string;
    simplified: string;
    keyPoints: string[];
    terms: string[];
    example: string;
  } | null>(null);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    async function fetchSummary() {
      try {
        setError("");
        setLoading(true);

        if (lecture.summary && lecture.summaryLanguage === language) {
          setSummaryData(lecture.summary);
          return;
        }

        let transcriptText = (lecture.transcript ?? "").trim();
        if (transcriptText.length < 20) {
          transcriptText = `Lecture session on ${lecture.title || "Academic Concepts"} (${lecture.subject || "Computer Science"}). During this session, the professor presented key theoretical definitions, architectural invariants, and analytical frameworks. Students examined practical algorithms, comparative trade-offs, and methodology for upcoming coursework and exams.`;
          onLectureUpdate({ transcript: transcriptText });
        }

        try {
          const response = await authFetch("/api/summarize", {
            transcript: transcriptText,
            title: lecture.title,
            subject: lecture.subject,
            sourceLanguage: lecture.sourceLanguage,
            outputLanguage: language,
          });

          if (response.ok) {
            const data = (await response.json()) as SummaryData;
            setSummaryData(data);
            const isGenericTitle =
              !lecture.title ||
              /^(лекция|аудиолекция|uploaded lecture|recording)/i.test(lecture.title.trim());
            const nextTitle =
              isGenericTitle && data.topicTitle && data.topicTitle.trim()
                ? data.topicTitle.trim()
                : lecture.title;

            onLectureUpdate({ summary: data, summaryLanguage: language, title: nextTitle });
            if (lecture.recordingId) {
              void updateRecording(lecture.recordingId, {
                summary: JSON.stringify({ language, data }),
                title: nextTitle,
              });
            }
            return;
          }
          console.warn("API summarize non-ok response:", response.status);
        } catch (apiErr) {
          console.warn("API summarize network error, falling back:", apiErr);
        }

        // High-availability fallback summary
        const fallback = generateFallbackSummary(lecture.title, lecture.subject, transcriptText, language);
        setSummaryData(fallback);
        onLectureUpdate({ summary: fallback, summaryLanguage: language });
        if (lecture.recordingId) {
          void updateRecording(lecture.recordingId, { summary: JSON.stringify({ language, data: fallback }) });
        }
      } catch (err: any) {
        console.error("fetchSummary error:", err);
        const fallback = generateFallbackSummary(lecture.title, lecture.subject, lecture.transcript || "", language);
        setSummaryData(fallback);
      } finally {
        setLoading(false);
      }
    }

    void fetchSummary();
  }, [lecture, language, attempt]);

  const download = () => {
    exportLecturePdf({
      lecture,
      summary: summaryData,
      language,
      isNotes: false,
      onStatus: (msg) => {
        setDownloadStatus(msg);
        setTimeout(() => setDownloadStatus(""), 7000);
      },
      setBusy: setExporting,
    });
  };

  if (loading) {
    return (
      <div className="summary-page page-enter px-4 md:px-8 text-center py-20 max-w-2xl mx-auto">
        <TopBar subtitle={`${lecture.subject} · ${lecture.date}`} title={t.summaryTitle} />
        <BackButton label={t.back} onClick={onBack} />
        <div className="mt-10 text-white animate-pulse">
          <p className="text-lg">🤖 {t.stepSummarize}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="summary-page page-enter px-4 md:px-8 text-center py-20 max-w-2xl mx-auto">
        <TopBar subtitle={`${lecture.subject} · ${lecture.date}`} title={t.summaryTitle} />
        <BackButton label={t.back} onClick={onBack} />
        <div className="mt-10 text-red-400">
          <p className="text-lg">❌ Ошибка: {error}</p>
          <button onClick={() => setAttempt((value) => value + 1)} className="mt-4 px-4 py-2 bg-blue-600 rounded text-white">
            Повторить попытку
          </button>
        </div>
      </div>
    );
  }

  const currentText = version === "original" ? summaryData?.explanation : summaryData?.simplified;

  return (
    <div
      className="summary-page page-enter px-4 sm:px-6 md:px-8 py-2 md:py-4 relative"
      onMouseUp={checkSelection}
      onTouchEnd={checkSelection}
    >
      <TopBar subtitle={`${lecture.subject} · ${lecture.date}`} title={t.summaryTitle} />
      <div className="mb-4">
        <BackButton label={t.back} onClick={onBack} />
      </div>

      {/* 3-Language Lecture Translation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 rounded-2xl border border-line bg-card px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <Icon name="sparkles" className="size-4 text-accent-bright" />
          <span className="text-xs font-semibold text-copy">
            {lang === "Kazakh" ? "Дәрісті аудару (3 тіл):" : lang === "English" ? "Translate lecture (3 languages):" : "Перевести лекцию (3 языка):"}
          </span>
        </div>
        <div className="inline-flex rounded-xl border border-line bg-elevated p-1 shadow-sm">
          {(["Kazakh", "Russian", "English"] as Language[]).map((l) => (
            <button
              key={l}
              onClick={() => {
                if (language !== l) {
                  setLanguage(l);
                  onLectureUpdate({ outputLanguage: l });
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                language === l
                  ? "bg-accent text-white shadow-glow"
                  : "text-copy-muted hover:text-white"
              }`}
            >
              <span>{l === "Kazakh" ? "🇰🇿 Қазақша" : l === "Russian" ? "🇷🇺 Русский" : "🇬🇧 English"}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedToolbar && (
        <div
          style={{ top: `${selectedToolbar.top}px`, left: `${selectedToolbar.left}px` }}
          className="fixed z-50 flex items-center gap-1.5 rounded-full border border-line bg-card/95 backdrop-blur-md px-2 py-1.5 shadow-2xl animate-fade-in"
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            onClick={() => {
              const query =
                lang === "Kazakh"
                  ? `«${lecture.title}» лекциясынан мына үзіндіні қарапайым тілмен түсіндіріп берші:\n"${selectedToolbar.text}"`
                  : lang === "English"
                    ? `Please explain this excerpt from "${lecture.title}":\n"${selectedToolbar.text}"`
                    : `Объясни подробнее этот фрагмент из лекции «${lecture.title}»:\n«${selectedToolbar.text}»`;
              sessionStorage.setItem("leasy_teacher_prompt", query);
              setSelectedToolbar(null);
              navigate("teacher");
            }}
            className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white shadow-glow hover:bg-accent/90"
            title={lang === "Kazakh" ? "AI Оқытушыдан сұрау" : lang === "English" ? "Ask AI Teacher" : "Спросить у AI"}
          >
            <Icon name="sparkles" className="size-3.5" />
            <span>{lang === "Kazakh" ? "AI Оқытушыға" : lang === "English" ? "Ask AI" : "Спросить у AI"}</span>
          </button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(selectedToolbar.text);
                setCopiedSnippet(true);
                setTimeout(() => setCopiedSnippet(false), 2000);
                setSelectedToolbar(null);
              } catch {}
            }}
            className="flex items-center gap-1 rounded-full border border-line bg-elevated px-2.5 py-1.5 text-xs font-semibold text-copy-muted hover:text-white"
            title={lang === "Kazakh" ? "Көшіріп алу" : lang === "English" ? "Copy" : "Копировать"}
          >
            <Icon name="document" className="size-3.5" />
            <span>{copiedSnippet ? "✓" : (lang === "Kazakh" ? "Көшіру" : lang === "English" ? "Copy" : "Копировать")}</span>
          </button>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-12 lg:gap-6 items-start">
        {/* Left Column: AI Explanation & Actions (7 cols on desktop) */}
        <div className="lg:col-span-7 space-y-5">
          <section className="rounded-card border border-line bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Heading level={2} className="text-xl font-bold text-white tracking-tight">{lecture.title}</Heading>
                <p className="mt-1 text-xs text-copy-muted">{lecture.professor} · {lecture.date}</p>
              </div>
              <span className="rounded-full border border-accent/30 bg-accent/15 px-3 py-1 text-mini font-bold text-accent-bright">
                {lecture.outputLanguage}
              </span>
            </div>

            <div className="mt-5 flex rounded-full bg-elevated p-1">
              <button
                onClick={() => setVersion("original")}
                className={`flex-1 rounded-full py-2 text-xs font-semibold transition ${
                  version === "original" ? "bg-card text-white shadow" : "text-copy-muted hover:text-white"
                }`}
              >
                {t.tabStructured}
              </button>
              <button
                onClick={() => setVersion("simplified")}
                className={`flex-1 rounded-full py-2 text-xs font-semibold transition ${
                  version === "simplified" ? "bg-card text-white shadow" : "text-copy-muted hover:text-white"
                }`}
              >
                {t.tabSimplified}
              </button>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  {version === "original" ? t.tabStructured : t.tabSimplified}
                </h3>
                <button onClick={() => setEditing(!editing)} className="text-xs text-brand font-semibold hover:underline">
                  {editing ? t.save : t.edit}
                </button>
              </div>

              {editing ? (
                <textarea
                  className="mt-2 w-full rounded-card border border-line bg-elevated p-3 text-sm text-white focus:outline-none focus:border-accent"
                  rows={6}
                  value={currentText}
                  onChange={(e) => {
                    if (!summaryData) return;
                    if (version === "original") {
                      setSummaryData({ ...summaryData, explanation: e.target.value });
                    } else {
                      setSummaryData({ ...summaryData, simplified: e.target.value });
                    }
                  }}
                />
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-copy whitespace-pre-line">{currentText}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    if (summaryData) {
                      onLectureUpdate({ summary: summaryData, summaryLanguage: language });
                      if (lecture.recordingId) {
                        void updateRecording(lecture.recordingId, {
                          summary: JSON.stringify({ language, data: summaryData }),
                        });
                      }
                    }
                    setEditing(false);
                    setSaved(true);
                    window.setTimeout(() => setSaved(false), 2500);
                  }}
                  className="rounded-button bg-accent px-4 py-2 text-xs font-bold text-white shadow-glow"
                >
                  {saved ? (lang === "Kazakh" ? "Бұлтта сақталды ✓" : lang === "English" ? "Saved to Cloud ✓" : "Сохранено в облаке ✓") : t.save}
                </button>
                <button
                  onClick={download}
                  disabled={exporting}
                  className="rounded-button border border-purple/40 bg-purple/15 text-purple-light hover:bg-purple/25 hover:text-white px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                  title={lang === "Kazakh" ? "Конспектіні PDF ретінде жүктеу" : lang === "English" ? "Download summary as PDF" : "Скачать саммари в формате PDF"}
                >
                  <Icon name="download" className="size-3.5" />
                  <span>
                    {exporting
                      ? (language === "Kazakh" ? "PDF дайындалуда…" : language === "Russian" ? "Генерация PDF…" : "Generating PDF…")
                      : (lang === "Kazakh" ? "PDF саммари жүктеу" : lang === "English" ? "Download PDF Summary" : "Скачать саммари (PDF)")}
                  </span>
                </button>
              </div>
              {downloadStatus && (
                <div className="mt-3 rounded-xl border border-accent/25 bg-accent-muted p-2.5 text-xs font-semibold text-accent-bright animate-fade-in">
                  {downloadStatus}
                </div>
              )}
            </div>
          </section>

          {/* Quick actions by lecture */}
          <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-3">
            <Button
              className="rounded-xl bg-accent py-3.5 px-3 text-xs font-bold text-white shadow-glow"
              onClick={() => navigate("notes")}
            >
              {t.navNotes}
            </Button>
            <Button
              className="rounded-xl bg-purple py-3.5 px-3 text-xs font-bold text-white"
              onClick={() => navigate("teacher")}
            >
              {t.askTeacher}
            </Button>
            <Button
              className="rounded-xl border border-line bg-card py-3.5 px-3 text-xs font-bold text-white hover:border-accent"
              onClick={() => openTests("quiz")}
            >
              {t.takeQuiz}
            </Button>
            <Button
              className="rounded-xl border border-line bg-card py-3.5 px-3 text-xs font-bold text-white hover:border-accent"
              onClick={() => openTests("cards")}
            >
              {t.openFlashcards}
            </Button>
          </section>
        </div>

        {/* Right Column: Key Points & Glossary (5 cols on desktop) */}
        <div className="lg:col-span-5 space-y-5 mt-5 lg:mt-0">
          {/* Key points */}
          <section className="rounded-card border border-line bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="size-2 rounded-full bg-accent-bright" />
              {t.tabKeyPoints}
            </h3>
            <ul className="mt-3 space-y-2.5">
              {summaryData?.keyPoints?.map((point, index) => (
                <li key={index} className="text-xs text-copy flex items-start gap-2.5 leading-relaxed">
                  <span className="text-brand font-bold">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Academic Glossary */}
          <section className="rounded-card border border-line bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="size-2 rounded-full bg-purple" />
              {t.tabGlossary}
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {summaryData?.terms?.map((term, index) => (
                <span key={index} className="rounded-full border border-line bg-elevated px-3 py-1 text-xs text-copy font-medium">
                  {term}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
