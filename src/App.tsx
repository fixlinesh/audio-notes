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
  | "more"
  | "pause"
  | "play"
  | "search"
  | "send"
  | "share"
  | "sparkles"
  | "speaker"
  | "stop"
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

function TopBar({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 pb-6 pt-safe">
      <div>
        {subtitle && <p className="mb-1 text-xs font-medium text-copy-muted">{subtitle}</p>}
        <Heading className="text-2xl font-bold tracking-tight text-white">{title}</Heading>
      </div>
      {action}
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
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-app px-5">
      <div className="shrink-0">
        <TopBar
          title={title}
          subtitle={subtitle}
          action={
            <Button
              aria-label="Close"
              className="grid size-10 place-items-center rounded-full border border-line bg-card text-copy-muted"
              onClick={onClose}
            >
              <Icon name="arrow" className="size-4 rotate-180" />
            </Button>
          }
        />
      </div>
      <div className="flex-1 overflow-y-auto pb-28">
        {children}
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
  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-md -translate-x-1/2 border-t border-line bg-nav/95 px-2 pb-safe backdrop-blur-xl"
    >
      {nav.map((item) => (
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
          {item.label}
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
}: {
  navigate: (screen: Screen) => void;
  openTests: (mode: "quiz" | "cards") => void;
  onOpenRecording: (row: RecordingRow) => Promise<void>;
  onStartSubjectRecord: (subject: string) => void;
}) {
  const [initProfile] = useState<CachedProfile>(() => getInitialProfile());
  const [initStats] = useState(() => getInitialStats(initProfile.userEmail));

  const [panel, setPanel] = useState<"search" | "profile" | "schedule" | null>(null);
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
    <div className="page-enter px-5">
      <TopBar
        subtitle={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        title={userName ? `Hello, ${userName}!` : "Hello!"}
        action={
          <div className="flex items-center gap-2">
            <Button
              aria-label="Search"
              className="grid size-10 place-items-center rounded-full border border-line bg-card text-copy-muted"
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

      <Button
        className="record-cta group relative w-full overflow-hidden rounded-card border border-accent/50 bg-gradient-to-br from-blue-deep to-accent p-6 text-left shadow-neon"
        onClick={() => navigate("record")}
      >
        <span className="absolute -right-8 -top-10 size-36 rounded-full bg-purple/30 blur-2xl" />
        <span className="relative flex items-center justify-between">
          <span>
            <span className="block text-xs font-bold uppercase tracking-widest text-blue-soft">
              One-tap capture
            </span>
            <span className="mt-2 block text-2xl font-bold text-white">Record Lecture</span>
            <span className="mt-2 block text-sm text-blue-soft">Transcribe & translate with AI</span>
          </span>
          <span className="grid size-16 place-items-center rounded-full bg-white text-accent shadow-mic transition group-hover:scale-105">
            <Icon name="mic" className="size-7" />
          </span>
        </span>
      </Button>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <Heading level={2} className="text-lg font-bold text-white">
            Today’s Schedule
          </Heading>
          <Button
            className="rounded-lg bg-accent-muted px-3 py-1.5 text-xs font-bold text-accent-bright"
            onClick={() => {
              setScheduleNotice("");
              setPanel("schedule");
            }}
          >
            Изменить · Все ({scheduleItems.length})
          </Button>
        </div>
        <div className="space-y-3">
          {scheduleItems.length === 0 && (
            <div className="rounded-2xl border border-line bg-card p-5 text-center text-xs text-copy-muted">
              В расписании пока нет пар. Нажмите «Изменить», чтобы добавить свои предметы.
            </div>
          )}
          {scheduleItems.slice(0, 3).map((item, index) => (
            <div
              className={`flex items-center gap-3 rounded-2xl border p-4 ${
                index === 0 ? "border-accent/40 bg-accent-muted" : "border-line bg-card"
              }`}
              key={item.id}
            >
              <div className="w-16 shrink-0">
                <div className="text-xs font-bold text-white">{item.time}</div>
                <div className={`mt-1 text-mini ${index === 0 ? "text-accent-bright" : "text-copy-dim"}`}>
                  {item.status}
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

      <section className="mt-8">
        <Heading level={2} className="mb-4 text-lg font-bold text-white">
          Quick Actions
        </Heading>
        <div className="grid grid-cols-3 gap-3">
          {[
            ["book", "Моя", "Библиотека", libraryCount !== null ? String(libraryCount) : "0"],
            ["test", "Тесты и", "Квизы", "AI"],
            ["sparkles", "ИИ", "Тьютор", "Чат"],
          ].map(([icon, first, second, badge], index) => (
            <Button
              className="rounded-2xl border border-line bg-card p-3 text-left transition hover:border-accent/50"
              key={second}
              onClick={() => {
                if (index === 0) navigate("library");
                else if (index === 1) openTests("quiz");
                else navigate("teacher");
              }}
            >
              <span className="mb-6 flex items-start justify-between">
                <span className="grid size-9 place-items-center rounded-xl bg-accent-muted text-accent-bright">
                  <Icon name={icon as IconName} className="size-4" />
                </span>
                <span className="rounded-full bg-elevated px-2 py-1 text-mini font-bold text-copy-muted">
                  {badge}
                </span>
              </span>
              <span className="block text-xs font-semibold leading-5 text-white">
                {first}
                <br />
                {second}
              </span>
            </Button>
          ))}
        </div>
      </section>

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
    <div className="page-enter px-5">
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
      <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-card px-3 py-2 text-mini font-semibold text-copy-dim">
        <span>Microphone: {microphoneAvailable ? "available" : "unavailable"}</span>
        <span className={recordingState === "error" ? "text-red" : recordingState === "recording" ? "text-green" : ""}>
          Recording: {recorderStatusLabel[recordingState]}
        </span>
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
        <Button
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent-muted px-4 py-4 text-sm font-bold text-accent-bright"
          onClick={() => setShowUpload(true)}
        >
          <Icon name="upload" className="size-5" />
          Upload Lecture
        </Button>
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
    <div className="page-enter px-5">
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
        if (!transcript && current.storagePath) {
          const response = await authFetch("/api/transcribe", {
            path: current.storagePath,
            language: current.sourceLanguage,
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error ?? `Transcription failed (${response.status})`);
          transcript = String(data.transcript ?? "").trim();
        }
        if (transcript.length < 20) {
          throw new Error(
            current.storagePath
              ? "No speech could be recognised in this file."
              : "There is no transcript to work with. Record with live transcription on, or upload a PDF or an audio file.",
          );
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
    <div className="page-enter px-5">
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

        const transcriptText = (lecture.transcript ?? "").trim();
        if (transcriptText.length < 20) {
          throw new Error("There is no transcript for this lecture yet. Record with live transcription on, or upload a PDF or an audio file.");
        }

        const response = await authFetch("/api/summarize", {
          transcript: transcriptText,
          title: lecture.title,
          subject: lecture.subject,
          sourceLanguage: lecture.sourceLanguage,
          outputLanguage: language,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Request failed (${response.status})`);
        }

        const data = (await response.json()) as SummaryData;
        setSummaryData(data);
        onLectureUpdate({ summary: data, summaryLanguage: language });
        if (lecture.recordingId) {
          void updateRecording(lecture.recordingId, { summary: JSON.stringify({ language, data }) });
        }
      } catch (err: any) {
        setError(err.message || "Could not reach the AI service.");
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
      <div className="summary-page page-enter px-5 text-center py-20">
        <TopBar subtitle={`${lecture.subject} · ${lecture.date}`} title="Lecture Summary" />
        <BackButton label="Back to Processing" onClick={onBack} />
        <div className="mt-10 text-white animate-pulse">
          <p className="text-lg">🤖 Искусственный интеллект (Gemini) анализирует лекцию...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="summary-page page-enter px-5 text-center py-20">
        <TopBar subtitle={`${lecture.subject} · ${lecture.date}`} title="Lecture Summary" />
        <BackButton label="Back to Processing" onClick={onBack} />
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
    <div className="summary-page page-enter px-5">
      <TopBar subtitle={`${lecture.subject} · ${lecture.date}`} title="Lecture Summary" />
      <BackButton label="Back to Processing" onClick={onBack} />

      <section className="rounded-card border border-line bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Heading level={2} className="text-xl font-bold text-white">{lecture.title}</Heading>
            <p className="mt-1 text-xs text-copy-muted">{lecture.professor}</p>
          </div>
        </div>

        <div className="mt-5 flex rounded-full bg-elevated p-1">
          <button
            onClick={() => setVersion("original")}
            className={`flex-1 rounded-full py-2 text-xs font-medium transition ${
              version === "original" ? "bg-card text-white shadow" : "text-copy-muted"
            }`}
          >
            Original
          </button>
          <button
            onClick={() => setVersion("simplified")}
            className={`flex-1 rounded-full py-2 text-xs font-medium transition ${
              version === "simplified" ? "bg-card text-white shadow" : "text-copy-muted"
            }`}
          >
            Simplified
          </button>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">AI Explanation</h3>
            <button onClick={() => setEditing(!editing)} className="text-xs text-brand hover:underline">
              {editing ? "Done" : "Edit"}
            </button>
          </div>

          {editing ? (
            <textarea
              className="mt-2 w-full rounded-card border border-line bg-elevated p-3 text-sm text-white"
              rows={4}
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
            <p className="mt-2 text-sm leading-relaxed text-copy">{currentText}</p>
          )}

          <div className="mt-4 flex items-center gap-2">
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
              {saved ? "Сохранено в облаке ✓" : "Сохранить изменения"}
            </button>
            <button
              onClick={download}
              className="rounded-button border border-line bg-elevated px-4 py-2 text-xs font-semibold text-copy-muted hover:text-white"
            >
              Скачать PDF
            </button>
          </div>
          {downloadStatus && <p className="mt-2 text-mini text-accent-bright">{downloadStatus}</p>}
        </div>
      </section>

      {/* Ключевые точки от Gemini */}
      <section className="mt-5 rounded-card border border-line bg-card p-5">
        <h3 className="text-sm font-semibold text-white">Key Points</h3>
        <ul className="mt-3 space-y-2">
          {summaryData?.keyPoints?.map((point, index) => (
            <li key={index} className="text-xs text-copy flex items-start gap-2">
              <span className="text-brand">•</span> {point}
            </li>
          ))}
        </ul>
      </section>

      {/* Термины */}
      <section className="mt-5 rounded-card border border-line bg-card p-5">
        <h3 className="text-sm font-semibold text-white">Key Terms</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {summaryData?.terms?.map((term, index) => (
            <span key={index} className="rounded-full bg-elevated px-3 py-1 text-xs text-white">
              {term}
            </span>
          ))}
        </div>
      </section>

      {/* Быстрые действия по лекции */}
      <section className="mt-5 grid grid-cols-2 gap-3">
        <Button
          className="rounded-xl bg-accent py-3.5 text-xs font-bold text-white shadow-glow"
          onClick={() => navigate("notes")}
        >
          Конспект и словарь (Notes)
        </Button>
        <Button
          className="rounded-xl bg-purple py-3.5 text-xs font-bold text-white"
          onClick={() => navigate("teacher")}
        >
          Спросить AI Teacher
        </Button>
        <Button
          className="rounded-xl border border-line bg-card py-3.5 text-xs font-bold text-white"
          onClick={() => openTests("quiz")}
        >
          Пройти тест (Quiz)
        </Button>
        <Button
          className="rounded-xl border border-line bg-card py-3.5 text-xs font-bold text-white"
          onClick={() => openTests("cards")}
        >
          Флеш-карточки
        </Button>
      </section>
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
    setActionStatus("Готовим заметки к печати/PDF…");
    window.setTimeout(() => {
      setDownloading(false);
      setActionStatus("PDF готов. Выберите «Сохранить как PDF» в окне печати.");
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
      setActionStatus("Открываем меню отправки…");
      await navigator.share(shareData)
        .then(() => setActionStatus("Заметки успешно отправлены."))
        .catch(() => setActionStatus("Отправка отменена."));
      return;
    }

    try {
      await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}`);
      setActionStatus("Текст конспекта скопирован в буфер обмена.");
    } catch {
      setActionStatus("Отправка недоступна в этом браузере.");
    }
  };

  const keyPoints = lecture.summary?.keyPoints && lecture.summary.keyPoints.length > 0
    ? lecture.summary.keyPoints
    : lecture.summary?.explanation
      ? [lecture.summary.explanation]
      : ["Ключевые пункты конспекта появятся здесь после генерации в разделе Summary."];

  return (
    <div className="notes-page page-enter px-5">
      <TopBar
        subtitle={`${lecture.subject} · ${lecture.date}`}
        title={lecture.title}
        action={
          <Button
            aria-label="Назад к конспекту лекции"
            className="grid size-10 place-items-center rounded-full border border-line bg-card text-copy-muted"
            onClick={onBack}
          >
            <Icon name="arrow" className="size-4 rotate-180" />
          </Button>
        }
      />
      <div className="flex gap-3">
        <Button
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-purple px-4 py-3.5 text-sm font-bold text-white shadow-glow"
          disabled={downloading}
          onClick={downloadNotes}
        >
          <Icon name="download" className="size-4" />
          {downloading ? "Подготовка PDF…" : "Скачать конспект в PDF"}
        </Button>
        <Button
          aria-label="Поделиться заметками"
          className="grid size-12 place-items-center rounded-xl border border-line bg-card text-copy-muted"
          onClick={shareNotes}
        >
          <Icon name="share" className="size-4" />
        </Button>
      </div>
      {actionStatus && (
        <div className="mt-3 rounded-xl border border-accent/25 bg-accent-muted p-3 text-xs font-semibold text-accent-bright">
          {actionStatus}
        </div>
      )}

      <section className="mt-6 rounded-card border border-line bg-card p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-accent-muted text-accent-bright">
            <Icon name="sparkles" className="size-4" />
          </div>
          <Heading level={2} className="text-base font-bold text-white">
            Ключевые тезисы лекции
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

      <section className="mt-4 rounded-card border border-line bg-card p-5">
        <Heading level={2} className="text-base font-bold text-white">
          Разбор и практические примеры
        </Heading>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-elevated p-4">
            <div className="text-xs font-semibold text-accent-bright uppercase tracking-wider">Суть простыми словами</div>
            <div className="mt-2 text-sm leading-6 text-white">
              {lecture.summary?.simplified || "Понятное объяснение простыми словами появится здесь."}
            </div>
          </div>
          {lecture.summary?.example && (
            <div className="rounded-xl bg-elevated p-4">
              <div className="text-xs font-semibold text-purple-light uppercase tracking-wider">Практический пример</div>
              <div className="mt-2 text-sm leading-6 text-white">
                {lecture.summary.example}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-card border border-line bg-card p-5">
        <Heading level={2} className="text-base font-bold text-white">
          Словарь терминов
        </Heading>
        <div className="mt-4 flex flex-wrap gap-2">
          {termsList.map((term) => (
            <Button
              className={`rounded-full border px-3 py-2 text-xs font-semibold ${
                term === selectedTerm
                  ? "border-accent bg-accent-muted text-accent-bright"
                  : "border-line bg-elevated text-copy-muted"
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

      <section className="mt-4 overflow-hidden rounded-card border border-purple/40 bg-gradient-to-br from-purple/20 to-accent-muted p-5">
        <div className="text-xs font-bold uppercase tracking-widest text-purple-light">Закрепление материала</div>
        <Heading level={2} className="mt-2 text-lg font-bold text-white">
          Проверьте свои знания
        </Heading>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button
            className="rounded-xl bg-white px-3 py-3 text-xs font-bold text-ink"
            onClick={() => openTests("quiz")}
          >
            Тест (Quiz) <span className="block text-mini font-medium text-copy-dim">{lecture.study?.quiz?.length || 8} вопросов</span>
          </Button>
          <Button
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-xs font-bold text-white"
            onClick={() => openTests("cards")}
          >
            Флеш-карточки <span className="block text-mini font-medium text-copy-muted">{lecture.study?.flashcards?.length || 8} терминов</span>
          </Button>
        </div>
      </section>
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
      const transcript = (lecture.transcript ?? "").trim();
      if (transcript.length < 20) {
        throw new Error("There is no transcript for this lecture yet, so a test cannot be made.");
      }
      const response = await authFetch("/api/study", {
        transcript,
        title: lecture.title,
        language: lecture.outputLanguage,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
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
    } catch (err) {
      setStudyError(err instanceof Error ? err.message : "Could not create the test.");
    } finally {
      setStudyLoading(false);
    }
  };

  useEffect(() => {
    if (!study) void generateStudy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
    <div className="page-enter px-5">
      <TopBar
        subtitle={`${lecture.title} · Learn, recall, repeat`}
        title="Practice & Self-Check"
        action={
          <Button
            aria-label="Back to lecture summary"
            className="grid size-10 place-items-center rounded-full border border-line bg-card text-copy-muted"
            onClick={onBack}
          >
            <Icon name="arrow" className="size-4 rotate-180" />
          </Button>
        }
      />
      <div className="grid grid-cols-2 rounded-xl bg-card p-1">
        <Button
          className={`rounded-lg py-3 text-xs font-bold ${
            tab === "quiz" ? "bg-accent text-white shadow-glow" : "text-copy-muted"
          }`}
          onClick={() => changeTab("quiz")}
        >
          Practice Quizzes
        </Button>
        <Button
          className={`rounded-lg py-3 text-xs font-bold ${
            tab === "cards" ? "bg-accent text-white shadow-glow" : "text-copy-muted"
          }`}
          onClick={() => changeTab("cards")}
        >
          Flashcards Deck
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
            <Icon name="arrow" className="size-3 rotate-180" /> Back to quizzes
          </Button>
          <div className="mb-3 flex items-center justify-between text-xs text-copy-muted">
            <span>{activeQuiz}</span>
            <span>Question {questionIndex + 1} of {quizQuestions.length}</span>
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
                    className={`w-full rounded-xl border p-4 text-left text-sm font-semibold ${
                      correct
                        ? "border-green/40 bg-green/10 text-green"
                        : selected
                          ? "border-red/40 bg-red/10 text-red"
                          : "border-line bg-elevated text-copy-muted"
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
            className="mt-4 w-full rounded-xl bg-accent px-4 py-4 text-sm font-bold text-white disabled:opacity-40"
            disabled={selectedAnswer === null}
            onClick={nextQuestion}
          >
            {questionIndex === quizQuestions.length - 1 ? "Finish Quiz" : "Next Question"}
          </Button>
        </div>
      )}

      {tab === "quiz" && quizComplete && (
        <section className="mt-6 rounded-card border border-green/25 bg-card p-6 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-green/10 text-green">
            <Icon name="check" className="size-7" />
          </div>
          <Heading level={2} className="mt-4 text-xl font-bold text-white">Quiz complete</Heading>
          <p className="mt-2 text-sm text-copy-muted">
            You answered {quizScore} of {quizQuestions.length} questions correctly.
          </p>
          <Button className="mt-6 w-full rounded-xl bg-accent py-4 text-sm font-bold text-white" onClick={() => startQuiz(activeQuiz ?? lecture.title)}>
            Try Again
          </Button>
          <Button className="mt-3 w-full rounded-xl border border-line py-4 text-sm font-bold text-copy-muted" onClick={() => setActiveQuiz(null)}>
            Back to Quizzes
          </Button>
        </section>
      )}

      {tab === "cards" && !deckComplete && flashcards.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between text-xs text-copy-muted">
            <span>{lecture.title}</span>
            <span>Card {cardIndex + 1} of {flashcards.length}</span>
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
              {flipped ? "Definition" : "Key term"}
            </span>
            <span className="mt-5 block text-2xl font-bold leading-tight text-white">
              {(() => {
                const safeCard = flashcards[Math.min(cardIndex, flashcards.length - 1)] ?? ["", ""];
                return flipped ? safeCard[1] : safeCard[0];
              })()}
            </span>
            <span className="mt-7 text-xs text-copy-muted">Tap card to flip</span>
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
  const [voice, setVoice] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    { role: "assistant", text: `Hi! Ask me anything about “${lecture.title}”.` },
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

  return (
    <div className="page-enter flex min-h-content flex-col px-5">
      <TopBar
        subtitle={`Context: ${lecture.title}`}
        title="AI Teacher"
        action={
          <div className="flex items-center gap-2">
            <Button
              aria-label="Back to lecture summary"
              className="grid size-10 place-items-center rounded-full border border-line bg-card text-copy-muted"
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
          className={`rounded-lg py-3 text-xs font-bold ${!voice ? "bg-accent text-white" : "text-copy-muted"}`}
          onClick={() => {
            setVoice(false);
            setVoiceCallActive(false);
          }}
        >
          Text Chat
        </Button>
        <Button
          className={`rounded-lg py-3 text-xs font-bold ${voice ? "bg-purple text-white" : "text-copy-muted"}`}
          onClick={() => setVoice(true)}
        >
          Voice Call Mode
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
            {voiceCallActive ? "AI Teacher is listening" : "Ready when you are"}
          </Heading>
          <p className="mt-2 max-w-xs text-sm leading-6 text-copy-muted">
            {voiceCallActive
              ? `Voice call active · ${callTime}. Ask about ${lecture.title} or its important terms.`
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
            {voiceCallActive ? "End voice call" : "Start voice call"}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-5 py-6">
            <div>
              <div className="mb-2 text-mini font-bold uppercase tracking-wider text-copy-dim">Suggested prompts</div>
              <div className="flex flex-wrap gap-2">
                {[
                  "Explain this simpler",
                  "Give me an example",
                  "Explain the important terms",
                  "Quiz me on this lecture",
                ].map((prompt) => (
                  <Button
                    className="rounded-full border border-line bg-card px-3 py-2 text-xs font-semibold text-copy-muted"
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
                  <div className="max-w-chat rounded-2xl rounded-br-md bg-accent px-4 py-3 text-sm leading-6 text-white">
                    {item.text}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2" key={`${item.text}-${index}`}>
                  <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-xl bg-purple text-white">
                    <Icon name="sparkles" className="size-4" />
                  </div>
                  <div className="max-w-chat rounded-2xl rounded-tl-md border border-line bg-card p-4 text-sm leading-6 text-copy-muted">
                    {item.text}
                  </div>
                </div>
              ),
            )}
            {replying && (
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-light">
                <span className="size-2 animate-pulse rounded-full bg-purple" />
                AI Teacher is thinking…
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
                className="min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-copy-dim"
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && submit()}
                placeholder={listening ? "Listening…" : "Ask about this lecture..."}
                value={message}
              />
              <Button
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-white disabled:opacity-40"
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
    <div className="page-enter px-5">
      <TopBar
        subtitle={`Сохранено лекций: ${rows?.length ?? 0}`}
        title="Моя библиотека"
        action={
          <Button
            className="rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white shadow-glow"
            onClick={onRecordNew}
          >
            + Записать
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
        <Icon name="search" className="size-4 text-copy-muted" />
        <Input
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-copy-dim"
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Поиск по названию или тексту лекции..."
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
      {rows === null && <p className="text-sm text-copy-muted">Загрузка ваших лекций…</p>}
      {rows?.length === 0 && !error && (
        <div className="rounded-card border border-line bg-card p-6 text-center">
          <p className="text-sm leading-6 text-copy-muted">
            В библиотеке пока нет лекций. Запишите живую лекцию или загрузите аудио/PDF-файл!
          </p>
          <Button
            className="mt-4 rounded-xl bg-gradient-to-r from-accent to-purple px-5 py-3 text-xs font-bold text-white shadow-glow"
            onClick={onRecordNew}
          >
            Записать первую лекцию
          </Button>
        </div>
      )}
      <div className="space-y-3">
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

export default function App() {
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
    if (fileObj && isPdf) {
      try {
        fileTranscript = await extractTextFromPDF(fileObj);
      } catch (e) {
        console.error("Could not read the PDF:", e);
      }
    }

    const prefLang = getInitialProfile().defaultLang;
    const subj = presetSubject || "General Subject";
    const media = fileObj && !isPdf ? fileObj : undefined;
    setSelectedLecture({
      title: sourceFile ? sourceFile.replace(/\.[^/.]+$/, "") : subj !== "General Subject" ? `${subj} · Лекция` : "Uploaded Lecture",
      subject: subj,
      professor: "Преподаватель",
      date: new Date().toISOString().split("T")[0],
      sourceLanguage: "Russian",
      outputLanguage: prefLang,
      sourceType,
      sourceFile,
      transcript: fileTranscript,
      audioBlob: media,
      audioUrl: media ? URL.createObjectURL(media) : undefined,
      audioMimeType: media?.type,
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
    setSelectedLecture({
      title: subj !== "General Subject" ? `${subj} (${new Date().toLocaleDateString("ru-RU")})` : `Лекция ${new Date().toLocaleDateString("ru-RU")}`,
      subject: subj,
      professor: "Преподаватель",
      date: new Date().toISOString().split("T")[0],
      sourceLanguage: audio.sourceLanguage ?? "Russian",
      outputLanguage: audio.outputLanguage ?? prefLang,
      sourceType: "recording",
      sourceFile: "Lecture Recording",
      transcript: audio.transcript,
      audioBlob: audio.blob,
      audioUrl: URL.createObjectURL(audio.blob),
      audioDuration: audio.duration,
      audioMimeType: audio.mimeType,
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
    <div className="min-h-screen bg-page">
      <div className="relative mx-auto min-h-screen max-w-md overflow-x-hidden bg-app pb-page shadow-phone">
        {screen === "home" && (
          <Home
            navigate={navigate}
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
      </div>
    </div>
  );
}
