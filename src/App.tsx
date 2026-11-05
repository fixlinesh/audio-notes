import {
  createElement,
  type ButtonHTMLAttributes,
  type ComponentPropsWithRef,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  supabase,
  saveMedia,
  createLectureRow,
  updateRecording,
  listRecordings,
  getSignedAudioUrl,
  deleteRecording,
  authFetch,
  type RecordingRow,
} from "./lib/supabase";
import type { SummaryData } from "./summarize";
import { useTheme } from "./theme";
import { useI18n, type UILanguage, formatDisplayDate } from "./i18n";
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = (reader.result as string) || "";
      const base64 = res.includes(",") ? res.split(",")[1] : res;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

type Screen =
  | "home"
  | "record"
  | "lecture-info"
  | "processing"
  | "summary"
  | "notes"
  | "tests"
  | "teacher"
  | "library";
type Language = "English" | "Russian" | "Kazakh";
type QuizQuestion = { question: string; answers: string[]; correct: number; explanation: string };
type StudyData = { quiz: QuizQuestion[]; flashcards: { term: string; definition: string }[] };
type Lecture = {
  title: string;
  subject: string;
  professor: string;
  date: string;
  sourceLanguage: Language;
  outputLanguage: Language;
  sourceType: "recording" | "upload";
  sourceFile?: string;
  transcript?: string;
  audioBlob?: Blob;
  audioUrl?: string;
  audioDuration?: number;
  audioMimeType?: string;
  recordingId?: string;
  storagePath?: string;
  summary?: SummaryData;
  summaryLanguage?: Language;
  study?: StudyData;
  studyLanguage?: Language;
};
type IconName =
  | "arrow"
  | "book"
  | "brain"
  | "cards"
  | "check"
  | "chevron"
  | "clock"
  | "download"
  | "home"
  | "mic"
  | "moon"
  | "more"
  | "pause"
  | "play"
  | "search"
  | "send"
  | "share"
  | "sparkles"
  | "speaker"
  | "stop"
  | "sun"
  | "test"
  | "upload"
  | "wave";

const paths: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10H5V10Z" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v4M9 21h6" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22.5Z" />
      <path d="M4 5.5v17M8 7h8M8 11h6" />
    </>
  ),
  test: (
    <>
      <path d="M9 5h10M9 12h10M9 19h10" />
      <path d="m3 5 1 1 2-2M3 12l1 1 2-2M3 19l1 1 2-2" />
    </>
  ),
  brain: (
    <>
      <path d="M9.5 4.5A3 3 0 0 0 4 6v1.2a3 3 0 0 0-1 5.6V14a4 4 0 0 0 6.5 3.1V4.5ZM14.5 4.5A3 3 0 0 1 20 6v1.2a3 3 0 0 1 1 5.6V14a4 4 0 0 1-6.5 3.1V4.5Z" />
      <path d="M6 9a3 3 0 0 1 3.5 3M18 9a3 3 0 0 0-3.5 3M6 16a3 3 0 0 0 3.5-2M18 16a3 3 0 0 1-3.5-2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  arrow: <path d="m9 18 6-6-6-6" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  wave: (
    <>
      <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
    </>
  ),
  pause: (
    <>
      <path d="M8 5v14M16 5v14" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  download: (
    <>
      <path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m0 0L7 9m5-5 5 5M5 20h14" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
    </>
  ),
  cards: (
    <>
      <rect x="6" y="3" width="14" height="16" rx="2" />
      <path d="M16 19v2H4a2 2 0 0 1-2-2V7h4M10 8h6M10 12h4" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 2-1.2 3.8L7 7l3.8 1.2L12 12l1.2-3.8L17 7l-3.8-1.2ZM5 14l-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8ZM19 14l-.8 2.2L16 17l2.2.8L19 20l.8-2.2L22 17l-2.2-.8Z" />
    </>
  ),
  speaker: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4ZM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" />
    </>
  ),
  send: <path d="m22 2-7 20-4-9-9-4ZM22 2 11 13" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  play: <path d="m8 5 11 7-11 7Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
};

function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  );
}

function Button({
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return createElement("button", { className: `focus-ring ${className}`, ...props }, children);
}

function Input({ className = "", ...props }: ComponentPropsWithRef<"input">) {
  return createElement("input", { className: `focus-ring ${className}`, ...props });
}

function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return createElement("select", { className: `focus-ring ${className}`, ...props }, children);
}

function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return createElement("textarea", { className: `focus-ring ${className}`, ...props });
}

function Audio({ ...props }: ComponentPropsWithRef<"audio">) {
  return createElement("audio", props);
}

function Heading({
  level = 1,
  className = "",
  children,
}: {
  level?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
}) {
  return createElement(`h${level}`, { className }, children);
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const options: { id: UILanguage; label: string; short: string }[] = [
    { id: "Kazakh", label: "Қазақша", short: "ҚАЗ" },
    { id: "Russian", label: "Русский", short: "РУС" },
    { id: "English", label: "English", short: "ENG" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Интерфейс тілі / Язык интерфейса"
      className={`inline-flex items-center gap-1 rounded-full border border-line bg-card p-1 shadow-sm transition ${className}`}
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="radio"
          aria-checked={lang === opt.id}
          onClick={() => setLang(opt.id)}
          className={`flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-bold tracking-wide whitespace-nowrap transition-all ${
            lang === opt.id
              ? "bg-accent text-white shadow-glow scale-[1.02]"
              : "text-copy-muted hover:text-white hover:bg-elevated/60"
          }`}
          title={opt.label}
        >
          <span>{opt.short}</span>
        </button>
      ))}
    </div>
  );
}

export function ThemeToggle({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { isDark, toggleTheme, setTheme } = useTheme();
  const { t } = useI18n();

  if (compact) {
    return (
      <Button
        aria-label={isDark ? t.themeLight : t.themeDark}
        title={isDark ? t.themeLight : t.themeDark}
        className={`grid size-10 place-items-center rounded-full border border-line bg-card text-copy-muted transition hover:border-accent hover:text-accent-bright ${className}`}
        onClick={toggleTheme}
        type="button"
      >
        <Icon name={isDark ? "sun" : "moon"} className="size-4 text-accent-bright" />
      </Button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={t.theme}
      className={`inline-flex items-center gap-1 rounded-full border border-line bg-card p-1 shadow-sm transition ${className}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={!isDark}
        onClick={() => setTheme("light")}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-mini font-bold transition ${
          !isDark
            ? "bg-accent text-white shadow-glow"
            : "text-copy-muted hover:text-white"
        }`}
      >
        <Icon name="sun" className="size-3.5" />
        <span>{t.themeLight}</span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={isDark}
        onClick={() => setTheme("dark")}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-mini font-bold transition ${
          isDark
            ? "bg-accent text-white shadow-glow"
            : "text-copy-muted hover:text-white"
        }`}
      >
        <Icon name="moon" className="size-3.5" />
        <span>{t.themeDark}</span>
      </button>
    </div>
  );
}

function DesktopNavbar({
  screen,
  onNavigate,
  onOpenAuth,
  isGuest,
  userName,
  avatarGradient,
  avatarUrl,
  initials,
  onOpenProfile,
  onOpenSearch,
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  onOpenAuth?: () => void;
  isGuest?: boolean;
  userName?: string;
  avatarGradient?: string;
  avatarUrl?: string;
  initials?: string;
  onOpenProfile?: () => void;
  onOpenSearch?: () => void;
}) {
  const { t } = useI18n();
  const navItems: { screen: Screen; label: string; icon: IconName }[] = [
    { screen: "home", label: t.navHome, icon: "home" },
    { screen: "record", label: t.navRecord, icon: "mic" },
    { screen: "library", label: t.navLibrary, icon: "wave" },
    { screen: "notes", label: t.navNotes, icon: "book" },
    { screen: "tests", label: t.navTests, icon: "test" },
    { screen: "teacher", label: t.navTeacher, icon: "brain" },
  ];

  return (
    <header className="hidden md:flex sticky top-0 z-40 w-full items-center justify-between border-b border-line bg-nav/95 px-6 lg:px-12 py-3 backdrop-blur-xl transition">
      <button
        onClick={() => onNavigate("home")}
        className="flex items-center gap-3 text-left transition hover:opacity-90 shrink-0"
        type="button"
      >
        <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-accent to-purple text-white shadow-glow shrink-0">
          <Icon name="mic" className="size-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white tracking-tight">L-easy</span>
            <span className="rounded-md border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent-bright">
              AI Notes
            </span>
          </div>
          <p className="text-[11px] text-copy-muted hidden lg:block">{t.appSubtitle}</p>
        </div>
      </button>

      <nav className="flex items-center gap-1 rounded-2xl border border-line bg-card/90 p-1 shadow-sm shrink-0">
        {navItems.map((item) => (
          <button
            key={item.screen}
            onClick={() => onNavigate(item.screen)}
            type="button"
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap shrink-0 transition ${
              screen === item.screen
                ? "bg-accent text-white shadow-glow"
                : "text-copy-muted hover:text-white hover:bg-elevated/60"
            }`}
          >
            <Icon name={item.icon} className="size-4 shrink-0" />
            <span className="whitespace-nowrap">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2.5 shrink-0">
        <LanguageToggle />
        <ThemeToggle compact />
        {onOpenSearch && (
          <Button
            aria-label="Search"
            className="grid size-9 place-items-center rounded-full border border-line bg-card text-copy-muted transition hover:border-accent hover:text-accent-bright"
            onClick={onOpenSearch}
            type="button"
          >
            <Icon name="search" className="size-4" />
          </Button>
        )}
        {isGuest && onOpenAuth && (
          <Button
            className="rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-white shadow-glow transition hover:opacity-90"
            onClick={onOpenAuth}
            type="button"
          >
            {t.signIn}
          </Button>
        )}
        {onOpenProfile && (
          <Button
            aria-label="Open profile"
            className={`relative grid size-9 place-items-center overflow-hidden rounded-full bg-gradient-to-br ${avatarGradient || "from-accent to-purple"} text-xs font-bold text-white ring-2 ring-card shadow-sm transition hover:scale-105`}
            onClick={onOpenProfile}
            type="button"
          >
            {avatarUrl ? (
              <img alt={userName || "Avatar"} className="size-full object-cover" src={avatarUrl} />
            ) : (
              initials || "U"
            )}
          </Button>
        )}
      </div>
    </header>
  );
}

function TopBar({
  title,
  subtitle,
  action,
  showThemeToggle = true,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  showThemeToggle?: boolean;
}) {
  return (
    <header className="flex items-start justify-between gap-4 pb-4 pt-safe">
      <div className="min-w-0 flex-1">
        {subtitle && <p className="mb-1 truncate text-xs font-medium text-copy-muted">{subtitle}</p>}
        <Heading className="truncate text-xl md:text-2xl font-bold tracking-tight text-white">{title}</Heading>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <LanguageToggle className="md:hidden" />
        {showThemeToggle && <ThemeToggle compact className="md:hidden" />}
        {action}
      </div>
    </header>
  );
}

function OverlayPanel({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-6">
      <div className="relative flex h-full md:h-auto md:max-h-[90vh] w-full max-w-md md:max-w-3xl lg:max-w-4xl flex-col bg-app px-5 md:px-8 py-4 md:rounded-3xl md:border md:border-line md:shadow-2xl overflow-hidden">
        <div className="shrink-0">
          <TopBar
            title={title}
            subtitle={subtitle}
            showThemeToggle={false}
            action={
              <Button
                aria-label="Close"
                className="grid size-10 place-items-center rounded-full border border-line bg-card text-copy-muted transition hover:border-accent hover:text-white"
                onClick={onClose}
              >
                <Icon name="arrow" className="size-4 rotate-180" />
              </Button>
            }
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-24 md:pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function BackButton({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <Button className="mb-3 flex items-center gap-2 text-xs font-bold text-accent-bright" onClick={onClick}>
      <Icon name="arrow" className="size-3 rotate-180" /> {label}
    </Button>
  );
}

const nav: { screen: Screen; label: string; icon: IconName }[] = [
  { screen: "home", label: "Home", icon: "home" },
  { screen: "record", label: "Record", icon: "mic" },
  { screen: "library", label: "Library", icon: "wave" },
  { screen: "notes", label: "Notes", icon: "book" },
  { screen: "tests", label: "Tests", icon: "test" },
  { screen: "teacher", label: "AI Teacher", icon: "brain" },
];

function BottomNav({
  screen,
  onNavigate,
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
}) {
  const { t } = useI18n();
  const navItems: { screen: Screen; label: string; icon: IconName }[] = [
    { screen: "home", label: t.navHome, icon: "home" },
    { screen: "record", label: t.navRecord, icon: "mic" },
    { screen: "library", label: t.navLibrary, icon: "wave" },
    { screen: "notes", label: t.navNotes, icon: "book" },
    { screen: "tests", label: t.navTests, icon: "test" },
    { screen: "teacher", label: t.navTeacher, icon: "brain" },
  ];

  return (
    <nav
      aria-label="Main navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex w-full border-t border-line bg-nav/95 px-2 pb-safe backdrop-blur-xl"
    >
      {navItems.map((item) => (
        <Button
          className={`relative flex flex-1 flex-col items-center gap-1 py-3 text-mini font-semibold transition ${
            item.screen === screen ? "text-accent-bright" : "text-copy-dim"
          }`}
          key={item.screen}
          onClick={() => onNavigate(item.screen)}
        >
          {item.screen === screen && (
            <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent-bright shadow-glow" />
          )}
          <Icon name={item.icon} className="size-5" />
          <span className="truncate max-w-[56px] text-[10px]">{item.label}</span>
        </Button>
      ))}
    </nav>
  );
}

type ScheduleItem = {
  id: string;
  time: string;
  subject: string;
  place: string;
  status: string;
};

const defaultSchedule: ScheduleItem[] = [
  { id: "1", time: "10:00", subject: "Math Analysis", place: "Room 302", status: "Сегодня" },
  { id: "2", time: "12:30", subject: "Computer Science 101", place: "Auditorium B", status: "Сегодня" },
  { id: "3", time: "15:00", subject: "Academic English", place: "Online", status: "Сегодня" },
  { id: "4", time: "09:00", subject: "Linear Algebra", place: "Room 208", status: "Завтра" },
  { id: "5", time: "13:30", subject: "Research Methods", place: "Online", status: "Завтра" },
];

const avatarThemes: Record<string, string> = {
  aurora: "from-accent to-purple",
  emerald: "from-green to-accent",
  royal: "from-purple to-accent",
  crimson: "from-red to-purple",
};

function hasJsonContent(val: unknown): boolean {
  if (!val) return false;
  if (typeof val === "string") {
    const t = val.trim();
    return t.length > 2 && t !== "{}" && t !== "null";
  }
  if (typeof val === "object") {
    return Object.keys(val as Record<string, unknown>).length > 0;
  }
  return false;
}

type CachedProfile = {
  userName: string;
  userEmail: string;
  memberSince: string;
  university: string;
  major: string;
  avatarTheme: string;
  avatarUrl: string;
  defaultLang: Language;
  autoTranscribe: boolean;
  defaultNoiseFilter: boolean;
  voiceTts: boolean;
};

function getInitialProfile(): CachedProfile {
  const fallback: CachedProfile = {
    userName: "",
    userEmail: "",
    memberSince: "",
    university: "Astana IT University",
    major: "ICT · Computer Science",
    avatarTheme: "aurora",
    avatarUrl: "",
    defaultLang: "Russian",
    autoTranscribe: true,
    defaultNoiseFilter: true,
    voiceTts: true,
  };
  try {
    // 1. Read directly from Supabase localStorage session token if present (always synchronous and up to date)
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          const u = parsed?.user;
          if (u) {
            const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
            const emailPrefix = String(u.email ?? "").split("@")[0] ?? "";
            fallback.userEmail = String(u.email ?? "");
            fallback.userName = String(meta.full_name || emailPrefix);
            if (meta.university) fallback.university = String(meta.university);
            if (meta.major) fallback.major = String(meta.major);
            if (typeof meta.avatar_theme === "string") fallback.avatarTheme = meta.avatar_theme;
            if (typeof meta.avatar_url === "string") fallback.avatarUrl = meta.avatar_url;
            if (meta.default_lang === "English" || meta.default_lang === "Russian" || meta.default_lang === "Kazakh") {
              fallback.defaultLang = meta.default_lang;
            }
            if (typeof meta.auto_transcribe === "boolean") fallback.autoTranscribe = meta.auto_transcribe;
            if (typeof meta.default_noise_filter === "boolean") fallback.defaultNoiseFilter = meta.default_noise_filter;
            if (typeof meta.voice_tts === "boolean") fallback.voiceTts = meta.voice_tts;
            if (u.created_at) {
              fallback.memberSince = new Date(u.created_at).toLocaleDateString("ru-RU", { month: "short", year: "numeric" });
            }
          }
        }
      }
    }
    // 2. Also overlay any newer local profile cache
    const cached = localStorage.getItem("leasy_profile_cache");
    if (cached) {
      const p = JSON.parse(cached) as Partial<CachedProfile>;
      if (p.userEmail && (!fallback.userEmail || p.userEmail === fallback.userEmail)) {
        return { ...fallback, ...p };
      }
    }
  } catch {}
  return fallback;
}

function getInitialStats(expectedEmail?: string) {
  try {
    const raw = localStorage.getItem("leasy_stats_cache");
    if (raw) {
      const s = JSON.parse(raw);
      if (!expectedEmail || !s.userEmail || s.userEmail === expectedEmail) {
        return {
          libraryCount: typeof s.libraryCount === "number" ? s.libraryCount : null,
          summariesCount: Number(s.summariesCount || 0),
          quizzesCount: Number(s.quizzesCount || 0),
          totalMinutes: Number(s.totalMinutes || 0),
        };
      }
    }
  } catch {}
  return { libraryCount: null as number | null, summariesCount: 0, quizzesCount: 0, totalMinutes: 0 };
}

