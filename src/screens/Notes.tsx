import { useState, useEffect } from "react";
import { useI18n } from "../i18n";
import { TopBar, Button, Icon, Heading } from "../components/ui";
import type { Lecture, Screen } from "../types";
import { parseVocabulary } from "../utils/helpers";
import { exportLecturePdf } from "../lib/exportPdf";

export default function Notes({
  lecture,
  openTests,
  onBack,
  navigate,
}: {
  lecture: Lecture;
  openTests: (mode: "quiz" | "cards") => void;
  onBack: () => void;
  navigate?: (screen: Screen) => void;
}) {
  const { t, lang } = useI18n();
  const { termsList, definitions } = parseVocabulary(lecture.summary?.terms);
  const [selectedTerm, setSelectedTerm] = useState(termsList[0] ?? "Главная идея");
  const [actionStatus, setActionStatus] = useState("");
  const [downloading, setDownloading] = useState(false);
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

  useEffect(() => {
    if (termsList.length > 0 && !definitions[selectedTerm]) {
      setSelectedTerm(termsList[0]);
    }
  }, [lecture.summary, termsList, definitions, selectedTerm]);

  const downloadNotes = () => {
    exportLecturePdf({
      lecture,
      summary: lecture.summary,
      language: lang,
      isNotes: true,
      onStatus: (msg) => {
        setActionStatus(msg);
        setTimeout(() => setActionStatus(""), 7000);
      },
      setBusy: setDownloading,
    });
  };

  const shareNotes = async () => {
    const preview = lecture.summary?.simplified || lecture.summary?.explanation || "Конспект лекции";
    const shareData = {
      title: `Audio Notes · ${lecture.title}`,
      text: `Конспект лекции "${lecture.title}":\n${preview}`,
    };

    if (navigator.share) {
      setActionStatus(lang === "Kazakh" ? "Бөлісу терезесі ашылуда…" : "Открываем меню отправки…");
      await navigator.share(shareData)
        .then(() => setActionStatus(lang === "Kazakh" ? "Жіберілді." : "Заметки успешно отправлены."))
        .catch(() => setActionStatus(lang === "Kazakh" ? "Бас тартылды." : "Отправка отменена."));
      return;
    }

    try {
      await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}`);
      setActionStatus(lang === "Kazakh" ? "Алмасу буферіне көшірілді." : "Текст конспекта скопирован в буфер обмена.");
    } catch {
      setActionStatus(lang === "Kazakh" ? "Бұл браузерде қолжетімсіз." : "Отправка недоступна в этом браузере.");
    }
  };

  const keyPoints = lecture.summary?.keyPoints && lecture.summary.keyPoints.length > 0
    ? lecture.summary.keyPoints
    : lecture.summary?.explanation
      ? [lecture.summary.explanation]
      : ["Ключевые пункты конспекта появятся здесь после генерации в разделе Summary."];

  return (
    <div
      className="notes-page page-enter px-4 sm:px-6 md:px-8 py-2 md:py-4 relative"
      onMouseUp={checkSelection}
      onTouchEnd={checkSelection}
    >
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
              if (navigate) navigate("teacher");
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
      <TopBar
        subtitle={`${lecture.subject} · ${lecture.date}`}
        title={lecture.title}
        action={
          <Button
            aria-label="Назад к конспекту лекции"
            className="grid size-10 place-items-center rounded-full border border-line bg-card text-copy-muted transition hover:text-white"
            onClick={onBack}
          >
            <Icon name="arrow" className="size-4 rotate-180" />
          </Button>
        }
      />

      <div className="flex gap-3 mb-5">
        <Button
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-purple px-4 py-3.5 text-sm font-bold text-white shadow-glow disabled:opacity-50"
          disabled={downloading}
          onClick={downloadNotes}
        >
          <Icon name="download" className="size-4" />
          {downloading
            ? (lang === "Kazakh" ? "PDF жасалуда…" : "Генерация PDF…")
            : (lang === "Kazakh" ? "PDF конспекті жүктеу" : lang === "English" ? "Download PDF Notes" : "Скачать конспект в PDF")}
        </Button>
        <Button
          aria-label="Поделиться заметками"
          className="grid size-12 place-items-center rounded-xl border border-line bg-card text-copy-muted transition hover:text-white hover:border-accent"
          onClick={shareNotes}
        >
          <Icon name="share" className="size-4" />
        </Button>
      </div>

      {actionStatus && (
        <div className="mb-5 rounded-xl border border-accent/25 bg-accent-muted p-3 text-xs font-semibold text-accent-bright">
          {actionStatus}
        </div>
      )}

      {/* Desktop 2-column layout */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-6 items-start">
        {/* Left column: Key Points & Practical Breakdown (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <section className="rounded-card border border-line bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-accent-muted text-accent-bright">
                <Icon name="sparkles" className="size-4" />
              </div>
              <Heading level={2} className="text-base font-bold text-white">
                {t.tabKeyPoints}
              </Heading>
            </div>
            <ul className="space-y-3 text-sm leading-6 text-copy-muted">
              {keyPoints.map((item, idx) => (
                <li className="flex gap-3" key={idx}>
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-bright" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-card border border-line bg-card p-5 shadow-sm">
            <Heading level={2} className="text-base font-bold text-white">
              {lang === "Kazakh" ? "Талдау және мысалдар" : lang === "English" ? "Explanation & Examples" : "Разбор и практические примеры"}
            </Heading>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-elevated p-4">
                <div className="text-xs font-semibold text-accent-bright uppercase tracking-wider">{t.tabSimplified}</div>
                <div className="mt-2 text-sm leading-6 text-white whitespace-pre-line">
                  {lecture.summary?.simplified || "Понятное объяснение простыми словами появится здесь."}
                </div>
              </div>
              {lecture.summary?.example && (
                <div className="rounded-xl bg-elevated p-4">
                  <div className="text-xs font-semibold text-purple-light uppercase tracking-wider">{t.tabExample}</div>
                  <div className="mt-2 text-sm leading-6 text-white whitespace-pre-line">
                    {lecture.summary.example}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right column: Glossary & Practice Quizzes (5 cols) */}
        <div className="lg:col-span-5 space-y-5 mt-5 lg:mt-0">
          <section className="rounded-card border border-line bg-card p-5 shadow-sm">
            <Heading level={2} className="text-base font-bold text-white flex items-center gap-2">
              <span className="size-2 rounded-full bg-purple" />
              {t.tabGlossary}
            </Heading>
            <div className="mt-4 flex flex-wrap gap-2">
              {termsList.map((term) => (
                <Button
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    term === selectedTerm
                      ? "border-accent bg-accent-muted text-accent-bright shadow-glow"
                      : "border-line bg-elevated text-copy-muted hover:text-white"
                  }`}
                  key={term}
                  onClick={() => setSelectedTerm(term)}
                >
                  {term}
                </Button>
              ))}
            </div>
            <div className="mt-4 rounded-xl border-l-2 border-purple bg-purple/10 p-4">
              <div className="text-xs font-bold text-purple-light">{selectedTerm}</div>
              <p className="mt-1 text-xs leading-5 text-copy-muted">
                {definitions[selectedTerm] || "Определение термина."}
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-card border border-purple/40 bg-gradient-to-br from-purple/20 to-accent-muted p-5 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-widest text-purple-light">
              {lang === "Kazakh" ? "Материалды бекіту" : lang === "English" ? "Knowledge Check" : "Закрепление материала"}
            </div>
            <Heading level={2} className="mt-2 text-lg font-bold text-white">
              {lang === "Kazakh" ? "Біліміңізді тексеріңіз" : lang === "English" ? "Self-Check Practice" : "Проверьте свои знания"}
            </Heading>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button
                className="rounded-xl bg-white px-3 py-3 text-xs font-bold text-ink shadow-sm hover:opacity-90"
                onClick={() => openTests("quiz")}
              >
                {t.takeQuiz} <span className="block text-mini font-medium text-copy-dim">{lecture.study?.quiz?.length || 8} {t.items}</span>
              </Button>
              <Button
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-xs font-bold text-white hover:bg-white/20"
                onClick={() => openTests("cards")}
              >
                {t.openFlashcards} <span className="block text-mini font-medium text-copy-muted">{lecture.study?.flashcards?.length || 8} {t.items}</span>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