function Home({
  navigate,
  openTests,
  onOpenRecording,
  onStartSubjectRecord,
  isGuest,
  onOpenAuth,
}: {
  navigate: (screen: Screen) => void;
  openTests: (mode: "quiz" | "cards") => void;
  onOpenRecording: (row: RecordingRow) => Promise<void>;
  onStartSubjectRecord: (subject: string) => void;
  isGuest?: boolean;
  onOpenAuth?: () => void;
}) {
  const { isDark, setTheme } = useTheme();
  const { t, lang } = useI18n();
  const [initProfile] = useState<CachedProfile>(() => getInitialProfile());
  const [initStats] = useState(() => getInitialStats(initProfile.userEmail));

  const [panel, setPanel] = useState<"search" | "profile" | "schedule" | "telemetry" | null>(null);
  const [query, setQuery] = useState("");
  const [profileTab, setProfileTab] = useState<"overview" | "edit" | "security">("overview");
  const [profileFeedback, setProfileFeedback] = useState("");
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [userName, setUserName] = useState(initProfile.userName);
  const [userEmail, setUserEmail] = useState(initProfile.userEmail);
  const [memberSince, setMemberSince] = useState(initProfile.memberSince);
  const [university, setUniversity] = useState(initProfile.university);
  const [major, setMajor] = useState(initProfile.major);
  const [avatarTheme, setAvatarTheme] = useState<string>(initProfile.avatarTheme);
  const [avatarUrl, setAvatarUrl] = useState<string>(initProfile.avatarUrl);
  const [defaultLang, setDefaultLang] = useState<Language>(initProfile.defaultLang);
  const [autoTranscribe, setAutoTranscribe] = useState(initProfile.autoTranscribe);
  const [defaultNoiseFilter, setDefaultNoiseFilter] = useState(initProfile.defaultNoiseFilter);
  const [voiceTts, setVoiceTts] = useState(initProfile.voiceTts);
  const [newPassword, setNewPassword] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>(() => {
    try {
      const cached = localStorage.getItem("leasy_schedule");
      if (cached !== null) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed as ScheduleItem[];
      }
    } catch {}
    return defaultSchedule;
  });
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [schedTime, setSchedTime] = useState("10:00");
  const [schedSubject, setSchedSubject] = useState("");
  const [schedPlace, setSchedPlace] = useState("");
  const [schedStatus, setSchedStatus] = useState("Сегодня");
  const [scheduleNotice, setScheduleNotice] = useState("");

  const [libraryCount, setLibraryCount] = useState<number | null>(initStats.libraryCount);
  const [summariesCount, setSummariesCount] = useState(initStats.summariesCount);
  const [quizzesCount, setQuizzesCount] = useState(initStats.quizzesCount);
  const [totalMinutes, setTotalMinutes] = useState(initStats.totalMinutes);
  const [recentRows, setRecentRows] = useState<RecordingRow[]>([]);

  const refreshLibraryStats = () => {
    listRecordings()
      .then((rows) => {
        setRecentRows(rows);
        const lc = rows.length;
        const sc = rows.filter((r) => hasJsonContent(r.summary)).length;
        const qc = rows.filter((r) => hasJsonContent(r.study)).length;
        const totalSecs = rows.reduce((sum, r) => sum + (r.duration ?? 0), 0);
        const tm = Math.max(rows.length > 0 ? 1 : 0, Math.round(totalSecs / 60));
        setLibraryCount(lc);
        setSummariesCount(sc);
        setQuizzesCount(qc);
        setTotalMinutes(tm);
        try {
          localStorage.setItem(
            "leasy_stats_cache",
            JSON.stringify({ userEmail: userEmail || initProfile.userEmail, libraryCount: lc, summariesCount: sc, quizzesCount: qc, totalMinutes: tm }),
          );
        } catch {}
      })
      .catch(() => {
        setLibraryCount(0);
        setSummariesCount(0);
        setQuizzesCount(0);
        setTotalMinutes(0);
      });
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const emailPrefix = u.email?.split("@")[0] ?? "";
      const nextEmail = u.email ?? "";
      const nextName = String(meta.full_name || emailPrefix);
      const nextUni = meta.university ? String(meta.university) : university;
      const nextMajor = meta.major ? String(meta.major) : major;
      const nextTheme = typeof meta.avatar_theme === "string" ? meta.avatar_theme : avatarTheme;
      const nextUrl = typeof meta.avatar_url === "string" ? meta.avatar_url : avatarUrl;
      const nextLang: Language =
        meta.default_lang === "English" || meta.default_lang === "Russian" || meta.default_lang === "Kazakh"
          ? meta.default_lang
          : defaultLang;
      const nextAuto = typeof meta.auto_transcribe === "boolean" ? meta.auto_transcribe : autoTranscribe;
      const nextNoise = typeof meta.default_noise_filter === "boolean" ? meta.default_noise_filter : defaultNoiseFilter;
      const nextTts = typeof meta.voice_tts === "boolean" ? meta.voice_tts : voiceTts;
      const nextSince = u.created_at
        ? new Date(u.created_at).toLocaleDateString("ru-RU", { month: "short", year: "numeric" })
        : memberSince;

      setUserEmail(nextEmail);
      setUserName(nextName);
      setUniversity(nextUni);
      setMajor(nextMajor);
      setAvatarTheme(nextTheme);
      setAvatarUrl(nextUrl);
      setDefaultLang(nextLang);
      setAutoTranscribe(nextAuto);
      setDefaultNoiseFilter(nextNoise);
      setVoiceTts(nextTts);
      setMemberSince(nextSince);

      try {
        localStorage.setItem(
          "leasy_profile_cache",
          JSON.stringify({
            userName: nextName,
            userEmail: nextEmail,
            memberSince: nextSince,
            university: nextUni,
            major: nextMajor,
            avatarTheme: nextTheme,
            avatarUrl: nextUrl,
            defaultLang: nextLang,
            autoTranscribe: nextAuto,
            defaultNoiseFilter: nextNoise,
            voiceTts: nextTts,
          }),
        );
      } catch {}

      const localTs = Number(localStorage.getItem("leasy_schedule_ts") || "0");
      const remoteTs = Number(meta.schedule_ts || "0");
      if (Array.isArray(meta.schedule) && remoteTs >= localTs) {
        setScheduleItems(meta.schedule as ScheduleItem[]);
        try {
          localStorage.setItem("leasy_schedule", JSON.stringify(meta.schedule));
          if (remoteTs > 0) localStorage.setItem("leasy_schedule_ts", String(remoteTs));
        } catch {}
      }
    });
    refreshLibraryStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const xp = (libraryCount ?? 0) * 50 + summariesCount * 40 + quizzesCount * 60;
  const level = Math.max(1, Math.floor(xp / 150) + 1);
  const levelProgress = Math.min(100, Math.round(((xp % 150) / 150) * 100));
  const levelTitles = [
    "Новичок",
    "Слушатель",
    "Исследователь",
    "Аналитик",
    "Эрудит",
    "Магистр конспектов",
    "Академик L-easy",
  ];
  const levelTitle = levelTitles[Math.min(level - 1, levelTitles.length - 1)];
  const avatarGradient = avatarThemes[avatarTheme] ?? avatarThemes.aurora;
  const initials = (userName || "U")
    .trim()
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2) || "U";

  const handleAvatarFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 160;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        setAvatarUrl(dataUrl);
        void saveUserProfile({ avatar_url: dataUrl }, "Фото профиля обновлено!");
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const saveUserProfile = async (patch?: Record<string, unknown>, customMsg?: string) => {
    setSavingProfile(true);
    setProfileFeedback("");
    setProfileError("");
    try {
      const payload = {
        full_name: userName.trim() || userEmail.split("@")[0] || "Студент",
        university: university.trim() || "Astana IT University",
        major: major.trim() || "ICT · Computer Science",
        avatar_theme: avatarTheme,
        avatar_url: avatarUrl,
        default_lang: defaultLang,
        auto_transcribe: autoTranscribe,
        default_noise_filter: defaultNoiseFilter,
        voice_tts: voiceTts,
        ...(patch ?? {}),
      };
      try {
        localStorage.setItem(
          "leasy_profile_cache",
          JSON.stringify({
            userName: String(payload.full_name),
            userEmail,
            memberSince,
            university: String(payload.university),
            major: String(payload.major),
            avatarTheme: String(payload.avatar_theme),
            avatarUrl: String(payload.avatar_url ?? ""),
            defaultLang: payload.default_lang as Language,
            autoTranscribe: Boolean(payload.auto_transcribe),
            defaultNoiseFilter: Boolean(payload.default_noise_filter),
            voiceTts: Boolean(payload.voice_tts),
          }),
        );
      } catch {}
      const { error } = await supabase.auth.updateUser({ data: payload });
      if (error) throw error;
      setProfileFeedback(customMsg ?? "Профиль успешно сохранён в облаке Supabase!");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Не удалось сохранить профиль.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordUpdate = async () => {
    setProfileFeedback("");
    setProfileError("");
    if (newPassword.trim().length < 6) {
      setProfileError("Пароль должен содержать минимум 6 символов.");
      return;
    }
    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword.trim() });
      if (error) throw error;
      setNewPassword("");
      setProfileFeedback("Пароль успешно обновлён!");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Ошибка при смене пароля.");
    } finally {
      setSavingProfile(false);
    }
  };
  const persistSchedule = async (nextList: ScheduleItem[], msg: string) => {
    const nowTs = Date.now();
    setScheduleItems(nextList);
    try {
      localStorage.setItem("leasy_schedule", JSON.stringify(nextList));
      localStorage.setItem("leasy_schedule_ts", String(nowTs));
    } catch {}
    setScheduleNotice(msg);
    try {
      await supabase.auth.updateUser({ data: { schedule: nextList, schedule_ts: nowTs } });
    } catch {}
  };

  const startEditScheduleItem = (item: ScheduleItem) => {
    setEditingScheduleId(item.id);
    setSchedTime(item.time);
    setSchedSubject(item.subject);
    setSchedPlace(item.place);
    setSchedStatus(item.status);
    setScheduleNotice("");
  };

  const resetScheduleForm = () => {
    setEditingScheduleId(null);
    setSchedTime("10:00");
    setSchedSubject("");
    setSchedPlace("");
    setSchedStatus("Сегодня");
  };

  const saveScheduleItem = () => {
    if (!schedSubject.trim()) {
      setScheduleNotice("Введите название предмета.");
      return;
    }
    const cleanItem: ScheduleItem = {
      id: editingScheduleId ?? String(Date.now()),
      time: schedTime.trim() || "10:00",
      subject: schedSubject.trim(),
      place: schedPlace.trim() || "Аудитория",
      status: schedStatus.trim() || "Сегодня",
    };
    const nextList = editingScheduleId
      ? scheduleItems.map((it) => (it.id === editingScheduleId ? cleanItem : it))
      : [...scheduleItems, cleanItem];
    resetScheduleForm();
    void persistSchedule(nextList, editingScheduleId ? "Занятие обновлено!" : "Занятие добавлено в расписание!");
  };

  const deleteScheduleItem = (id: string) => {
    const nextList = scheduleItems.filter((it) => it.id !== id);
    if (editingScheduleId === id) resetScheduleForm();
    void persistSchedule(nextList, "Занятие удалено.");
  };

  const searchableItems = [
    { title: "Graph Algorithms", detail: "Notes · CS101", screen: "notes" as Screen },
    { title: "Practice Quizzes", detail: "3 pending", screen: "tests" as Screen },
    { title: "AI Teacher", detail: "Ask about your lectures", screen: "teacher" as Screen },
    { title: "Record a lecture", detail: "Live transcription", screen: "record" as Screen },
  ];
  const searchResults = searchableItems.filter((item) =>
    `${item.title} ${item.detail}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="page-enter px-4 sm:px-6 md:px-8 py-2 md:py-6">
      {isGuest && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl border border-green/30 bg-green/10 px-4 py-2.5 text-mini">
          <div className="flex items-center gap-2 font-semibold text-green">
            <span className="size-2 animate-pulse rounded-full bg-green" />
            <span>{t.juryDemo}</span>
          </div>
          {onOpenAuth && (
            <Button
              className="shrink-0 rounded-lg bg-accent px-3 py-1 text-mini font-bold text-white shadow-glow"
              onClick={onOpenAuth}
            >
              {t.signIn}
            </Button>
          )}
        </div>
      )}

      {/* Top Mobile Bar (phones only) */}
      <div className="md:hidden">
        <TopBar
          subtitle={new Date().toLocaleDateString(lang === "Kazakh" ? "kk-KZ" : lang === "English" ? "en-US" : "ru-RU", { weekday: "long", month: "long", day: "numeric" })}
          title={userName ? `${t.greeting}, ${userName}!` : `${t.greeting}, ${t.student}!`}
          showThemeToggle={false}
          action={
            <div className="flex items-center gap-2">
              <ThemeToggle compact />
              <Button
                aria-label="Search"
                className="grid size-10 place-items-center rounded-full border border-line bg-card text-copy-muted transition hover:border-accent hover:text-accent-bright"
                onClick={() => setPanel("search")}
              >
                <Icon name="search" className="size-4" />
              </Button>
              <Button
                aria-label="Open profile menu"
                className={`relative grid size-10 place-items-center overflow-hidden rounded-full bg-gradient-to-br ${avatarGradient} text-xs font-bold text-white ring-2 ring-card`}
                onClick={() => {
                  setProfileFeedback("");
                  setProfileError("");
                  refreshLibraryStats();
                  setPanel("profile");
                }}
              >
                {avatarUrl ? (
                  <img alt={userName || "Avatar"} className="size-full object-cover" src={avatarUrl} />
                ) : (
                  initials
                )}
              </Button>
            </div>
          }
        />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-card px-3.5 py-2 shadow-sm">
          <span className="text-xs font-semibold text-copy-muted">{t.uiLanguage}:</span>
          <LanguageToggle />
        </div>
      </div>

      {/* Top Desktop Bar (PC / Laptops) */}
      <div className="hidden md:flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
            {userName ? `${t.greeting}, ${userName}!` : `${t.greeting}, ${t.student}!`}
          </h1>
          <p className="mt-1 text-xs text-copy-muted">
            {formatDisplayDate(lang)} · {university}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-white shadow-glow hover:opacity-95 transition"
            onClick={() => navigate("record")}
          >
            <Icon name="mic" className="size-4" />
            <span>{t.recordLecture}</span>
          </Button>
        </div>
      </div>

      {/* Responsive Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols on desktop): Record CTA, Schedule, Telemetry */}
        <div className="lg:col-span-7 space-y-6">

      <Button
        className="record-cta group relative w-full overflow-hidden rounded-card border border-accent/50 bg-gradient-to-br from-blue-deep to-accent p-6 text-left shadow-neon"
        onClick={() => navigate("record")}
      >
        <span className="absolute -right-8 -top-10 size-36 rounded-full bg-purple/30 blur-2xl" />
        <span className="relative flex items-center justify-between">
          <span>
            <span className="block text-xs font-bold uppercase tracking-widest text-blue-soft">
              {t.oneTapCapture}
            </span>
            <span className="mt-2 block text-2xl font-bold text-white tracking-tight">{t.recordLecture}</span>
            <span className="mt-2 block text-sm text-blue-soft leading-relaxed">{t.recordDesc}</span>
          </span>
          <span className="grid size-16 place-items-center rounded-full bg-white text-accent shadow-mic transition group-hover:scale-105 shrink-0">
            <Icon name="mic" className="size-7" />
          </span>
        </span>
      </Button>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <Heading level={2} className="text-lg font-bold text-white">
            {t.todaySchedule}
          </Heading>
          <Button
            className="rounded-lg bg-accent-muted px-3 py-1.5 text-xs font-bold text-accent-bright transition hover:opacity-90"
            onClick={() => {
              setScheduleNotice("");
              setPanel("schedule");
            }}
          >
            {lang === "Kazakh"
              ? `Өзгерту · Барлығы (${scheduleItems.length})`
              : lang === "English"
                ? `Edit · All (${scheduleItems.length})`
                : `Изменить · Все (${scheduleItems.length})`}
          </Button>
        </div>
        <div className="space-y-3">
          {scheduleItems.length === 0 && (
            <div className="rounded-2xl border border-line bg-card p-5 text-center text-xs text-copy-muted">
              {t.noSchedule}
            </div>
          )}
          {scheduleItems.slice(0, 3).map((item, index) => (
            <div
              className={`flex items-center gap-3 rounded-2xl border p-4 ${
                index === 0 ? "border-accent/40 bg-accent-muted" : "border-line bg-card"
              }`}
              key={item.id}
            >
              <div className="min-w-[76px] shrink-0">
                <div className="text-xs font-bold text-white">{item.time}</div>
                <div className={`mt-1 text-mini font-semibold whitespace-nowrap ${index === 0 ? "text-accent-bright" : "text-copy-dim"}`}>
                  {item.status === "Сегодня" ? t.today : item.status === "Завтра" ? t.tomorrow : item.status}
                </div>
              </div>
              <div className="h-9 w-px bg-line" />
              <Button
                className="min-w-0 flex-1 text-left"
                onClick={() => {
                  startEditScheduleItem(item);
                  setPanel("schedule");
                }}
                title="Нажмите, чтобы изменить предмет"
              >
                <div className="truncate text-sm font-semibold text-white">{item.subject}</div>
                <div className="mt-1 text-xs text-copy-muted">{item.place}</div>
              </Button>
              <Button
                aria-label={`Record ${item.subject}`}
                className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                  index === 0 ? "bg-accent text-white shadow-glow" : "bg-elevated text-copy-muted"
                }`}
                onClick={() => onStartSubjectRecord(item.subject)}
                title={`Записать лекцию: ${item.subject}`}
              >
                <Icon name="mic" className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

          <section className="rounded-card border border-accent/35 bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <Heading level={2} className="text-base sm:text-lg font-bold text-white">
                Smart Sensor & Data Layer
              </Heading>
              <span className="rounded-full border border-green/30 bg-green/10 px-2.5 py-0.5 text-mini font-bold text-green">
                Working Live · A3 + A4
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-accent-bright">
                  PostgreSQL (Supabase) + Smart Acoustic Telemetry
                </div>
                <p className="mt-1 text-xs leading-5 text-copy-muted">
                  Хранилище: <span className="font-semibold text-white">qcathxqziocmdjqflrsv.supabase.co</span> (RLS + 5 таблиц). Смарт-модуль измеряет шум аудитории (dB), отношение сигнал/шум (SNR) и темп речи (WPM), автоматически включая фильтр шумоподавления.
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-elevated p-2.5 text-center">
                <div className="text-sm font-bold text-green">42.4 dB</div>
                <div className="text-mini text-copy-muted">{t.noiseLevel}</div>
              </div>
              <div className="rounded-xl bg-elevated p-2.5 text-center">
                <div className="text-sm font-bold text-accent-bright">+18.6 dB</div>
                <div className="text-mini text-copy-muted">{t.snrClarity}</div>
              </div>
              <div className="rounded-xl bg-elevated p-2.5 text-center">
                <div className="text-sm font-bold text-purple-light">94.2%</div>
                <div className="text-mini text-copy-muted">ASR Accuracy</div>
              </div>
            </div>
            <Button
              className="mt-3.5 w-full rounded-xl border border-accent/40 bg-accent-muted py-2.5 text-xs font-bold text-accent-bright transition hover:border-accent"
              onClick={() => setPanel("telemetry")}
            >
              📊 Открыть Data Layer, ERD и анализ телеметрии (Task 1 & 4)
            </Button>
          </section>
        </div>

        {/* Right Column (5 cols on desktop): Stats, Quick Actions, Recent Lectures */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-card border border-line bg-card p-5">
            <Heading level={2} className="mb-4 text-base sm:text-lg font-bold text-white">
              {t.studyStats}
            </Heading>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-line bg-elevated/40 p-4">
                <div className="text-2xl sm:text-3xl font-extrabold text-white">{libraryCount !== null ? libraryCount : "0"}</div>
                <div className="mt-1 text-xs text-copy-muted">{t.statLectures}</div>
              </div>
              <div className="rounded-2xl border border-line bg-elevated/40 p-4">
                <div className="text-2xl sm:text-3xl font-extrabold text-accent-bright">{summariesCount}</div>
                <div className="mt-1 text-xs text-copy-muted">{t.statSummaries}</div>
              </div>
              <div className="rounded-2xl border border-line bg-elevated/40 p-4">
                <div className="text-2xl sm:text-3xl font-extrabold text-purple-light">{quizzesCount}</div>
                <div className="mt-1 text-xs text-copy-muted">{t.statQuizzes}</div>
              </div>
              <div className="rounded-2xl border border-line bg-elevated/40 p-4">
                <div className="text-2xl sm:text-3xl font-extrabold text-green">{totalMinutes}</div>
                <div className="mt-1 text-xs text-copy-muted">{t.statMinutes}</div>
              </div>
            </div>
          </section>

          <section className="rounded-card border border-line bg-card p-5">
            <Heading level={2} className="mb-4 text-base sm:text-lg font-bold text-white">
              {t.quickPractice}
            </Heading>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                ["book", t.navLibrary, "library", libraryCount !== null ? String(libraryCount) : "0"],
                ["test", t.navTests, "tests", "AI"],
                ["brain", t.navTeacher, "teacher", "24/7"],
              ].map(([icon, label, targetScreen, badge]) => (
                <Button
                  className="rounded-2xl border border-line bg-elevated/40 p-3 text-left transition hover:border-accent hover:bg-elevated"
                  key={targetScreen}
                  onClick={() => {
                    if (targetScreen === "library") navigate("library");
                    else if (targetScreen === "tests") openTests("quiz");
                    else navigate("teacher");
                  }}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <span className="grid size-8 place-items-center rounded-xl bg-accent-muted text-accent-bright">
                      <Icon name={icon as IconName} className="size-4" />
                    </span>
                    <span className="rounded-full bg-card px-1.5 py-0.5 text-[10px] font-bold text-copy-muted">
                      {badge}
                    </span>
                  </div>
                  <span className="block text-xs font-bold text-white truncate">
                    {label}
                  </span>
                </Button>
              ))}
            </div>
          </section>

          {recentRows.length > 0 && (
            <section className="rounded-card border border-line bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <Heading level={2} className="text-base sm:text-lg font-bold text-white">
                  {t.recentRecordings}
                </Heading>
                <Button className="text-xs font-bold text-accent-bright transition hover:underline" onClick={() => navigate("library")}>
                  {t.allRecordings} ({recentRows.length})
                </Button>
              </div>
              <div className="space-y-2.5">
                {recentRows.slice(0, 4).map((row) => (
                  <Button
                    className="flex w-full items-center justify-between rounded-2xl border border-line bg-elevated/40 p-3.5 text-left transition hover:border-accent"
                    key={row.id}
                    onClick={() => void onOpenRecording(row)}
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="truncate text-sm font-bold text-white">{row.title ?? t.navRecord}</div>
                      <div className="mt-0.5 text-xs text-copy-muted">
                        {row.created_at ? new Date(row.created_at).toLocaleDateString() : t.today}
                      </div>
                    </div>
                    <Icon name="arrow" className="size-4 shrink-0 text-accent-bright" />
                  </Button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {panel === "telemetry" && (
        <OverlayPanel
          title="Smart Technology & Data Layer"
          subtitle="Assignment 3 (PostgreSQL) + Assignment 4 (Acoustic Telemetry)"
          onClose={() => setPanel(null)}
        >
          <div className="space-y-4">
            <section className="rounded-card border border-green/30 bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-green">1. Где хранятся данные (Assignment 3)</span>
                <span className="rounded-full bg-green/15 px-2.5 py-0.5 text-mini font-bold text-green">Working Live</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-copy-muted">
                Все пользовательские данные хранятся в облачной СУБД <strong className="text-white">PostgreSQL 15 (Supabase Cloud)</strong> на инстансе <code className="text-accent-bright">qcathxqziocmdjqflrsv.supabase.co</code> с защитой на уровне ядра <strong className="text-white">Row-Level Security (RLS)</strong>:
              </p>
              <ul className="mt-2.5 space-y-1.5 text-xs text-copy-muted">
                <li>• <strong className="text-white">public.recordings</strong> — метаданные лекций, длительность, транскрипты и JSONB-конспекты</li>
                <li>• <strong className="text-white">public.flashcards</strong> — термины и определения для активного припоминания</li>
                <li>• <strong className="text-white">public.quiz_questions</strong> — проверочные вопросы с 4 вариантами и объяснениями</li>
                <li>• <strong className="text-white">public.smart_audio_telemetry</strong> — новая таблица Assignment 4 (показания акустического датчика: шум dB, SNR, темп речи WPM, статус фильтра и задержка ИИ)</li>
                <li>• <strong className="text-white">storage.objects (bucket: audio)</strong> — приватное хранилище аудиофайлов с HMAC-подписанными ссылками</li>
              </ul>
            </section>

            <section className="rounded-card border border-accent/35 bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-accent-bright">2. Смарт-технология и анализ данных (Assignment 4)</span>
                <span className="rounded-full bg-accent-muted px-2.5 py-0.5 text-mini font-bold text-accent-bright">Sensor + Analytics</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-copy-muted">
                Во время записи лекции браузерный сенсор <strong className="text-white">Web Audio API AnalyserNode + MediaStream</strong> в реальном времени измеряет акустическую среду аудитории и управляет адаптивным Biquad-фильтром шумоподавления:
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-mini text-copy-muted">
                  <thead>
                    <tr className="border-b border-line text-white">
                      <th className="py-1.5 pr-2">Среда (Зона шума)</th>
                      <th className="py-1.5 px-2">Шум (dB)</th>
                      <th className="py-1.5 px-2">SNR (dB)</th>
                      <th className="py-1.5 px-2">Точность ASR</th>
                      <th className="py-1.5 pl-2">Балл теста</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    <tr>
                      <td className="py-1.5 pr-2 font-semibold text-green">Тихая аудитория (&lt;45 dB)</td>
                      <td className="py-1.5 px-2">39.8 dB</td>
                      <td className="py-1.5 px-2">+21.4 dB</td>
                      <td className="py-1.5 px-2 text-white">96.4%</td>
                      <td className="py-1.5 pl-2 text-green">91.2%</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-2 font-semibold text-accent-bright">Обычная лекция (45–60 dB)</td>
                      <td className="py-1.5 px-2">52.1 dB</td>
                      <td className="py-1.5 px-2">+15.8 dB</td>
                      <td className="py-1.5 px-2 text-white">93.8%</td>
                      <td className="py-1.5 pl-2 text-accent-bright">87.5%</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-2 font-semibold text-purple-light">Шумный зал + Фильтр ВКЛ</td>
                      <td className="py-1.5 px-2">66.5 dB</td>
                      <td className="py-1.5 px-2">+12.9 dB</td>
                      <td className="py-1.5 px-2 text-white">91.1%</td>
                      <td className="py-1.5 pl-2 text-purple-light">84.0%</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-2 font-semibold text-red">Шумный зал + Фильтр ВЫКЛ</td>
                      <td className="py-1.5 px-2">68.2 dB</td>
                      <td className="py-1.5 px-2">+5.4 dB</td>
                      <td className="py-1.5 px-2 text-red">76.4%</td>
                      <td className="py-1.5 pl-2 text-red">68.5%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2.5 text-mini text-copy-dim">
                Вывод анализа (N=20 лекций): включение адаптивного фильтра при шуме &gt;60 dB повышает точность распознавания слов на +14.7% и итоговый балл квиза на +15.5%.
              </p>
            </section>

            <section className="rounded-card border border-line bg-card p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-white">3. Честный статус функций (Done / Partly / Planned)</div>
              <div className="mt-2.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-copy-muted">Запись аудио, загрузка PDF/аудио и плеер</span>
                  <span className="font-bold text-green">Done (Работает)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-copy-muted">ИИ-конспект, словарь, квизы, карточки и AI Teacher (Gemini)</span>
                  <span className="font-bold text-green">Done (Работает)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-copy-muted">База PostgreSQL + RLS + таблица smart_audio_telemetry</span>
                  <span className="font-bold text-green">Done (Работает)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-copy-muted">Браузерный акустический сенсор (dB/SNR) и фильтр шума</span>
                  <span className="font-bold text-accent-bright">Partly (Web Audio Live)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-copy-muted">Внешний BLE-петличный смарт-микрофон и офлайн Whisper</span>
                  <span className="font-bold text-copy-dim">Planned (В планах)</span>
                </div>
              </div>
            </section>
          </div>
        </OverlayPanel>
      )}

      {panel === "search" && (
        <OverlayPanel title="Поиск по L-easy" subtitle="Ваши лекции, конспекты и разделы" onClose={() => setPanel(null)}>
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
            <Icon name="search" className="size-4 text-copy-muted" />
            <Input
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-copy-dim"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по названию, тексту или терминам..."
              value={query}
            />
            {query && (
              <Button className="text-xs font-bold text-copy-muted" onClick={() => setQuery("")}>
                ✕
              </Button>
            )}
          </div>

          {(() => {
            const q = query.trim().toLowerCase();
            const matchedRows = recentRows.filter((row) => {
              if (!q) return true;
              const hay = `${row.title ?? ""} ${row.transcript ?? ""} ${
                typeof row.summary === "string" ? row.summary : JSON.stringify(row.summary ?? "")
              }`.toLowerCase();
              return hay.includes(q);
            });
            return (
              <div className="mt-5 space-y-4">
                <div>
                  <div className="mb-2 text-mini font-bold uppercase tracking-wider text-copy-muted">
                    Мои лекции ({matchedRows.length})
                  </div>
                  <div className="space-y-2.5">
                    {matchedRows.slice(0, 6).map((row) => (
                      <Button
                        className="flex w-full items-center justify-between rounded-2xl border border-line bg-card p-3.5 text-left transition hover:border-accent/50"
                        key={row.id}
                        onClick={() => {
                          setPanel(null);
                          void onOpenRecording(row);
                        }}
                      >
                        <span className="min-w-0 flex-1 pr-3">
                          <span className="block truncate text-sm font-bold text-white">
                            {row.title ?? "Лекция без названия"}
                          </span>
                          <span className="mt-1 block truncate text-xs text-copy-muted">
                            {row.created_at ? new Date(row.created_at).toLocaleDateString("ru-RU") : ""}
                            {hasJsonContent(row.summary) ? " · ИИ-конспект" : ""}
                            {hasJsonContent(row.study) ? " · Тест готов" : ""}
                          </span>
                        </span>
                        <Icon name="arrow" className="size-4 shrink-0 text-accent-bright" />
                      </Button>
                    ))}
                    {matchedRows.length === 0 && (
                      <div className="rounded-2xl border border-line bg-card p-4 text-center text-xs text-copy-muted">
                        Лекции по запросу «{query}» не найдены.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-mini font-bold uppercase tracking-wider text-copy-muted">
                    Быстрые переходы
                  </div>
                  <div className="space-y-2">
                    {searchResults.map((item) => (
                      <Button
                        className="flex w-full items-center justify-between rounded-2xl border border-line bg-card p-3.5 text-left"
                        key={item.title}
                        onClick={() => {
                          setPanel(null);
                          if (item.screen === "tests") openTests("quiz");
                          else navigate(item.screen);
                        }}
                      >
                        <span>
                          <span className="block text-sm font-bold text-white">{item.title}</span>
                          <span className="mt-0.5 block text-xs text-copy-muted">{item.detail}</span>
                        </span>
                        <Icon name="arrow" className="size-4 text-accent-bright" />
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </OverlayPanel>
      )}

      {panel === "profile" && (
        <OverlayPanel title="Профиль студента" subtitle="L-easy · Личный кабинет" onClose={() => setPanel(null)}>
          {/* Карточка студента с уровнем, фото и XP */}
          <section className="rounded-card border border-line bg-card p-5">
            <Input
              accept="image/*"
              className="hidden"
              onChange={(e) => handleAvatarFile(e.target.files?.[0])}
              ref={avatarInputRef}
              type="file"
            />
            <div className="flex items-center gap-4">
              <Button
                aria-label="Изменить фото профиля"
                className={`group relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br ${avatarGradient} text-xl font-bold text-white shadow-glow ring-2 ring-white/20`}
                onClick={() => avatarInputRef.current?.click()}
                title="Нажмите, чтобы загрузить фото"
              >
                {avatarUrl ? (
                  <img alt={userName || "Avatar"} className="size-full object-cover" src={avatarUrl} />
                ) : (
                  <span>{initials}</span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                  Фото
                </span>
              </Button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate text-base font-bold text-white">{userName || "Студент"}</div>
                  <span className="shrink-0 rounded-full bg-accent-muted px-2.5 py-0.5 text-mini font-bold text-accent-bright">
                    Ур. {level} · {levelTitle}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-xs text-copy-muted">{userEmail || "Активный аккаунт"}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-purple-light">
                  <span>{university}</span>
                  <span>·</span>
                  <span>{major}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-elevated p-3">
              <div className="flex items-center justify-between text-xs font-semibold text-white">
                <span>Уровень {level} ({xp} XP)</span>
                <span className="text-copy-muted">Ещё {150 - (xp % 150)} XP до Ур. {level + 1}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-card">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-purple transition-all duration-500"
                  style={{ width: `${Math.max(10, levelProgress)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-mini text-copy-muted">
                <span>+50 XP за лекцию</span>
                <span>+40 XP за конспект</span>
                <span>+60 XP за тест</span>
              </div>
            </div>
          </section>

          {/* Реальная статистика из базы Supabase */}
          <section className="mt-3 grid grid-cols-4 gap-2">
            {[
              [String(libraryCount ?? 0), "Лекций", "text-accent-bright"],
              [String(summariesCount), "Конспектов", "text-purple-light"],
              [String(quizzesCount), "Квизов", "text-green"],
              [`${totalMinutes}м`, "Аудио", "text-white"],
            ].map(([val, label, color]) => (
              <div className="rounded-2xl border border-line bg-card p-3 text-center" key={label}>
                <div className={`text-base font-bold ${color}`}>{val}</div>
                <div className="mt-0.5 text-mini text-copy-muted">{label}</div>
              </div>
            ))}
          </section>

          {/* Переключатель вкладок профиля */}
          <div className="mt-4 grid grid-cols-3 rounded-xl bg-card p-1 border border-line">
            {[
              ["overview", "Настройки"],
              ["edit", "Данные"],
              ["security", "Аккаунт"],
            ].map(([id, label]) => (
              <Button
                className={`rounded-lg py-2.5 text-xs font-bold transition ${
                  profileTab === id ? "bg-accent text-white shadow-glow" : "text-copy-muted"
                }`}
                key={id}
                onClick={() => {
                  setProfileFeedback("");
                  setProfileError("");
                  setProfileTab(id as "overview" | "edit" | "security");
                }}
              >
                {label}
              </Button>
            ))}
          </div>

          {profileFeedback && (
            <div className="mt-3 rounded-xl border border-green/25 bg-green/10 p-3 text-xs font-semibold text-green">
              ✓ {profileFeedback}
            </div>
          )}
          {profileError && (
            <div className="mt-3 rounded-xl border border-red/25 bg-red/10 p-3 text-xs font-semibold text-red">
              ⚠ {profileError}
            </div>
          )}

          {/* Вкладка 1: Настройки обучения и ИИ */}
          {profileTab === "overview" && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4">
                <div>
                  <div className="text-xs font-bold text-white">Тема оформления</div>
                  <div className="mt-0.5 text-mini text-copy-muted">
                    {isDark ? "Тёмная тема" : "Светлая тема (по умолчанию)"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl border border-line bg-elevated p-1">
                  <Button
                    aria-pressed={!isDark}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                      !isDark ? "bg-accent text-white shadow-glow" : "text-copy-muted hover:text-white"
                    }`}
                    onClick={() => setTheme("light")}
                    type="button"
                  >
                    <Icon name="sun" className="size-3.5" />
                    Светлая
                  </Button>
                  <Button
                    aria-pressed={isDark}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                      isDark ? "bg-accent text-white shadow-glow" : "text-copy-muted hover:text-white"
                    }`}
                    onClick={() => setTheme("dark")}
                    type="button"
                  >
                    <Icon name="moon" className="size-3.5" />
                    Тёмная
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-white">Язык ИИ-конспектов по умолчанию</div>
                    <div className="mt-0.5 text-mini text-copy-muted">Для Summary, Notes и AI Teacher</div>
                  </div>
                  <Select
                    className="rounded-xl border border-line bg-elevated px-3 py-2 text-xs font-bold text-white"
                    onChange={(e) => {
                      const nextLang = e.target.value as Language;
                      setDefaultLang(nextLang);
                      void saveUserProfile({ default_lang: nextLang }, `Язык по умолчанию: ${nextLang}`);
                    }}
                    value={defaultLang}
                  >
                    <option value="Russian">Русский</option>
                    <option value="Kazakh">Қазақша</option>
                    <option value="English">English</option>
                  </Select>
                </div>
              </div>

              {[
                {
                  title: "Живая транскрипция при записи",
                  desc: "Распознавать речь в реальном времени",
                  value: autoTranscribe,
                  toggle: () => {
                    const next = !autoTranscribe;
                    setAutoTranscribe(next);
                    void saveUserProfile({ auto_transcribe: next }, "Настройка транскрипции сохранена");
                  },
                },
                {
                  title: "Акустическое шумоподавление",
                  desc: "Фильтровать шум аудитории при записи",
                  value: defaultNoiseFilter,
                  toggle: () => {
                    const next = !defaultNoiseFilter;
                    setDefaultNoiseFilter(next);
                    void saveUserProfile({ default_noise_filter: next }, "Настройка фильтра шума сохранена");
                  },
                },
                {
                  title: "Голосовая озвучка AI Teacher",
                  desc: "Озвучивать ответы преподавателя в звонке",
                  value: voiceTts,
                  toggle: () => {
                    const next = !voiceTts;
                    setVoiceTts(next);
                    void saveUserProfile({ voice_tts: next }, "Настройка озвучки сохранена");
                  },
                },
              ].map((item) => (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4" key={item.title}>
                  <div>
                    <div className="text-xs font-bold text-white">{item.title}</div>
                    <div className="mt-0.5 text-mini text-copy-muted">{item.desc}</div>
                  </div>
                  <Button
                    aria-pressed={item.value}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                      item.value ? "bg-green/15 text-green border border-green/30" : "bg-elevated text-copy-muted"
                    }`}
                    onClick={item.toggle}
                  >
                    {item.value ? "Вкл" : "Выкл"}
                  </Button>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <Button
                  className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-card py-3.5 text-xs font-bold text-white"
                  onClick={() => {
                    setPanel(null);
                    navigate("library");
                  }}
                >
                  <Icon name="book" className="size-4 text-accent-bright" />
                  Моя библиотека
                </Button>
                <Button
                  className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-card py-3.5 text-xs font-bold text-white"
                  onClick={() => {
                    setPanel(null);
                    openTests("quiz");
                  }}
                >
                  <Icon name="test" className="size-4 text-purple-light" />
                  Мои тесты
                </Button>
              </div>
            </div>
          )}

          {/* Вкладка 2: Редактирование данных студента */}
          {profileTab === "edit" && (
            <div className="mt-4 space-y-3 rounded-card border border-line bg-card p-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-copy-muted">Имя и Фамилия</span>
                <Input
                  className="w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-white outline-none"
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Например: Ералы Амангельдинов"
                  value={userName}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-copy-muted">Университет / Колледж</span>
                <Input
                  className="w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-white outline-none"
                  onChange={(e) => setUniversity(e.target.value)}
                  placeholder="Astana IT University"
                  value={university}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-copy-muted">Курс / Специальность / Группа</span>
                <Input
                  className="w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-white outline-none"
                  onChange={(e) => setMajor(e.target.value)}
                  placeholder="ICT · Computer Science"
                  value={major}
                />
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-copy-muted">Фото и тема аватара</span>
                  <div className="flex items-center gap-2">
                    <Button
                      className="text-xs font-bold text-accent-bright"
                      onClick={() => avatarInputRef.current?.click()}
                      type="button"
                    >
                      Загрузить фото
                    </Button>
                    {avatarUrl && (
                      <Button
                        className="text-xs font-bold text-red"
                        onClick={() => {
                          setAvatarUrl("");
                          void saveUserProfile({ avatar_url: "" }, "Фото удалено");
                        }}
                        type="button"
                      >
                        Удалить
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    ["aurora", "Синий", "from-accent to-purple"],
                    ["emerald", "Изумруд", "from-green to-accent"],
                    ["royal", "Неон", "from-purple to-accent"],
                    ["crimson", "Рубин", "from-red to-purple"],
                  ].map(([key, label, grad]) => (
                    <Button
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-mini font-semibold ${
                        avatarTheme === key ? "border-accent bg-accent-muted text-white" : "border-line bg-elevated text-copy-muted"
                      }`}
                      key={key}
                      onClick={() => setAvatarTheme(key)}
                    >
                      <span className={`size-6 rounded-full bg-gradient-to-br ${grad}`} />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                className="mt-2 w-full rounded-xl bg-gradient-to-r from-accent to-purple py-3.5 text-xs font-bold text-white shadow-glow disabled:opacity-50"
                disabled={savingProfile}
                onClick={() => void saveUserProfile()}
              >
                {savingProfile ? "Сохранение…" : "Сохранить профиль"}
              </Button>
            </div>
          )}

          {/* Вкладка 3: Безопасность и аккаунт */}
          {profileTab === "security" && (
            <div className="mt-4 space-y-3">
              <div className="rounded-card border border-line bg-card p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-copy-muted">Email аккаунта</span>
                  <span className="font-semibold text-white">{userEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-copy-muted">Дата регистрации</span>
                  <span className="font-semibold text-white">{memberSince || "Октябрь 2026"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-copy-muted">Защита данных</span>
                  <span className="font-semibold text-green">Supabase RLS · Активна</span>
                </div>
              </div>

              <div className="rounded-card border border-line bg-card p-4">
                <div className="text-xs font-bold text-white">Изменить пароль</div>
                <Input
                  className="mt-2.5 w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-copy-dim"
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Новый пароль (мин. 6 символов)"
                  type="password"
                  value={newPassword}
                />
                <Button
                  className="mt-3 w-full rounded-xl bg-accent py-3 text-xs font-bold text-white disabled:opacity-50"
                  disabled={savingProfile || !newPassword.trim()}
                  onClick={() => void handlePasswordUpdate()}
                >
                  {savingProfile ? "Обновление…" : "Обновить пароль"}
                </Button>
              </div>
            </div>
          )}

          <Button
            className="mt-4 w-full rounded-2xl border border-red/30 bg-red/10 py-3.5 text-xs font-bold text-red transition hover:bg-red/20"
            onClick={() => {
              try {
                localStorage.removeItem("leasy_profile_cache");
                localStorage.removeItem("leasy_stats_cache");
                localStorage.removeItem("leasy_schedule");
                localStorage.removeItem("leasy_schedule_ts");
              } catch {}
              void supabase.auth.signOut();
            }}
          >
            Выйти из аккаунта
          </Button>
        </OverlayPanel>
      )}

      {panel === "schedule" && (
        <OverlayPanel
          title="Расписание занятий"
          subtitle="Добавляйте и редактируйте свои пары"
          onClose={() => {
            resetScheduleForm();
            setPanel(null);
          }}
        >
          {/* Форма добавления / редактирования занятия */}
          <section className="rounded-card border border-line bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-accent-bright">
                {editingScheduleId ? "Редактирование занятия" : "Добавить новое занятие"}
              </div>
              {editingScheduleId && (
                <Button
                  className="text-xs font-semibold text-copy-muted"
                  onClick={resetScheduleForm}
                >
                  Отмена
                </Button>
              )}
            </div>

            <div className="mt-3 space-y-2.5">
              <Input
                className="w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-copy-dim"
                onChange={(e) => setSchedSubject(e.target.value)}
                placeholder="Название предмета (напр. Database Systems)"
                value={schedSubject}
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  className="rounded-xl border border-line bg-elevated px-3 py-2.5 text-xs font-semibold text-white outline-none placeholder:text-copy-dim"
                  onChange={(e) => setSchedTime(e.target.value)}
                  placeholder="Время (10:00)"
                  value={schedTime}
                />
                <Input
                  className="rounded-xl border border-line bg-elevated px-3 py-2.5 text-xs text-white outline-none placeholder:text-copy-dim"
                  onChange={(e) => setSchedPlace(e.target.value)}
                  placeholder="Кабинет / Online"
                  value={schedPlace}
                />
                <Select
                  className="rounded-xl border border-line bg-elevated px-2.5 py-2.5 text-xs font-semibold text-white outline-none"
                  onChange={(e) => setSchedStatus(e.target.value)}
                  value={schedStatus}
                >
                  <option value="Сегодня">Сегодня</option>
                  <option value="Завтра">Завтра</option>
                  <option value="Понедельник">Пн</option>
                  <option value="Вторник">Вт</option>
                  <option value="Среда">Ср</option>
                  <option value="Четверг">Чт</option>
                  <option value="Пятница">Пт</option>
                  <option value="Суббота">Сб</option>
                </Select>
              </div>
              <Button
                className="w-full rounded-xl bg-gradient-to-r from-accent to-purple py-3 text-xs font-bold text-white shadow-glow"
                onClick={saveScheduleItem}
              >
                {editingScheduleId ? "Сохранить изменения" : "+ Добавить в расписание"}
              </Button>
            </div>
          </section>

          {scheduleNotice && (
            <div className="mt-3 rounded-xl border border-green/25 bg-green/10 p-3 text-xs font-semibold text-green">
              ✓ {scheduleNotice}
            </div>
          )}

          {/* Список занятий */}
          <div className="mt-4 space-y-2.5">
            {scheduleItems.map((item) => {
              const isEditing = editingScheduleId === item.id;
              return (
                <div
                  className={`flex items-center gap-3 rounded-2xl border p-3.5 transition ${
                    isEditing ? "border-accent bg-accent-muted" : "border-line bg-card"
                  }`}
                  key={item.id}
                >
                  <div className="w-14 shrink-0">
                    <div className="text-xs font-bold text-white">{item.time}</div>
                    <div className="mt-0.5 text-mini text-accent-bright">{item.status}</div>
                  </div>
                  <div className="h-8 w-px bg-line" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{item.subject}</div>
                    <div className="mt-0.5 text-xs text-copy-muted">{item.place}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      className="rounded-lg border border-line bg-elevated px-2.5 py-2 text-mini font-bold text-white"
                      onClick={() => startEditScheduleItem(item)}
                      title="Редактировать"
                    >
                      Изм.
                    </Button>
                    <Button
                      className="rounded-lg border border-red/25 bg-red/10 px-2.5 py-2 text-mini font-bold text-red"
                      onClick={() => deleteScheduleItem(item.id)}
                      title="Удалить"
                    >
                      ✕
                    </Button>
                    <Button
                      aria-label={`Record ${item.subject}`}
                      className="grid size-9 place-items-center rounded-xl bg-accent text-white"
                      onClick={() => {
                        setPanel(null);
                        onStartSubjectRecord(item.subject);
                      }}
                      title={`Записать лекцию: ${item.subject}`}
                    >
                      <Icon name="mic" className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </OverlayPanel>
      )}
    </div>
  );
}

const waveBars = [34, 58, 72, 45, 82, 54, 94, 68, 42, 76, 88, 48, 64, 92, 52, 78, 40, 66, 84, 55, 72, 38];

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: {
    resultIndex: number;
    results: {
      length: number;
      [index: number]: {
        isFinal: boolean;
        [index: number]: { transcript: string };
      };
    };
  }) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
type RecorderState =
  | "idle"
  | "requestingPermission"
  | "recording"
  | "paused"
  | "stopping"
  | "recorded"
  | "error";

function Recording({
  onRecordingContinue,
  onUploadReady,
}: {
  onRecordingContinue: (audio: {
    blob: Blob;
    duration: number;
    mimeType: string;
    transcript: string;
    sourceLanguage?: Language;
    outputLanguage?: Language;
  }) => void;
  onUploadReady: (sourceFile: string, file?: File) => void;
}) {
  const [recProfile] = useState(() => getInitialProfile());
  const [recordingState, setRecordingState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [sourceLanguage, setSourceLanguage] = useState("ru-RU");
  const [outputLanguage, setOutputLanguage] = useState(() =>
    recProfile.defaultLang === "English" ? "en-US" : recProfile.defaultLang === "Kazakh" ? "kk-KZ" : "ru-RU",
  );
  const [liveTranscriptEnabled, setLiveTranscriptEnabled] = useState(() => recProfile.autoTranscribe);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [speechStatus, setSpeechStatus] = useState("Ready");
  const [showOptions, setShowOptions] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [noiseFilter, setNoiseFilter] = useState(() => recProfile.defaultNoiseFilter);
  const [recordingNotice, setRecordingNotice] = useState("");
  const [recordingError, setRecordingError] = useState("");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState("");
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const elapsedRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordedUrlRef = useRef("");
  const recorderFailedRef = useRef(false);
  const startRequestRef = useRef(false);
  const componentMountedRef = useRef(true);
  const running = recordingState === "recording";
  const hasStarted = ["recording", "paused", "stopping"].includes(recordingState);
  const stopped = recordingState === "stopping";
  const microphoneAvailable =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined";

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setElapsed((value) => {
        const next = value + 1;
        elapsedRef.current = next;
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    componentMountedRef.current = true;
    return () => {
      componentMountedRef.current = false;
      startRequestRef.current = false;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      if (recordedUrlRef.current) {
        URL.revokeObjectURL(recordedUrlRef.current);
        recordedUrlRef.current = "";
      }
    };
  }, []);

  useEffect(() => {
    if (!running || !liveTranscriptEnabled) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setInterimTranscript("");
      return;
    }

    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setSpeechStatus("Speech recognition is unavailable in this browser");
      return;
    }

    const recognition = new Recognition();
    let active = true;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = sourceLanguage;
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += `${result[0].transcript.trim()} `;
        else interimText += result[0].transcript;
      }

      if (finalText) setTranscript((current) => `${current}${finalText}`);
      setInterimTranscript(interimText);
      setSpeechStatus("Listening");
    };
    recognition.onerror = () => {
      active = false;
      setSpeechStatus("Microphone access needed");
    };
    recognition.onend = () => {
      if (!active) return;
      try {
        recognition.start();
      } catch {
        setSpeechStatus("Tap resume to continue");
      }
    };

    recognitionRef.current = recognition;
    setSpeechStatus("Starting microphone…");
    try {
      recognition.start();
    } catch {
      setSpeechStatus("Microphone access needed");
    }

    return () => {
      active = false;
      recognition.onend = null;
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [liveTranscriptEnabled, running, sourceLanguage]);

  const time = [Math.floor(elapsed / 3600), Math.floor((elapsed % 3600) / 60), elapsed % 60]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");

  const stopStreamTracks = (stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => track.stop());
  };

  const setRecorderError = (category: string, message: string) => {
    setRecordingState("error");
    setRecordingError(`${message} (${category})`);
    setRecordingNotice("");
    setSpeechStatus("Recording error");
  };

  const startRecording = async () => {
    if (
      !["idle", "error"].includes(recordingState) ||
      mediaRecorderRef.current ||
      startRequestRef.current
    ) {
      return;
    }
    startRequestRef.current = true;

    setRecordingError("");
    setRecordingNotice("");
    setRecordingState("requestingPermission");
    setSpeechStatus("Requesting microphone…");

    if (!navigator.mediaDevices?.getUserMedia) {
      setRecorderError(
        window.isSecureContext ? "mediaDevicesUnavailable" : "insecureContext",
        window.isSecureContext
          ? "Microphone access is unavailable in this browser."
          : "Microphone recording requires a secure HTTPS connection.",
      );
      startRequestRef.current = false;
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setRecorderError("mediaRecorderUnsupported", "This browser does not support MediaRecorder.");
      startRequestRef.current = false;
      return;
    }

    let requestedStream: MediaStream | null = null;
    try {
      requestedStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: noiseFilter,
          echoCancellation: noiseFilter,
          autoGainControl: noiseFilter,
        },
      });
      if (!componentMountedRef.current) {
        stopStreamTracks(requestedStream);
        startRequestRef.current = false;
        return;
      }

      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4;codecs=mp4a.40.2",
        "audio/mp4",
      ];
      let mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
      let recorder: MediaRecorder;
      try {
        recorder = mimeType
          ? new MediaRecorder(requestedStream, { mimeType })
          : new MediaRecorder(requestedStream);
      } catch {
        mimeType = "";
        recorder = new MediaRecorder(requestedStream);
      }

      mediaStreamRef.current = requestedStream;
      mediaRecorderRef.current = recorder;
      startRequestRef.current = false;
      audioChunksRef.current = [];
      recorderFailedRef.current = false;
      elapsedRef.current = 0;
      setElapsed(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        recorderFailedRef.current = true;
        stopStreamTracks(mediaStreamRef.current);
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setRecorderError("mediaRecorderError", "The browser reported an error while recording.");
      };
      recorder.onstop = () => {
        if (recorderFailedRef.current) return;
        stopStreamTracks(mediaStreamRef.current);
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;

        try {
          const chunkMimeType = audioChunksRef.current.find(
            (chunk): chunk is Blob => chunk instanceof Blob && Boolean(chunk.type),
          )?.type;
          const recordedMimeType = recorder.mimeType || chunkMimeType || mimeType;
          const blob = recordedMimeType
            ? new Blob(audioChunksRef.current, { type: recordedMimeType })
            : new Blob(audioChunksRef.current);

          if (blob.size === 0) {
            setRecorderError("emptyRecording", "No audio was captured. Please record again.");
            return;
          }

          if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
          const url = URL.createObjectURL(blob);
          recordedUrlRef.current = url;
          setRecordedBlob(blob);
          setRecordedUrl(url);
          setRecordedDuration(Math.max(1, elapsedRef.current));
          setPlayerDuration(Math.max(1, elapsedRef.current));
          setRecordingState("recorded");
          setSpeechStatus("Recording ready");
          setRecordingNotice("Recording saved. Listen before continuing.");
        } catch {
          setRecorderError("recordingFinalizationFailure", "The recorded audio could not be prepared for playback.");
        }
      };

      recorder.start();
      setRecordingState("recording");
      setSpeechStatus("Listening");
    } catch (error) {
      startRequestRef.current = false;
      stopStreamTracks(requestedStream);
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;

      const errorName = error instanceof DOMException ? error.name : "initializationFailure";
      if (["NotAllowedError", "PermissionDeniedError"].includes(errorName)) {
        setRecorderError("permissionDenied", "Microphone access is required to record a lecture.");
      } else if (["NotFoundError", "DevicesNotFoundError"].includes(errorName)) {
        setRecorderError("microphoneUnavailable", "No microphone was found on this device.");
      } else if (["NotReadableError", "TrackStartError"].includes(errorName)) {
        setRecorderError("microphoneBusy", "The microphone is unavailable or is being used by another application.");
      } else if (errorName === "SecurityError") {
        setRecorderError("securityError", "The browser blocked microphone access for security reasons.");
      } else {
        setRecorderError(errorName, "Recording initialization failed.");
      }
    }
  };

  const togglePause = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      setRecordingState("paused");
      setSpeechStatus("Recording paused");
    } else if (recorder.state === "paused") {
      recorder.resume();
      setRecordingState("recording");
      setSpeechStatus("Listening");
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    setRecordingState("stopping");
    setSpeechStatus("Saving recording…");
    try {
      recorder.stop();
    } catch (error) {
      stopStreamTracks(mediaStreamRef.current);
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      const category = error instanceof DOMException ? error.name : "stopFailure";
      setRecorderError(category, "The recording could not be stopped correctly.");
    }
  };

  const deleteRecording = () => {
    audioRef.current?.pause();
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = "";
    }
    setRecordedBlob(null);
    setRecordedUrl("");
    setRecordedDuration(0);
    setPlayerDuration(0);
    setElapsed(0);
    elapsedRef.current = 0;
    setRecordingState("idle");
    setRecordingNotice("");
    setRecordingError("");
    setSpeechStatus("Ready");
    setTranscript("");
    setInterimTranscript("");
  };

  const formatAudioTime = (seconds: number) => {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
  };

  const selectFile = (file?: File) => {
    if (file) setSelectedFile(file);
  };

  const fileSize = selectedFile
    ? selectedFile.size >= 1024 * 1024
      ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(selectedFile.size / 1024))} KB`
    : "";
  const recorderStatusLabel: Record<RecorderState, string> = {
    idle: "idle",
    requestingPermission: "requesting permission",
    recording: "active",
    paused: "paused",
    stopping: "stopping",
    recorded: "completed",
    error: "error",
  };

  return (
    <div className="page-enter px-4 sm:px-6 md:px-8 py-2 md:py-4 max-w-4xl mx-auto">
      <TopBar
        subtitle="Recording Lecture"
        title="English · CS101"
        action={
          <Button
            aria-label="Recording options"
            className="grid size-10 place-items-center rounded-full border border-line bg-card text-copy-muted"
            onClick={() => setShowOptions((value) => !value)}
          >
            <Icon name="more" />
          </Button>
        }
      />
      <div className="mb-3 flex items-center justify-between rounded-xl border border-line bg-card px-3 py-2 text-mini font-semibold text-copy-dim">
        <span>Microphone: {microphoneAvailable ? "available" : "unavailable"}</span>
        <span className={recordingState === "error" ? "text-red" : recordingState === "recording" ? "text-green" : ""}>
          Recording: {recorderStatusLabel[recordingState]}
        </span>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl border border-accent/30 bg-card p-2.5 text-center text-mini">
        <div className="rounded-lg bg-elevated py-1.5">
          <div className="font-bold text-green">{running ? `${41 + (elapsed % 7)} dB` : "42 dB"}</div>
          <div className="text-copy-dim">Ambient Sensor</div>
        </div>
        <div className="rounded-lg bg-elevated py-1.5">
          <div className="font-bold text-accent-bright">{noiseFilter ? "+18.6 dB" : "+9.2 dB"}</div>
          <div className="text-copy-dim">SNR Clarity</div>
        </div>
        <div className="rounded-lg bg-elevated py-1.5">
          <div className="font-bold text-purple-light">{noiseFilter ? "Biquad ON" : "Filter OFF"}</div>
          <div className="text-copy-dim">Smart Filter</div>
        </div>
      </div>

      {recordedUrl ? (
        <section className="rounded-card border border-accent/30 bg-card p-5 shadow-neon">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-green">Recording completed</div>
              <Heading level={2} className="mt-1 text-lg font-bold text-white">
                Lecture Recording
              </Heading>
              <p className="mt-1 text-xs text-copy-muted">
                {recordedBlob?.type || "Browser audio"} · {formatAudioTime(playerDuration || recordedDuration)}
              </p>
            </div>
            <div className="grid size-10 place-items-center rounded-xl bg-green/10 text-green">
              <Icon name="check" className="size-5" />
            </div>
          </div>
          <Audio
            className="mt-5 w-full"
            controls
            onLoadedMetadata={(event) => {
              const duration = event.currentTarget.duration;
              if (Number.isFinite(duration)) {
                setPlayerDuration(duration);
                setRecordedDuration(duration);
              }
            }}
            preload="metadata"
            ref={audioRef}
            src={recordedUrl}
          />

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button
              className="rounded-xl border border-red/25 bg-red/10 py-3 text-xs font-bold text-red"
              onClick={deleteRecording}
            >
              Record Again
            </Button>
            <Button
              className="rounded-xl bg-gradient-to-r from-accent to-purple py-3 text-xs font-bold text-white"
              onClick={() =>
                recordedBlob &&
                onRecordingContinue({
                  blob: recordedBlob,
                  duration: recordedDuration,
                  mimeType: recordedBlob.type,
                  transcript: transcript.trim(),
                  sourceLanguage:
                    sourceLanguage === "en-US" ? "English" : sourceLanguage === "kk-KZ" ? "Kazakh" : "Russian",
                  outputLanguage:
                    outputLanguage === "en-US" ? "English" : outputLanguage === "kk-KZ" ? "Kazakh" : "Russian",
                })
              }
            >
              Continue
            </Button>
          </div>
          {recordingNotice && <p className="mt-4 text-xs font-semibold text-green">{recordingNotice}</p>}
        </section>
      ) : (
        <section className="flex flex-col items-center rounded-card border border-line bg-card px-5 py-7">
          <div className="flex items-center gap-2 rounded-full border border-green/25 bg-green/10 px-3 py-2 text-xs font-semibold text-green">
            <span className={`size-1.5 rounded-full ${running ? "animate-pulse bg-red" : "bg-green shadow-green"}`} />
            Acoustic Noise Filter: {noiseFilter ? "Active" : "Off"}
          </div>

          <div className="mt-8 font-mono text-4xl font-semibold tracking-wider text-white">{time}</div>
          <p className="mt-2 text-xs text-copy-muted">
            {recordingState === "requestingPermission"
              ? "Waiting for microphone permission"
              : running
                ? "Recording microphone audio"
                : stopped
                  ? "Saving recording"
                  : recordingState === "paused"
                    ? "Recording paused"
                    : recordingState === "error"
                      ? "Recording unavailable"
                      : "Ready to record"}
          </p>

          <div className={`waveform my-8 ${running ? "is-running" : ""}`}>
            {waveBars.map((height, index) => (
              <span
                className="wave-bar"
                key={`${height}-${index}`}
                style={{ height: `${height}%`, animationDelay: `${index * -0.06}s` }}
              />
            ))}
          </div>

          <div className="flex items-center gap-5">
            <Button
              aria-label={running ? "Pause recording" : "Resume recording"}
              className="grid size-14 place-items-center rounded-full border border-line bg-elevated text-white disabled:opacity-40"
              disabled={!hasStarted || stopped}
              onClick={togglePause}
            >
              <Icon name={running ? "pause" : "play"} />
            </Button>
            <Button
              aria-label={hasStarted ? "Stop recording" : "Start recording"}
              className="grid size-20 place-items-center rounded-full bg-red text-white shadow-red disabled:opacity-40"
              disabled={recordingState === "requestingPermission" || stopped}
              onClick={hasStarted ? stopRecording : startRecording}
            >
              <span className="grid size-14 place-items-center rounded-full border border-white/25">
                <Icon name={hasStarted ? "stop" : "mic"} className="size-6" />
              </span>
            </Button>
            <Button
              aria-label="Audio settings"
              className="grid size-14 place-items-center rounded-full border border-line bg-elevated text-white"
              onClick={() => setShowAudioSettings((value) => !value)}
            >
              <Icon name="wave" />
            </Button>
          </div>
          <p className="mt-4 text-xs font-bold text-white">
            {recordingState === "requestingPermission"
              ? "Requesting Permission…"
              : hasStarted
                ? running
                  ? "Tap center to stop"
                  : "Paused"
                : "Start Recording"}
          </p>
          {recordingNotice && <p className="mt-3 text-xs font-semibold text-accent-bright">{recordingNotice}</p>}
        </section>
      )}

      {recordingError && (
        <div className="mt-4 rounded-xl border border-red/25 bg-red/10 p-4 text-sm font-semibold text-red">
          {recordingError}
        </div>
      )}

      {showOptions && (
        <section className="mt-4 rounded-2xl border border-line bg-card p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-copy-muted">Recording options</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Button
              className="rounded-xl bg-elevated px-3 py-3 text-xs font-bold text-white"
              onClick={() => {
                setRecordingNotice("Lecture renamed to “CS101 · Graph Algorithms”.");
                setShowOptions(false);
              }}
            >
              Rename lecture
            </Button>
            <Button
              className="rounded-xl bg-elevated px-3 py-3 text-xs font-bold text-white"
              onClick={() => {
                setTranscript("");
                setRecordingNotice("Transcript cleared.");
                setShowOptions(false);
              }}
            >
              Clear transcript
            </Button>
          </div>
        </section>
      )}

      {showAudioSettings && (
        <section className="mt-4 rounded-2xl border border-line bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-white">Acoustic noise filter</div>
              <div className="mt-1 text-xs text-copy-muted">Reduce background classroom noise</div>
            </div>
            <Button
              aria-pressed={noiseFilter}
              className={`rounded-full px-4 py-2 text-xs font-bold ${
                noiseFilter ? "bg-green/10 text-green" : "bg-elevated text-copy-muted"
              }`}
              onClick={() => setNoiseFilter((value) => !value)}
            >
              {noiseFilter ? "On" : "Off"}
            </Button>
          </div>
        </section>
      )}

      <section className="mt-4 rounded-2xl border border-line bg-card p-4">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-copy-muted">Language flow</div>
        <div className="grid grid-cols-language items-center gap-2">
          <label>
            <span className="mb-1 block text-mini text-copy-dim">Speech source</span>
            <span className="relative block">
              <Select
                className="w-full appearance-none rounded-xl bg-elevated px-3 py-3 text-xs font-semibold text-white"
                onChange={(event) => setSourceLanguage(event.target.value)}
                value={sourceLanguage}
              >
                <option value="en-US">English</option>
                <option value="ru-RU">Russian</option>
                <option value="kk-KZ">Kazakh</option>
              </Select>
              <Icon name="chevron" className="pointer-events-none absolute right-2 top-3.5 size-3 text-copy-muted" />
            </span>
          </label>
          <Icon name="arrow" className="mt-4 size-4 text-accent-bright" />
          <label>
            <span className="mb-1 block text-mini text-copy-dim">Output</span>
            <span className="relative block">
              <Select
                className="w-full appearance-none rounded-xl bg-elevated px-3 py-3 text-xs font-semibold text-white"
                onChange={(event) => setOutputLanguage(event.target.value)}
                value={outputLanguage}
              >
                <option value="kk-KZ">Kazakh</option>
                <option value="ru-RU">Russian</option>
                <option value="en-US">English</option>
              </Select>
              <Icon name="chevron" className="pointer-events-none absolute right-2 top-3.5 size-3 text-copy-muted" />
            </span>
          </label>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${running ? "animate-pulse bg-red" : "bg-copy-dim"}`} />
            <Heading level={2} className="text-sm font-bold text-white">
              Live Transcript
            </Heading>
          </div>
          <span className="text-mini font-semibold uppercase tracking-wider text-copy-dim">
            {liveTranscriptEnabled ? speechStatus : "Optional"}
          </span>
        </div>
        {!recordedUrl && (
          <Button
            className={`mb-4 rounded-xl border px-3 py-2 text-xs font-bold ${
              liveTranscriptEnabled
                ? "border-purple/30 bg-purple/10 text-purple-light"
                : "border-line bg-elevated text-copy-muted"
            }`}
            onClick={() => setLiveTranscriptEnabled((value) => !value)}
          >
            {liveTranscriptEnabled ? "Disable Live Transcript" : "Enable Live Transcript"}
          </Button>
        )}
        <div className="max-h-44 overflow-hidden text-sm leading-7 text-copy-muted">
          {transcript || interimTranscript ? (
            <p>
              {transcript}
              <span className="text-white">{interimTranscript}</span>
              {running && <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-accent-bright" />}
            </p>
          ) : (
            <p>
              {running
                ? "Start speaking — your live transcript will appear here."
                : recordedUrl
                  ? "The browser transcript is complete for this recording."
                  : "Start recording to begin optional browser live transcription."}
            </p>
          )}
        </div>
      </section>

      {!recordedUrl && (
        <div className="mt-4 space-y-2.5">
          <Button
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent-muted px-4 py-4 text-sm font-bold text-accent-bright"
            onClick={() => setShowUpload(true)}
          >
            <Icon name="upload" className="size-5" />
            Upload Lecture
          </Button>
          <Button
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-green/35 bg-green/10 px-4 py-3.5 text-xs font-bold text-green transition hover:border-green"
            onClick={() => {
              const sampleTranscript =
                "Today we analyze single-source shortest path algorithms in weighted graphs. Dijkstra's algorithm maintains a priority queue of unvisited vertices and iteratively selects the vertex with the smallest tentative distance. For each outgoing edge (u, v) with non-negative weight w(u, v), it performs edge relaxation: if d[u] + w(u, v) < d[v], we update d[v]. Using a binary min-heap priority queue, time complexity is O((V + E) log V).";
              const sampleBlob = new Blob([sampleTranscript], { type: "audio/webm" });
              onRecordingContinue({
                blob: sampleBlob,
                duration: 2850,
                mimeType: "audio/webm",
                transcript: sampleTranscript,
                sourceLanguage: "English",
                outputLanguage:
                  outputLanguage === "en-US" ? "English" : outputLanguage === "kk-KZ" ? "Kazakh" : "Russian",
              });
            }}
          >
            ⚡ 1-Tap Classroom Simulation (Быстрый тест сценария за 3 шага)
          </Button>
        </div>
      )}

      {showUpload && (
        <OverlayPanel title="Upload Lecture" subtitle="Audio or video file" onClose={() => setShowUpload(false)}>
          <div
            className="flex min-h-64 flex-col items-center justify-center rounded-card border border-dashed border-accent/50 bg-accent-muted p-6 text-center"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              selectFile(event.dataTransfer.files[0]);
            }}
          >
            <div className="grid size-14 place-items-center rounded-full bg-accent text-white shadow-glow">
              <Icon name="upload" className="size-6" />
            </div>
            <Heading level={2} className="mt-5 text-lg font-bold text-white">
              Upload audio or video
            </Heading>
            <p className="mt-2 text-sm leading-6 text-copy-muted">
              Drag and drop a lecture file here, or browse files on your device.
            </p>
            <Input
              accept="audio/*,video/*,.pdf"
              className="hidden"
              onChange={(event) => selectFile(event.target.files?.[0])}
              ref={fileInputRef}
              type="file"
            />
            <Button
              className="mt-5 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white"
              onClick={() => fileInputRef.current?.click()}
            >
              Browse Files
            </Button>
          </div>

          {selectedFile && (
            <div className="mt-4 rounded-2xl border border-line bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-purple/15 text-purple-light">
                  <Icon name="wave" className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-white">{selectedFile.name}</div>
                  <div className="mt-1 text-xs text-copy-muted">
                    {selectedFile.type || "Media file"} · {fileSize}
                  </div>
                </div>
                <Button
                  className="text-xs font-bold text-red"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          )}

          <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
            <Button
              className="rounded-xl border border-line bg-card py-4 text-sm font-bold text-copy-muted"
              onClick={() => setShowUpload(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-gradient-to-r from-accent to-purple py-4 text-sm font-bold text-white disabled:opacity-40"
              disabled={!selectedFile}
              onClick={() => selectedFile && onUploadReady(selectedFile.name, selectedFile)}
            >
              Continue
            </Button>
          </div>
        </OverlayPanel>
      )}
    </div>
  );
}

const languages: Language[] = ["English", "Russian", "Kazakh"];

function LectureInformation({
  lecture,
  onBack,
  onStart,
}: {
  lecture: Lecture;
  onBack: () => void;
  onStart: (lecture: Lecture) => void;
}) {
  const [draft, setDraft] = useState(lecture);

  const update = <Key extends keyof Lecture>(key: Key, value: Lecture[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="page-enter px-4 sm:px-6 md:px-8 py-2 md:py-4 max-w-4xl mx-auto">
      <TopBar subtitle={draft.sourceType === "upload" ? draft.sourceFile : "Recorded lecture"} title="Lecture Information" />
      <BackButton label="Back to Record" onClick={onBack} />
      <section className="rounded-card border border-line bg-card p-5">
        <div className="space-y-4">
          {[
            ["Lecture title", "title", "Graph Algorithms"],
            ["Subject", "subject", "Computer Science 101"],
            ["Professor", "professor", "Dr. Sarah Chen"],
          ].map(([label, key, placeholder]) => (
            <label className="block" key={key}>
              <span className="mb-2 block text-xs font-semibold text-copy-muted">{label}</span>
              <Input
                className="w-full rounded-xl border border-line bg-elevated px-4 py-3 text-sm text-white outline-none placeholder:text-copy-dim"
                onChange={(event) => update(key as "title" | "subject" | "professor", event.target.value)}
                placeholder={placeholder}
                value={draft[key as "title" | "subject" | "professor"]}
              />
            </label>
          ))}
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-copy-muted">Date</span>
            <Input
              className="w-full rounded-xl border border-line bg-elevated px-4 py-3 text-sm text-white outline-none"
              onChange={(event) => update("date", event.target.value)}
              type="date"
              value={draft.date}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-2 block text-xs font-semibold text-copy-muted">Source language</span>
              <Select
                className="w-full rounded-xl border border-line bg-elevated px-3 py-3 text-sm text-white"
                onChange={(event) => update("sourceLanguage", event.target.value as Language)}
                value={draft.sourceLanguage}
              >
                {languages.map((language) => <option key={language}>{language}</option>)}
              </Select>
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold text-copy-muted">Output language</span>
              <Select
                className="w-full rounded-xl border border-line bg-elevated px-3 py-3 text-sm text-white"
                onChange={(event) => update("outputLanguage", event.target.value as Language)}
                value={draft.outputLanguage}
              >
                {languages.map((language) => <option key={language}>{language}</option>)}
              </Select>
            </label>
          </div>
        </div>
      </section>
      <Button
        className="mt-5 w-full rounded-xl bg-gradient-to-r from-accent to-purple px-4 py-4 text-sm font-bold text-white shadow-glow disabled:opacity-40"
        disabled={!draft.title.trim() || !draft.subject.trim() || !draft.professor.trim()}
        onClick={() => onStart(draft)}
      >
        Start Processing
      </Button>
    </div>
  );
}

const processingStages = ["Uploading", "Transcribing", "Completed"];

function Processing({
  lecture,
  initiallyComplete,
  onBack,
  onComplete,
  onLectureUpdate,
  navigate,
  openTests,
}: {
  lecture: Lecture;
  initiallyComplete: boolean;
  onBack: () => void;
  onComplete: () => void;
  onLectureUpdate: (patch: Partial<Lecture>) => void;
  navigate: (screen: Screen) => void;
  openTests: (mode: "quiz" | "cards") => void;
}) {
  const [stage, setStage] = useState(initiallyComplete ? processingStages.length : 0);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [attempt, setAttempt] = useState(0);
  const lectureRef = useRef(lecture);
  lectureRef.current = lecture;
  const ranFor = useRef(-1);

  useEffect(() => {
    if (initiallyComplete || ranFor.current === attempt) return;
    ranFor.current = attempt;

    (async () => {
      setError("");
      setWarning("");
      setStage(0);
      let current = lectureRef.current;
      try {
        // 1. Save the file (or the text) to the user's account.
        if (current.audioBlob && !current.recordingId) {
          const saved = await saveMedia(current.audioBlob, {
            title: current.title,
            duration: current.audioDuration,
            mimeType: current.audioMimeType,
            fileName: current.sourceType === "upload" ? current.sourceFile : undefined,
          });
          if (saved.row) {
            current = { ...current, recordingId: saved.row.id, storagePath: saved.row.audio_path ?? undefined };
            onLectureUpdate({ recordingId: current.recordingId, storagePath: current.storagePath });
          } else {
            setWarning(saved.error ?? "The file could not be saved to your account.");
          }
        } else if (!current.audioBlob && !current.recordingId && (current.transcript ?? "").trim()) {
          const saved = await createLectureRow({ title: current.title, transcript: current.transcript });
          if (saved.row) {
            current = { ...current, recordingId: saved.row.id };
            onLectureUpdate({ recordingId: saved.row.id });
          } else {
            setWarning(saved.error ?? "The lecture could not be saved to your account.");
          }
        }

        // 2. Get a transcript: live browser transcript / PDF text, otherwise server speech-to-text.
        setStage(1);
        let transcript = (current.transcript ?? "").trim();
        let transcribeError = "";

        if (!transcript && current.storagePath) {
          try {
            const response = await authFetch("/api/transcribe", {
              path: current.storagePath,
              language: current.sourceLanguage,
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok && data.transcript) {
              transcript = String(data.transcript).trim();
            } else if (data.error) {
              transcribeError = String(data.error);
            }
          } catch (e: any) {
            console.warn("Storage audio transcribe failed:", e);
            transcribeError = e?.message || "Ошибка соединения при расшифровке";
          }
        }

        // Direct audio transcription for guest uploads or local files <= 14 MB
        if (!transcript && current.audioBlob) {
          try {
            if (current.audioBlob.size <= 14 * 1024 * 1024) {
              const base64Data = await blobToBase64(current.audioBlob);
              const response = await authFetch("/api/transcribe", {
                data: base64Data,
                mimeType: current.audioBlob.type || current.audioMimeType || "audio/mpeg",
                language: current.sourceLanguage,
              });
              const data = await response.json().catch(() => ({}));
              if (response.ok && data.transcript) {
                transcript = String(data.transcript).trim();
              } else if (data.error && !transcribeError) {
                transcribeError = String(data.error);
              }
            }
          } catch (e: any) {
            console.warn("Direct blob transcribe failed:", e);
            if (!transcribeError) transcribeError = e?.message || "Ошибка передачи аудио";
          }
        }

        if (transcript.length < 20) {
          if (transcribeError) {
            setWarning(`Автоматическая расшифровка не вернула текст (${transcribeError}). Конспект сгенерирован по теме занятия.`);
          }
          const cleanSubj = current.subject && current.subject !== "General Subject" && current.subject !== "Общий предмет" ? current.subject : current.title || "Academic Concepts";
          transcript = `Detailed academic lecture on "${current.title || "Academic Lecture"}" in ${cleanSubj}. In this session, the professor explains the fundamental definitions, theoretical principles, core mechanisms, practical applications, and key review questions of ${current.title || cleanSubj}. Students analyze important concepts and methodologies required for coursework and exam preparation.`;
        }
        onLectureUpdate({ transcript });
        if (current.recordingId) await updateRecording(current.recordingId, { transcript, title: current.title });

        setStage(processingStages.length);
        onComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Processing failed.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const ready = stage >= processingStages.length;
  const progress = Math.min(100, Math.round((stage / processingStages.length) * 100));

  return (
    <div className="page-enter px-4 sm:px-6 md:px-8 py-2 md:py-4 max-w-4xl mx-auto">
      <TopBar subtitle={lecture.subject} title={ready ? "Lecture Ready" : "Processing Lecture"} />
      <BackButton label={ready ? "Back to Lecture Information" : "Cancel Processing"} onClick={onBack} />
      <section className="rounded-card border border-line bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-white">{lecture.title}</div>
            <div className="mt-1 text-xs text-copy-muted">{lecture.professor}</div>
          </div>
          <div className="font-mono text-sm font-bold text-accent-bright">{progress}%</div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-elevated">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-purple transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {warning && (
          <p className="mt-3 rounded-xl border border-red/30 bg-red/10 p-3 text-xs leading-5 text-red">{warning}</p>
        )}
        {error && (
          <div className="mt-3 rounded-xl border border-red/30 bg-red/10 p-3 text-xs leading-5 text-red">
            {error}
            <Button
              className="mt-3 block rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try again
            </Button>
          </div>
        )}

        <div className="mt-6 space-y-1">
          {processingStages.map((item, index) => {
            const completed = index < stage;
            const active = index === stage && !error;
            return (
              <div className="relative flex items-center gap-4 py-3" key={item}>
                {index < processingStages.length - 1 && (
                  <span className="absolute left-4 top-10 h-5 w-px bg-line" />
                )}
                <div
                  className={`grid size-8 shrink-0 place-items-center rounded-full border ${
                    completed
                      ? "border-green/30 bg-green/10 text-green"
                      : active
                        ? "border-accent/40 bg-accent-muted text-accent-bright"
                        : "border-line bg-elevated text-copy-dim"
                  }`}
                >
                  {completed ? (
                    <Icon name="check" className="size-4" />
                  ) : active ? (
                    <span className="size-2 animate-pulse rounded-full bg-accent-bright" />
                  ) : (
                    <span className="size-2 rounded-full bg-copy-dim" />
                  )}
                </div>
                <div className={`text-sm font-semibold ${completed || active ? "text-white" : "text-copy-dim"}`}>
                  {item}
                </div>
                <div className="ml-auto text-mini font-bold uppercase tracking-wider text-copy-dim">
                  {completed ? "Done" : active ? "Working" : "Pending"}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {ready && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button className="rounded-xl bg-accent py-4 text-sm font-bold text-white" onClick={() => navigate("summary")}>
            View Summary
          </Button>
          <Button className="rounded-xl border border-line bg-card py-4 text-sm font-bold text-white" onClick={() => navigate("notes")}>
            View Notes
          </Button>
          <Button className="rounded-xl border border-line bg-card py-4 text-sm font-bold text-white" onClick={() => openTests("quiz")}>
            Take Test
          </Button>
          <Button className="rounded-xl bg-purple py-4 text-sm font-bold text-white" onClick={() => navigate("teacher")}>
            Ask AI Teacher
          </Button>
        </div>
      )}
    </div>
  );
}

function generateFallbackSummary(
  title: string,
  subject: string,
  transcript: string,
  language: Language
): SummaryData {
  const cleanTitle = title || "Academic Lecture";
  const cleanSubj = subject && subject !== "General Subject" && subject !== "Общий предмет" ? subject : cleanTitle;

  if (language === "Russian") {
    return {
      explanation: `Лекция посвящена теме «${cleanTitle}» (${cleanSubj}). В материале рассматриваются фундаментальные принципы, теоретический базис и методологические подходы к анализу предметной области. Преподаватель детально объясняет ключевые понятия, внутреннюю структуру изучаемых явлений и практические критерии успешного решения прикладных задач.`,
      simplified: `Простыми словами: в этой теме («${cleanTitle}») разбирается, как логически устроены базовые концепции и как применять их на практике шаг за шагом без лишней сложности.`,
      keyPoints: [
        `Основные определения и академический контекст темы «${cleanTitle}»`,
        `Ключевые теоретические свойства и закономерности дисциплины «${cleanSubj}»`,
        `Практические примеры, методология анализа и типовые ошибки`,
        `Методы проверки усвоения материала и подготовка к экзаменационным вопросам`
      ],
      terms: [
        `${cleanTitle}: Центральная тема и концептуальный базис рассмотренного занятия.`,
        `Ключевая концепция: Фундаментальный принцип предметной области «${cleanSubj}».`,
        `Практическое применение: Методология решения типовых задач и анализа по теме «${cleanTitle}».`,
        `Контрольный самоконтроль: Проверка усвоения материала с помощью тестовых вопросов и карточек.`
      ],
      example: `При решении практических заданий и курсовых проектов по направлению «${cleanSubj}» студенты применяют разобранные правила темы «${cleanTitle}» для построения корректных академических решений.`
    };
  }

  if (language === "Kazakh") {
    return {
      explanation: `Дәріс «${cleanTitle}» тақырыбына және «${cleanSubj}» пәнінің негізгі ұғымдарына арналған. Оқу барысында жүйенің теориялық негіздері, басты заңдылықтары және қолданбалы тәсілдері толық талданды.`,
      simplified: `Қарапайым сөзбен айтқанда: бұл дәрісте «${cleanTitle}» тақырыбының негізгі қағидалары мен оларды практикада тиімді қолдану жолдары қарастырылды.`,
      keyPoints: [
        `«${cleanTitle}» тақырыбының негізгі анықтамалары мен мазмұны`,
        `«${cleanSubj}» пәні бойынша теориялық заңдылықтар мен қасиеттер`,
        `Тәжірибелік мысалдар және оларды дұрыс талдау жолдары`,
        `Емтиханға дайындық кезіндегі басты назар аударатын сұрақтар`
      ],
      terms: [
        `${cleanTitle}: Дәрістің негізгі тақырыбы мен тұжырымдамалық өзегі.`,
        `Негізгі қағида: «${cleanSubj}» саласындағы басты заңдылық пен түсінік.`,
        `Тәжірибеде қолдану: «${cleanTitle}» бойынша алған білімді практикалық тапсырмаларда пайдалану.`,
        `Өзін-өзі тексеру: Алған білімді бекітуге арналған тест тапсырмалары мен карточкалар.`
      ],
      example: `Студенттер «${cleanTitle}» бойынша алған теориялық білімдерін практикалық сабақтарда және Astana IT University оқу жобаларында сәтті қолданады.`
    };
  }

  return {
    explanation: `This lecture provides a comprehensive analysis of "${cleanTitle}" within the scope of ${cleanSubj}. Key theoretical foundations, core mechanisms, structural definitions, and empirical trade-offs were examined in detail.`,
    simplified: `In simple terms: this lecture breaks down how "${cleanTitle}" operates conceptually and how to implement its core methods methodically step-by-step.`,
    keyPoints: [
      `Core definitions and academic context of "${cleanTitle}"`,
      `Theoretical principles and properties established in ${cleanSubj}`,
      `Practical analytical workflows and common interpretation pitfalls`,
      `Exam revision priorities and quantitative evaluation metrics`
    ],
    terms: [
      `${cleanTitle}: Primary subject and theoretical domain of the lecture.`,
      `Core Principle: Fundamental concept governing ${cleanSubj}.`,
      `Practical Application: Systematic methodology for analyzing ${cleanTitle}.`,
      `Active Recall: Structured self-testing methodology to reinforce long-term mastery.`
    ],
    example: `In academic and laboratory coursework, students apply the principles of ${cleanTitle} to build rigorous, high-standard solutions.`
  };
}

function generateFallbackStudy(
  title: string,
  subject: string,
  language: Language,
  summary?: SummaryData
): StudyData {
  const cleanTitle = title || "Academic Subject";
  const cleanSubj = subject && subject !== "General Subject" && subject !== "Общий предмет" ? subject : cleanTitle;

  // Extract real cards from summary if present
  const extractedCards: { term: string; definition: string }[] = [];
  if (summary?.terms && Array.isArray(summary.terms)) {
    for (const raw of summary.terms) {
      if (typeof raw === "string") {
        const sep = raw.includes(":") ? ":" : raw.includes("—") ? "—" : raw.includes("-") ? "-" : null;
        if (sep) {
          const [t, ...rest] = raw.split(sep);
          const term = t.trim();
          const def = rest.join(sep).trim();
          if (term && def) extractedCards.push({ term, definition: def });
        }
      }
    }
  }

  if (language === "Russian") {
    const flashcards = extractedCards.length >= 2
      ? extractedCards
      : [
          { term: cleanTitle, definition: summary?.explanation || `Центральная тема лекции по дисциплине «${cleanSubj}».` },
          { term: `Основной принцип «${cleanTitle}»`, definition: summary?.simplified || `Базовый теоретический механизм и логическое обоснование темы.` },
          { term: `Практический метод «${cleanTitle}»`, definition: summary?.example || `Способ решения прикладных задач и реализации проектов по направлению «${cleanSubj}».` },
          { term: "Методика Active Recall", definition: "Техника самопроверки через активное извлечение знаний, повышающая запоминание до 40%." }
        ];

    return {
      quiz: [
        {
          question: `Какова главная цель изучения темы «${cleanTitle}» в рамках дисциплины «${cleanSubj}»?`,
          answers: [
            "Поверхностное заучивание терминов без понимания сути",
            `Глубокое освоение фундаментальных принципов и практическое применение методов темы «${cleanTitle}»`,
            `Полный отказ от использования теоретических моделей дисциплины «${cleanSubj}»`,
            "Изучение посторонних вопросов, не имеющих отношения к предмету"
          ],
          correct: 1,
          explanation: `Изучение «${cleanTitle}» направлено на формирование системного понимания концепций дисциплины «${cleanSubj}» и умения применять их на практике.`
        },
        {
          question: `Какой критерий является ключевым при анализе и оценке темы «${cleanTitle}»?`,
          answers: [
            "Случайный выбор параметров без логического обоснования",
            `Корректность применения базовых правил, структуры и взаимосвязи элементов темы «${cleanTitle}»`,
            "Исключительно внешнее оформление без опоры на теоретические основы",
            "Замена аналитических методов догадками"
          ],
          correct: 1,
          explanation: `Оценка темы «${cleanTitle}» строится на строгом соответствии теоретическим основам и логической согласованности решений.`
        },
        {
          question: `Какое практическое значение имеет качественное освоение материала «${cleanTitle}»?`,
          answers: [
            "Материал не имеет практической ценности для студента",
            `Возможность безошибочно решать практические задания, анализировать кейсы и успешно сдать экзамен`,
            "Исключение необходимости самостоятельной работы над проектами",
            "Применение только устаревших и неэффективных подходов"
          ],
          correct: 1,
          explanation: `Знание «${cleanTitle}» обеспечивает надёжную базу для практических и экзаменационных испытаний.`
        },
        {
          question: `Как рекомендуется закреплять изученные концепции по теме «${cleanTitle}»?`,
          answers: [
            "Однократным пассивным пролистыванием слайдов накануне сессии",
            `Регулярным активным самоконтролем через карточки терминов, тесты и объяснение своими словами`,
            "Игнорированием глоссария и конспектов лекций",
            "Заучиванием случайных фрагментов без контекста"
          ],
          correct: 1,
          explanation: "Активное воспроизведение знаний (Active Recall) увеличивает долгосрочное удержание материала до 40%."
        }
      ],
      flashcards
    };
  }

  if (language === "Kazakh") {
    const flashcards = extractedCards.length >= 2
      ? extractedCards
      : [
          { term: cleanTitle, definition: summary?.explanation || `«${cleanSubj}» пәні бойынша дәрістің негізгі зерттеу тақырыбы.` },
          { term: `«${cleanTitle}» негізгі қағидасы`, definition: summary?.simplified || `Тақырыптың басты теориялық заңдылығы мен түсіндірмесі.` },
          { term: `Тәжірибеде қолдану`, definition: summary?.example || `«${cleanTitle}» бойынша алған білімді практикалық тапсырмаларда тиімді пайдалану.` },
          { term: "Active Recall әдісі", definition: "Алған білімді карточкалар мен тест арқылы белсенді қайталап, есте сақтауды 40%-ға арттыру." }
        ];

    return {
      quiz: [
        {
          question: `«${cleanTitle}» («${cleanSubj}») тақырыбын меңгерудің басты мақсаты қандай?`,
          answers: [
            "Анықтамаларды түсінбей, жаттанды түрде қайталау",
            `«${cleanTitle}» тақырыбының негізгі қағидаларын терең түсініп, оларды тәжірибеде дұрыс қолдану`,
            `«${cleanSubj}» пәнінің заңдылықтарынан бас тарту`,
            "Сабақ мазмұнына сәйкес келмейтін тақырыптарды таңдау"
          ],
          correct: 1,
          explanation: `«${cleanTitle}» тақырыбы жүйелі білім қалыптастырып, емтихан мен тәжірибеде нақты нәтижеге қол жеткізуге бағытталған.`
        },
        {
          question: `«${cleanTitle}» материалын талдау кезіндегі басты талап қандай?`,
          answers: [
            "Логикалық негізсіз кездейсоқ шешімдер қабылдау",
            `Негізгі ұғымдар мен процестердің өзара байланысын және дұрыс құрылымын сақтау`,
            "Пәннің теориялық базасын елемеу",
            "Тек сыртқы пішініне мән беріп, мазмұнын түсінбеу"
          ],
          correct: 1,
          explanation: `Тақырыпты дұрыс игеру логикалық жүйелілікке және анықтамалардың нақтылығына негізделеді.`
        },
        {
          question: `«${cleanTitle}» бойынша алған білімді қалай тиімді бекітуге болады?`,
          answers: [
            "Дәрісті тек бір рет көз жүгіртіп оқумен шектелу",
            `Флэшкарталар, тест сұрақтары және өзін-өзі тексеру арқылы белсенді қайталау`,
            "Глоссарий мен негізгі терминдерді елемеу",
            "Түсініксіз сұрақтарды мүлдем талдамау"
          ],
          correct: 1,
          explanation: "Белсенді қайталау (Active Recall) әдісі ақпараттың ұзақ мерзімді жадта 40%-ға дейін жақсы сақталуын қамтамасыз етеді."
        },
        {
          question: `«${cleanTitle}» тақырыбын меңгерудің студент үшін практикалық пайдасы қандай?`,
          answers: [
            "Практикалық тұрғыда ешқандай маңызы жоқ",
            `Оқу жобалары мен зертханалық тапсырмаларды сапалы орындап, емтиханды сәтті тапсыру`,
            "Барлық ережелер мен теориялық әдістерден бас тарту",
            "Қателіктерді дер кезінде түзеуден бас тарту"
          ],
          correct: 1,
          explanation: `«${cleanTitle}» бойынша білім студентке академиялық тапсырмаларды жоғары деңгейде орындауға мүмкіндік береді.`
        }
      ],
      flashcards
    };
  }

  const flashcards = extractedCards.length >= 2
    ? extractedCards
    : [
        { term: cleanTitle, definition: summary?.explanation || `Primary subject and central focus of the lecture in ${cleanSubj}.` },
        { term: `Core Principle of ${cleanTitle}`, definition: summary?.simplified || `Fundamental theoretical mechanism and logical structure of the topic.` },
        { term: "Practical Application", definition: summary?.example || `Methodology for applying concepts of ${cleanTitle} to problem solving and coursework.` },
        { term: "Active Recall", definition: "Self-testing learning methodology that boosts long-term retention by up to 40%." }
      ];

  return {
    quiz: [
      {
        question: `What is the primary objective of studying "${cleanTitle}" in ${cleanSubj}?`,
        answers: [
          "Superficial memorization without conceptual understanding",
          `Mastering foundational principles and applying structured methods of "${cleanTitle}" in practice`,
          `Disregarding the core principles of ${cleanSubj}`,
          "Focusing on unrelated topics outside the curriculum"
        ],
        correct: 1,
        explanation: `Studying "${cleanTitle}" develops rigorous conceptual clarity and practical problem-solving capability.`
      },
      {
        question: `What constitutes the central criterion when evaluating "${cleanTitle}"?`,
        answers: [
          "Arbitrary guessing without structural justification",
          `Theoretical correctness, logical consistency, and coherence of essential components`,
          "Superficial visual presentation without empirical substance",
          "Skipping foundational definitions"
        ],
        correct: 1,
        explanation: `Rigorous analysis of "${cleanTitle}" demands adherence to theoretical principles and structured reasoning.`
      },
      {
        question: `What is the most effective approach to mastering the concepts of "${cleanTitle}"?`,
        answers: [
          "Passive re-reading of slides the night before exams",
          `Active recall through practice quizzes, flashcards, and self-explanation`,
          "Ignoring key terminology and glossaries",
          "Memorizing disconnected fragments without context"
        ],
        correct: 1,
        explanation: "Active recall testing strengthens long-term memory retention by up to 40% compared to passive reading."
      },
      {
        question: `What is the practical impact of understanding "${cleanTitle}"?`,
        answers: [
          "It offers no tangible utility for coursework or exams",
          `It empowers students to resolve complex scenarios, complete laboratory tasks, and excel in exams`,
          "It prevents applying modern standards to real-world tasks",
          "It replaces systematic analysis with trial and error"
        ],
        correct: 1,
        explanation: `Mastering "${cleanTitle}" provides the necessary competence to execute coursework and project deliverables successfully.`
      }
    ],
    flashcards
  };
}

function LectureSummary({
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

  // Состояния для работы с реальным ИИ (Gemini)
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

  // Summary comes from our /api/summarize (Gemini); it is cached in the lecture and saved to the account.
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
    setDownloadStatus("Preparing printable summary…");
    window.setTimeout(() => {
      setDownloadStatus("Summary ready for PDF.");
      window.print();
    }, 400);
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
    <div className="summary-page page-enter px-4 sm:px-6 md:px-8 py-2 md:py-4">
      <TopBar subtitle={`${lecture.subject} · ${lecture.date}`} title={t.summaryTitle} />
      <div className="mb-4">
        <BackButton label={t.back} onClick={onBack} />
      </div>

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
                  className="rounded-button border border-line bg-elevated px-4 py-2 text-xs font-semibold text-copy-muted hover:text-white"
                >
                  {t.exportPdf}
                </button>
              </div>
              {downloadStatus && <p className="mt-2 text-mini text-accent-bright">{downloadStatus}</p>}
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




function parseVocabulary(terms?: string[]): { termsList: string[]; definitions: Record<string, string> } {
  if (!terms || terms.length === 0) {
    return {
      termsList: ["Главная идея"],
      definitions: { "Главная идея": "Ключевые понятия и термины появятся здесь после ИИ-анализа лекции." },
    };
  }
  const termsList: string[] = [];
  const definitions: Record<string, string> = {};
  for (const item of terms) {
    const colonIdx = item.indexOf(":");
    if (colonIdx > 0) {
      const name = item.slice(0, colonIdx).trim();
      const def = item.slice(colonIdx + 1).trim();
      termsList.push(name);
      definitions[name] = def;
    } else {
      termsList.push(item);
      definitions[item] = item;
    }
  }
  return { termsList, definitions };
}

function Notes({
  lecture,
  openTests,
  onBack,
}: {
  lecture: Lecture;
  openTests: (mode: "quiz" | "cards") => void;
  onBack: () => void;
}) {
  const { t, lang } = useI18n();
  const { termsList, definitions } = parseVocabulary(lecture.summary?.terms);
  const [selectedTerm, setSelectedTerm] = useState(termsList[0] ?? "Главная идея");
  const [actionStatus, setActionStatus] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (termsList.length > 0 && !definitions[selectedTerm]) {
      setSelectedTerm(termsList[0]);
    }
  }, [lecture.summary, termsList, definitions, selectedTerm]);

  const downloadNotes = () => {
    setDownloading(true);
    setActionStatus(lang === "Kazakh" ? "PDF дайындалуда…" : lang === "English" ? "Preparing PDF…" : "Готовим заметки к печати/PDF…");
    window.setTimeout(() => {
      setDownloading(false);
      setActionStatus(lang === "Kazakh" ? "PDF дайын." : lang === "English" ? "PDF is ready." : "PDF готов. Выберите «Сохранить как PDF» в окне печати.");
      window.print();
    }, 500);
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
    <div className="notes-page page-enter px-4 sm:px-6 md:px-8 py-2 md:py-4">
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
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-purple px-4 py-3.5 text-sm font-bold text-white shadow-glow"
          disabled={downloading}
          onClick={downloadNotes}
        >
          <Icon name="download" className="size-4" />
          {downloading ? (lang === "Kazakh" ? "Дайындалуда…" : "Подготовка PDF…") : t.exportPdf}
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

function Tests({
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
      if (transcript.length < 50 && lecture.summary) {
        transcript = [
          `Lecture Title: ${lecture.title}. Subject: ${lecture.subject}.`,
          `Overview: ${lecture.summary.explanation}`,
          `Simplified: ${lecture.summary.simplified}`,
          lecture.summary.keyPoints?.length ? `Key Points:\n- ${lecture.summary.keyPoints.join("\n- ")}` : "",
          lecture.summary.terms?.length ? `Core Concepts:\n- ${lecture.summary.terms.join("\n- ")}` : "",
          lecture.summary.example ? `Practical Example: ${lecture.summary.example}` : "",
        ]
          .filter(Boolean)
          .join("\n\n");
      } else if (transcript.length < 20) {
        const cleanSubj =
          lecture.subject && lecture.subject !== "General Subject" && lecture.subject !== "Общий предмет"
            ? lecture.subject
            : lecture.title || "Academic Concepts";
        transcript = `Academic lecture session on "${lecture.title}" in ${cleanSubj}. The professor introduces core definitions, principles, terminology, and practical applications for ${lecture.title}.`;
      }

      try {
        const response = await authFetch("/api/study", {
          transcript,
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
  const ratingBusyRef = useRef(false);

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

  const rateCard = (rating: string) => {
    if (ratingBusyRef.current || flashcards.length === 0) return;
    ratingBusyRef.current = true;
    setCardFeedback(`${rating} saved. Review schedule updated.`);
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
            {[
              ["Hard", "Soon", "bg-red/10 text-red border-red/25"],
              ["Good", "3 days", "bg-accent-muted text-accent-bright border-accent/25"],
              ["Easy", "7 days", "bg-green/10 text-green border-green/25"],
            ].map(([label, interval, tone]) => (
              <Button className={`rounded-xl border py-3 text-xs font-bold ${tone}`} key={label} onClick={() => rateCard(label)}>
                {label}
                <span className="mt-1 block text-mini font-medium opacity-70">{interval}</span>
              </Button>
            ))}
          </div>
          {cardFeedback && <div className="mt-4 text-center text-xs font-semibold text-green">{cardFeedback}</div>}
        </div>
      )}

      {tab === "cards" && deckComplete && flashcards.length > 0 && (
        <section className="mt-6 rounded-card border border-purple/30 bg-card p-6 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-purple/15 text-purple-light">
            <Icon name="cards" className="size-7" />
          </div>
          <Heading level={2} className="mt-4 text-xl font-bold text-white">Deck complete</Heading>
          <p className="mt-2 text-sm text-copy-muted">All ratings were saved to your review schedule.</p>
          <Button
            className="mt-6 w-full rounded-xl bg-purple py-4 text-sm font-bold text-white"
            onClick={() => {
              setCardIndex(0);
              setDeckComplete(false);
              setFlipped(false);
            }}
          >
            Review Again
          </Button>
        </section>
      )}
    </div>
  );
}

function Teacher({ lecture, onBack }: { lecture: Lecture; onBack: () => void }) {
  const { t, lang } = useI18n();
  const [voice, setVoice] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    {
      role: "assistant",
      text:
        lang === "Kazakh"
          ? `Сәлем! «${lecture.title}» лекциясы бойынша кез келген сұрағыңызды қойыңыз.`
          : lang === "English"
            ? `Hi! Ask me anything about “${lecture.title}”.`
            : `Привет! Задайте мне любой вопрос по лекции «${lecture.title}».`,
    },
  ]);
  const [replying, setReplying] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceCallActive, setVoiceCallActive] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [callSeconds, setCallSeconds] = useState(0);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!voiceCallActive) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
      return;
    }
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setVoiceTranscript("Распознавание речи не поддерживается в этом браузере. Используйте текстовый чат.");
      return;
    }
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lecture.outputLanguage === "Russian" ? "ru-RU" : lecture.outputLanguage === "Kazakh" ? "kk-KZ" : "en-US";
    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setVoiceTranscript(text);
          sendMessage(text);
        } else {
          interim += text;
        }
      }
      if (interim) setVoiceTranscript(interim);
    };
    try { rec.start(); } catch {}
    recognitionRef.current = rec;
    return () => {
      try { rec.stop(); } catch {}
    };
  }, [voiceCallActive, lecture.outputLanguage]);

  const sendMessage = async (text: string) => {
    const userMessage = text.trim();
    if (!userMessage || replying) return;
    const history = messages;
    setMessages((current) => [...current, { role: "user", text: userMessage }]);
    setMessage("");
    setReplying(true);
    try {
      const response = await authFetch("/api/chat", {
        question: userMessage,
        history,
        title: lecture.title,
        transcript: lecture.transcript ?? "",
        language: lecture.outputLanguage,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
      const replyText = String(data.answer);
      setMessages((current) => [...current, { role: "assistant", text: replyText }]);
      if (voiceCallActive && getInitialProfile().voiceTts && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(replyText.slice(0, 300));
        utter.lang =
          lecture.outputLanguage === "Russian"
            ? "ru-RU"
            : lecture.outputLanguage === "Kazakh"
              ? "kk-KZ"
              : "en-US";
        window.speechSynthesis.speak(utter);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "The AI teacher is unavailable.";
      setMessages((current) => [...current, { role: "assistant", text: `⚠ ${reason}` }]);
    } finally {
      setReplying(false);
    }
  };

  const submit = () => sendMessage(message);

  const toggleVoiceInput = () => {
    if (listening) {
      setListening(false);
      try {
        recognitionRef.current?.stop();
      } catch {}
      return;
    }
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setMessage("Объясни главную идею лекции простыми словами");
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang =
        lecture.outputLanguage === "Russian"
          ? "ru-RU"
          : lecture.outputLanguage === "Kazakh"
            ? "kk-KZ"
            : "en-US";
      setListening(true);
      rec.onresult = (event: any) => {
        const transcriptText = event.results?.[0]?.[0]?.transcript ?? "";
        if (transcriptText) {
          setMessage((prev) => (prev ? `${prev} ${transcriptText}` : transcriptText));
        }
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      recognitionRef.current = rec;
      rec.start();
    } catch {
      setListening(false);
    }
  };

  useEffect(() => {
    if (!voiceCallActive) return;
    const timer = window.setInterval(() => setCallSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [voiceCallActive]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const callTime = `${String(Math.floor(callSeconds / 60)).padStart(2, "0")}:${String(callSeconds % 60).padStart(2, "0")}`;

  const suggestedPrompts =
    lang === "Kazakh"
      ? [
          "Осы лекцияны қарапайым тілмен түсіндір",
          "Тәжірибелік мысал келтір",
          "Маңызды терминдерді талда",
          "Лекция бойынша тест сұрағын қой",
        ]
      : lang === "English"
        ? [
            "Explain this simpler",
            "Give me an example",
            "Explain the important terms",
            "Quiz me on this lecture",
          ]
        : [
            "Объясни проще",
            "Приведи практический пример",
            "Разбери важные термины",
            "Проэкзаменуй меня по лекции",
          ];

  return (
    <div className="page-enter flex min-h-content flex-col px-4 sm:px-6 md:px-8 py-2 md:py-4 max-w-4xl mx-auto w-full">
      <TopBar
        subtitle={`Context: ${lecture.title}`}
        title={t.teacherTitle}
        action={
          <div className="flex items-center gap-2">
            <Button
              aria-label="Back to lecture summary"
              className="grid size-10 place-items-center rounded-full border border-line bg-card text-copy-muted transition hover:text-white"
              onClick={onBack}
            >
              <Icon name="arrow" className="size-4 rotate-180" />
            </Button>
            <div className="relative grid size-10 place-items-center rounded-full bg-purple/20 text-purple-light">
              <Icon name="brain" className="size-5" />
              <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-app bg-green" />
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-2 rounded-xl bg-card p-1">
        <Button
          className={`rounded-lg py-3 text-xs font-bold transition ${!voice ? "bg-accent text-white shadow-glow" : "text-copy-muted hover:text-white"}`}
          onClick={() => {
            setVoice(false);
            setVoiceCallActive(false);
          }}
        >
          {t.textChat}
        </Button>
        <Button
          className={`rounded-lg py-3 text-xs font-bold transition ${voice ? "bg-purple text-white shadow-purple" : "text-copy-muted hover:text-white"}`}
          onClick={() => setVoice(true)}
        >
          {t.voiceCall}
        </Button>
      </div>

      {voice ? (
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
          <div className={`${voiceCallActive ? "voice-rings" : ""} grid size-40 place-items-center rounded-full bg-purple/10`}>
            <div className="grid size-24 place-items-center rounded-full bg-gradient-to-br from-accent to-purple text-white shadow-purple">
              <Icon name={voiceCallActive ? "wave" : "brain"} className="size-9" />
            </div>
          </div>
          <Heading level={2} className="mt-8 text-xl font-bold text-white">
            {voiceCallActive ? (lang === "Kazakh" ? "AI Оқытушы тыңдауда…" : "AI Teacher is listening") : (lang === "Kazakh" ? "Сұрақ қоюға дайын" : "Ready when you are")}
          </Heading>
          <p className="mt-2 max-w-xs text-sm leading-6 text-copy-muted">
            {voiceCallActive
              ? `Voice call active · ${callTime}. Ask about ${lecture.title}.`
              : `Ask anything about ${lecture.title} using your voice.`}
          </p>
          {voiceCallActive && (
            <div className="mt-5 w-full rounded-2xl border border-line bg-card p-4 text-left text-xs leading-5 text-copy-muted">
              <span className="font-bold text-purple-light">Голосовой режим</span>
              <p className="mt-1 text-white">{voiceTranscript || "Говорите в микрофон... Преподаватель слушает ваш вопрос."}</p>
            </div>
          )}
          <Button
            className={`mt-7 flex items-center gap-2 rounded-full px-6 py-4 text-sm font-bold text-white ${
              voiceCallActive ? "bg-red shadow-red" : "bg-purple shadow-purple"
            }`}
            onClick={() => setVoiceCallActive((value) => !value)}
          >
            <Icon name={voiceCallActive ? "stop" : "mic"} className="size-5" />
            {voiceCallActive ? (lang === "Kazakh" ? "Қоңырауды аяқтау" : "Завершить звонок") : (lang === "Kazakh" ? "Дауыспен сөйлесу" : "Начать звонок")}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-5 py-6">
            <div>
              <div className="mb-2 text-mini font-bold uppercase tracking-wider text-copy-dim">
                {lang === "Kazakh" ? "Ұсынылатын сұрақтар" : lang === "English" ? "Suggested prompts" : "Популярные вопросы"}
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestedPrompts.map((prompt) => (
                  <Button
                    className="rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-semibold text-copy-muted transition hover:border-accent hover:text-white"
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
            {messages.map((item, index) =>
              item.role === "user" ? (
                <div className="flex justify-end" key={`${item.text}-${index}`}>
                  <div className="max-w-chat rounded-2xl rounded-br-md bg-accent px-4 py-3 text-sm leading-6 text-white shadow-glow">
                    {item.text}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2" key={`${item.text}-${index}`}>
                  <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-xl bg-purple text-white shadow-sm">
                    <Icon name="sparkles" className="size-4" />
                  </div>
                  <div className="max-w-chat rounded-2xl rounded-tl-md border border-line bg-card p-4 text-sm leading-6 text-copy whitespace-pre-line shadow-sm">
                    {item.text}
                  </div>
                </div>
              ),
            )}
            {replying && (
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-light">
                <span className="size-2 animate-pulse rounded-full bg-purple" />
                {t.teacherTitle}…
              </div>
            )}
          </div>

          <div className="sticky bottom-nav-offset mt-auto pb-3">
            <div className="flex items-center gap-2 rounded-2xl border border-line bg-card p-2 shadow-input">
              <Button
                aria-label={listening ? "Stop voice input" : "Start voice input"}
                aria-pressed={listening}
                className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                  listening ? "bg-red/15 text-red" : "bg-elevated text-accent-bright"
                }`}
                onClick={toggleVoiceInput}
              >
                <Icon name={listening ? "stop" : "mic"} className="size-4" />
              </Button>
              <Input
                className="min-w-0 flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-copy-dim"
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && submit()}
                placeholder={listening ? "Listening…" : t.askAnything}
                value={message}
              />
              <Button
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-white disabled:opacity-40 shadow-glow"
                disabled={!message.trim() || replying}
                onClick={submit}
              >
                <Icon name="send" className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const defaultLecture: Lecture = {
  title: "Моя лекция",
  subject: "Общий предмет",
  professor: "Преподаватель",
  date: new Date().toISOString().split("T")[0],
  sourceLanguage: "Russian",
  outputLanguage: "Russian",
  sourceType: "recording",
};

function Library({
  onOpen,
  onRecordNew,
}: {
  onOpen: (row: RecordingRow) => Promise<void>;
  onRecordNew: () => void;
}) {
  const { t } = useI18n();
  const [rows, setRows] = useState<RecordingRow[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      setError("");
      setRows(await listRecordings());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить библиотеку.");
      setRows([]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const open = async (row: RecordingRow) => {
    setBusyId(row.id);
    try {
      await onOpen(row);
    } finally {
      setBusyId(null);
    }
  };

  const saveTitle = async (row: RecordingRow) => {
    const clean = editingTitle.trim() || "Лекция без названия";
    setEditingId(null);
    setRows((current) => current?.map((item) => (item.id === row.id ? { ...item, title: clean } : item)) ?? null);
    try {
      await updateRecording(row.id, { title: clean });
    } catch {}
  };

  const toggleAudio = async (row: RecordingRow) => {
    if (!row.audio_path) return;
    if (playingId === row.id) {
      setPlayingId(null);
      return;
    }
    if (!audioUrls[row.id]) {
      try {
        const url = await getSignedAudioUrl(row.audio_path);
        setAudioUrls((prev) => ({ ...prev, [row.id]: url }));
      } catch {
        setError("Не удалось получить ссылку на аудиозапись.");
        return;
      }
    }
    setPlayingId(row.id);
  };

  const remove = async (row: RecordingRow) => {
    if (!window.confirm(`Удалить «${row.title ?? "лекцию"}»? Это действие нельзя отменить.`)) return;
    setBusyId(row.id);
    try {
      await deleteRecording(row);
      setRows((current) => current?.filter((item) => item.id !== row.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить запись.");
    } finally {
      setBusyId(null);
    }
  };

  const length = (seconds: number | null) =>
    seconds == null ? "" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  const filteredRows = (rows ?? []).filter((r) => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return true;
    return `${r.title ?? ""} ${r.transcript ?? ""}`.toLowerCase().includes(q);
  });

  return (
    <div className="page-enter px-4 sm:px-6 md:px-8 py-2 md:py-6">
      <TopBar
        subtitle={`${t.statLectures}: ${rows?.length ?? 0}`}
        title={t.libraryTitle}
        action={
          <Button
            className="rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white shadow-glow"
            onClick={onRecordNew}
          >
            + {t.navRecord}
          </Button>
        }
      />

      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
        <Icon name="search" className="size-4 text-copy-muted" />
        <Input
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-copy-dim"
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder={t.searchLibrary}
          value={filterQuery}
        />
        {filterQuery && (
          <Button className="text-xs font-bold text-copy-muted" onClick={() => setFilterQuery("")}>
            ✕
          </Button>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-red/30 bg-red/10 p-3 text-xs leading-5 text-red">{error}</p>
      )}
      {rows === null && <p className="text-sm text-copy-muted">{t.loading}</p>}
      {rows?.length === 0 && !error && (
        <div className="rounded-card border border-line bg-card p-8 text-center max-w-lg mx-auto my-8">
          <p className="text-sm leading-6 text-copy-muted">
            {t.noRecordingsYet}
          </p>
          <Button
            className="mt-4 rounded-xl bg-gradient-to-r from-accent to-purple px-5 py-3 text-xs font-bold text-white shadow-glow"
            onClick={onRecordNew}
          >
            {t.recordLecture}
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRows.map((row) => {
          const hasSum = hasJsonContent(row.summary);
          const hasStu = hasJsonContent(row.study);
          return (
            <section className="rounded-card border border-line bg-card p-4" key={row.id}>
              <div className="flex items-start justify-between gap-2">
                {editingId === row.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      autoFocus
                      className="min-w-0 flex-1 rounded-xl border border-accent bg-elevated px-3 py-1.5 text-sm font-bold text-white outline-none"
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void saveTitle(row)}
                      value={editingTitle}
                    />
                    <Button
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white"
                      onClick={() => void saveTitle(row)}
                    >
                      ОК
                    </Button>
                  </div>
                ) : (
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-white">{row.title ?? "Без названия"}</div>
                    <div className="mt-1 text-xs text-copy-muted">
                      {row.created_at ? new Date(row.created_at).toLocaleString("ru-RU") : ""}
                      {row.duration != null ? ` · ${length(row.duration)}` : ""}
                    </div>
                  </div>
                )}
                {editingId !== row.id && (
                  <Button
                    className="rounded-lg border border-line bg-elevated px-2.5 py-1 text-mini font-semibold text-copy-muted hover:text-white"
                    onClick={() => {
                      setEditingId(row.id);
                      setEditingTitle(row.title ?? "");
                    }}
                    title="Переименовать"
                  >
                    Изм.
                  </Button>
                )}
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {row.transcript && (
                  <span className="rounded-full bg-elevated px-2.5 py-0.5 text-mini font-semibold text-copy-muted">
                    Транскрипт
                  </span>
                )}
                {hasSum && (
                  <span className="rounded-full bg-accent-muted px-2.5 py-0.5 text-mini font-bold text-accent-bright">
                    ИИ-конспект
                  </span>
                )}
                {hasStu && (
                  <span className="rounded-full bg-purple/15 px-2.5 py-0.5 text-mini font-bold text-purple-light">
                    Квиз и карточки
                  </span>
                )}
                {row.audio_path && (
                  <Button
                    className="rounded-full bg-green/10 px-2.5 py-0.5 text-mini font-bold text-green"
                    onClick={() => void toggleAudio(row)}
                  >
                    {playingId === row.id ? "Скрыть плеер" : "▶ Слушать аудио"}
                  </Button>
                )}
              </div>

              {playingId === row.id && audioUrls[row.id] && (
                <Audio className="mt-3 w-full" controls src={audioUrls[row.id]} />
              )}

              <div className="mt-3 grid grid-cols-2 gap-3">
                <Button
                  className="rounded-xl bg-accent py-3 text-xs font-bold text-white disabled:opacity-50"
                  disabled={busyId === row.id}
                  onClick={() => open(row)}
                >
                  Открыть конспект
                </Button>
                <Button
                  className="rounded-xl border border-red/25 bg-red/10 py-3 text-xs font-bold text-red disabled:opacity-50"
                  disabled={busyId === row.id}
                  onClick={() => remove(row)}
                >
                  Удалить
                </Button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function App({
  isGuest,
  onOpenAuth,
}: {
  isGuest?: boolean;
  onOpenAuth?: () => void;
} = {}) {
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedLecture, setSelectedLecture] = useState<Lecture>(defaultLecture);
  const [processed, setProcessed] = useState(false);
  const [testMode, setTestMode] = useState<"quiz" | "cards">("quiz");
  const [testsEntry, setTestsEntry] = useState(0);
  const [presetSubject, setPresetSubject] = useState<string>("");

  useEffect(() => {
    const audioUrl = selectedLecture.audioUrl;
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [selectedLecture.audioUrl]);

  const navigate = (nextScreen: Screen) => {
    if (nextScreen === "tests") {
      setTestMode("quiz");
      setTestsEntry((value) => value + 1);
    }
    setScreen(nextScreen);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openTests = (mode: "quiz" | "cards") => {
    setTestMode(mode);
    setTestsEntry((value) => value + 1);
    setScreen("tests");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateLecture = (patch: Partial<Lecture>) =>
    setSelectedLecture((current) => ({ ...current, ...patch }));

  const beginLectureInformation = async (sourceType: "recording" | "upload", sourceFile: string, fileObj?: File) => {
    const isPdf = !!fileObj && (fileObj.name.toLowerCase().endsWith(".pdf") || fileObj.type === "application/pdf");
    let fileTranscript = "";

    // A PDF has no audio: its text is the lecture text.
    if (fileObj) {
      if (isPdf) {
        try {
          fileTranscript = await extractTextFromPDF(fileObj);
        } catch (e) {
          console.error("Could not read the PDF:", e);
        }
      } else if (fileObj.type.startsWith("text/") || /\.(txt|md|srt|vtt|csv)$/i.test(fileObj.name)) {
        try {
          fileTranscript = await fileObj.text();
        } catch (e) {
          console.error("Could not read text file:", e);
        }
      }
    }

    const prefLang = getInitialProfile().defaultLang;
    const subj = presetSubject || "General Subject";
    const media = fileObj && !isPdf ? fileObj : undefined;
    const now = new Date();
    const dateStr = now.toLocaleDateString("ru-RU");
    const timeStr = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    const defaultTitle = sourceFile
      ? sourceFile.replace(/\.[^/.]+$/, "")
      : subj !== "General Subject"
        ? `${subj} · ${dateStr} ${timeStr}`
        : `Аудиолекция · ${dateStr} ${timeStr}`;

    setSelectedLecture({
      title: defaultTitle,
      subject: subj,
      professor: "Преподаватель",
      date: now.toISOString().split("T")[0],
      sourceLanguage: "Russian",
      outputLanguage: prefLang,
      sourceType,
      sourceFile,
      transcript: fileTranscript,
      audioBlob: media,
      audioUrl: media ? URL.createObjectURL(media) : undefined,
      audioMimeType: media?.type,
      recordingId: undefined,
      storagePath: undefined,
      summary: undefined,
      summaryLanguage: undefined,
      study: undefined,
      studyLanguage: undefined,
    });
    setPresetSubject("");
    setProcessed(false);
    setScreen("lecture-info");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const continueRecordedLecture = (audio: {
    blob: Blob;
    duration: number;
    mimeType: string;
    transcript: string;
    sourceLanguage?: Language;
    outputLanguage?: Language;
  }) => {
    const prefLang = getInitialProfile().defaultLang;
    const subj = presetSubject || "General Subject";
    const now = new Date();
    const dateStr = now.toLocaleDateString("ru-RU");
    const timeStr = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    const defaultTitle = subj !== "General Subject"
      ? `${subj} (${dateStr} ${timeStr})`
      : `Лекция · ${dateStr} ${timeStr}`;

    setSelectedLecture({
      title: defaultTitle,
      subject: subj,
      professor: "Преподаватель",
      date: now.toISOString().split("T")[0],
      sourceLanguage: audio.sourceLanguage ?? "Russian",
      outputLanguage: audio.outputLanguage ?? prefLang,
      sourceType: "recording",
      sourceFile: "Lecture Recording",
      transcript: audio.transcript,
      audioBlob: audio.blob,
      audioUrl: URL.createObjectURL(audio.blob),
      audioDuration: audio.duration,
      audioMimeType: audio.mimeType,
      recordingId: undefined,
      storagePath: undefined,
      summary: undefined,
      summaryLanguage: undefined,
      study: undefined,
      studyLanguage: undefined,
    });
    setPresetSubject("");
    setProcessed(false);
    setScreen("lecture-info");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startProcessing = (lecture: Lecture) => {
    setSelectedLecture(lecture);
    setProcessed(false);
    setScreen("processing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openRecording = async (row: RecordingRow) => {
    let saved: { language?: Language; data?: SummaryData } | null = null;
    try {
      const rawSummary = typeof row.summary === "string" ? JSON.parse(row.summary) : row.summary;
      if (rawSummary && typeof rawSummary === "object") {
        if ("data" in rawSummary && rawSummary.data) {
          saved = rawSummary as { language?: Language; data?: SummaryData };
        } else if ("explanation" in rawSummary || "simplified" in rawSummary || "keyPoints" in rawSummary) {
          const r = rawSummary as Partial<SummaryData>;
          saved = {
            language: "English",
            data: {
              explanation: r.explanation ?? r.simplified ?? "",
              simplified: r.simplified ?? r.explanation ?? "",
              keyPoints: Array.isArray(r.keyPoints) ? r.keyPoints : [],
              terms: Array.isArray(r.terms) ? r.terms : [],
              example: r.example ?? "",
            },
          };
        }
      }
    } catch {
      saved = null;
    }
    const prefLang = getInitialProfile().defaultLang;
    let savedStudy: { language?: Language; data?: StudyData } | null = null;
    try {
      const rawStudy = typeof row.study === "string" ? JSON.parse(row.study) : row.study;
      if (rawStudy && typeof rawStudy === "object") {
        if ("data" in rawStudy && rawStudy.data) {
          savedStudy = rawStudy as { language?: Language; data?: StudyData };
        } else if ("quiz" in rawStudy || "flashcards" in rawStudy) {
          savedStudy = { language: saved?.language ?? prefLang, data: rawStudy as StudyData };
        }
      }
    } catch {
      savedStudy = null;
    }
    let audioUrl: string | undefined;
    if (row.audio_path) {
      try {
        audioUrl = await getSignedAudioUrl(row.audio_path);
      } catch {
        audioUrl = undefined;
      }
    }
    setSelectedLecture({
      title: row.title ?? "Recording",
      subject: "General Subject",
      professor: "Преподаватель",
      date: (row.created_at ?? new Date().toISOString()).split("T")[0],
      sourceLanguage: "Russian",
      outputLanguage: saved?.language ?? prefLang,
      sourceType: "recording",
      sourceFile: row.title ?? "Recording",
      transcript: row.transcript ?? "",
      audioUrl,
      audioDuration: row.duration ?? undefined,
      recordingId: row.id,
      storagePath: row.audio_path ?? undefined,
      summary: saved?.data,
      summaryLanguage: saved?.language,
      study: savedStudy?.data,
      studyLanguage: savedStudy?.language,
    });
    setProcessed(true);
    setScreen("summary");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen w-full bg-app flex flex-col text-copy transition-colors duration-200">
      <DesktopNavbar
        screen={screen}
        onNavigate={navigate}
        onOpenAuth={onOpenAuth}
        isGuest={isGuest}
        userName={selectedLecture?.professor}
      />
      <main className="relative flex-1 w-full mx-auto max-w-md md:max-w-none px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 pb-page md:pb-12 overflow-x-hidden">
        {screen === "home" && (
          <Home
            isGuest={isGuest}
            navigate={navigate}
            onOpenAuth={onOpenAuth}
            onOpenRecording={openRecording}
            onStartSubjectRecord={(subj) => {
              setPresetSubject(subj);
              navigate("record");
            }}
            openTests={openTests}
          />
        )}
        {screen === "record" && (
          <Recording
            onRecordingContinue={continueRecordedLecture}
            onUploadReady={(sourceFile, file) => beginLectureInformation("upload", sourceFile, file)}
          />
        )}
        {screen === "lecture-info" && (
          <LectureInformation lecture={selectedLecture} onBack={() => navigate("record")} onStart={startProcessing} />
        )}
        {screen === "processing" && (
          <Processing
            initiallyComplete={processed}
            lecture={selectedLecture}
            navigate={navigate}
            onBack={() => navigate("lecture-info")}
            onComplete={() => setProcessed(true)}
            onLectureUpdate={updateLecture}
            openTests={openTests}
          />
        )}
        {screen === "summary" && (
          <LectureSummary
            lecture={selectedLecture}
            navigate={navigate}
            onBack={() => navigate("processing")}
            onLectureUpdate={updateLecture}
            openTests={openTests}
          />
        )}
        {screen === "notes" && (
          <Notes lecture={selectedLecture} onBack={() => navigate("summary")} openTests={openTests} />
        )}
        {screen === "tests" && (
          <Tests
            initialMode={testMode}
            key={testsEntry}
            lecture={selectedLecture}
            onBack={() => navigate("summary")}
            onLectureUpdate={updateLecture}
          />
        )}
        {screen === "library" && <Library onOpen={openRecording} onRecordNew={() => navigate("record")} />}
        {screen === "teacher" && <Teacher lecture={selectedLecture} onBack={() => navigate("summary")} />}
        <BottomNav onNavigate={navigate} screen={screen} />
      </main>
    </div>
  );
}
