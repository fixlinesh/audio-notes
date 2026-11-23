import { useState, useEffect, useRef } from "react";
import { useTheme } from "../theme";
import { useI18n, formatDisplayDate } from "../i18n";
import { Button, Icon, Input, Select, Heading, TopBar, OverlayPanel, LanguageToggle, ThemeToggle } from "../components/ui";
import type { Screen, Language, ScheduleItem, CachedProfile, IconName } from "../types";
import { type RecordingRow, listRecordings, supabase, authFetch } from "../lib/supabase";
import { getInitialProfile, getInitialStats, avatarThemes } from "../utils/profile";
import { hasJsonContent } from "../utils/helpers";

const defaultSchedule: ScheduleItem[] = [
  { id: "1", time: "10:00", subject: "Math Analysis", place: "Room 302", status: "Сегодня" },
  { id: "2", time: "12:30", subject: "Computer Science 101", place: "Auditorium B", status: "Сегодня" },
  { id: "3", time: "15:00", subject: "Academic English", place: "Online", status: "Сегодня" },
  { id: "4", time: "09:00", subject: "Linear Algebra", place: "Room 208", status: "Завтра" },
  { id: "5", time: "13:30", subject: "Research Methods", place: "Online", status: "Завтра" },
];


export default function Home({
  navigate,
  openTests,
  onOpenRecording,
  onStartSubjectRecord,
  isGuest,
  onOpenAuth,
  onUploadFile,
}: {
  navigate: (screen: Screen) => void;
  openTests: (mode: "quiz" | "cards") => void;
  onOpenRecording: (row: RecordingRow) => Promise<void>;
  onStartSubjectRecord: (subject: string) => void;
  isGuest?: boolean;
  onOpenAuth?: () => void;
  onUploadFile?: (file: File) => void;
}) {
  const { isDark, setTheme } = useTheme();
  const { t, lang, setLang } = useI18n();
  const tr = (ru: string, kk: string, en: string) => (lang === "Kazakh" ? kk : lang === "English" ? en : ru);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);
  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && onUploadFile) {
      onUploadFile(f);
      e.target.value = "";
    }
  };
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
    const handleOpenProfile = () => {
      setProfileFeedback("");
      setProfileError("");
      refreshLibraryStats();
      setPanel("profile");
    };
    const handleOpenSearch = () => {
      setPanel("search");
    };
    window.addEventListener("leasy_open_profile", handleOpenProfile);
    window.addEventListener("leasy_open_search", handleOpenSearch);
    return () => {
      window.removeEventListener("leasy_open_profile", handleOpenProfile);
      window.removeEventListener("leasy_open_search", handleOpenSearch);
    };
  }, []);

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
  const levelTitles =
    lang === "Kazakh"
      ? ["Жаңадан бастаушы", "Тыңдаушы", "Зерттеуші", "Талдаушы", "Эрудит", "Конспект магистрі", "L-easy академигі"]
      : lang === "English"
        ? ["Newbie", "Listener", "Explorer", "Analyst", "Scholar", "Notes Master", "L-easy Academic"]
        : ["Новичок", "Слушатель", "Исследователь", "Аналитик", "Эрудит", "Магистр конспектов", "Академик L-easy"];
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
        void saveUserProfile({ avatar_url: dataUrl }, tr("Фото профиля обновлено!", "Профиль суреті жаңартылды!", "Profile photo updated!"));
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
      setProfileFeedback(customMsg ?? tr("Профиль успешно сохранён в облаке Supabase!", "Профиль Supabase бұлтында сәтті сақталды!", "Profile saved to Supabase cloud!"));
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : tr("Не удалось сохранить профиль.", "Профильді сақтау мүмкін болмады.", "Could not save the profile."));
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordUpdate = async () => {
    setProfileFeedback("");
    setProfileError("");
    if (newPassword.trim().length < 6) {
      setProfileError(tr("Пароль должен содержать минимум 6 символов.", "Құпия сөз кемінде 6 таңбадан тұруы керек.", "Password must be at least 6 characters."));
      return;
    }
    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword.trim() });
      if (error) throw error;
      setNewPassword("");
      setProfileFeedback(tr("Пароль успешно обновлён!", "Құпия сөз сәтті жаңартылды!", "Password updated!"));
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : tr("Ошибка при смене пароля.", "Құпия сөзді өзгерту қатесі.", "Error changing password."));
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
    <div className="page-enter relative px-4 sm:px-6 md:px-8 py-3 md:py-6 max-w-7xl mx-auto">
      {/* Background ambient glow effect */}
      <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-full max-w-4xl h-56 bg-gradient-to-r from-accent/15 via-purple/15 to-transparent blur-[110px] -z-10" />

      {isGuest && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-green/30 bg-green/10 px-4 py-2.5 text-mini backdrop-blur-md">
          <div className="flex items-center gap-2.5 font-semibold text-green">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-green" />
            </span>
            <span>{t.juryDemo}</span>
          </div>
          {/* Show button only on mobile where desktop navbar is hidden */}
          {onOpenAuth && (
            <Button
              className="md:hidden shrink-0 rounded-xl bg-accent px-3 py-1 text-xs font-bold text-white shadow-glow transition hover:opacity-95"
              onClick={onOpenAuth}
            >
              {t.signIn}
            </Button>
          )}
          <span className="hidden md:inline text-[11px] font-semibold text-green/80">
            {tr("Все функции разблокированы", "Барлық мүмкіндіктер ашық", "All features unlocked")}
          </span>
        </div>
      )}

      {/* Top Mobile Bar (phones only) */}
      <div className="md:hidden mb-4">
        <TopBar
          subtitle={new Date().toLocaleDateString(lang === "Kazakh" ? "kk-KZ" : lang === "English" ? "en-US" : "ru-RU", { weekday: "long", month: "long", day: "numeric" })}
          title={userName ? `${t.greeting}, ${userName}!` : `${t.greeting}, ${t.student}!`}
          showThemeToggle={false}
          action={
            <div className="flex items-center gap-2">
              <ThemeToggle compact />
              <Button
                aria-label="Search"
                className="grid size-10 place-items-center rounded-xl border border-line bg-card/80 backdrop-blur-md text-copy-muted transition hover:border-accent hover:text-accent-bright"
                onClick={() => setPanel("search")}
              >
                <Icon name="search" className="size-4" />
              </Button>
              <Button
                aria-label="Open profile menu"
                className={`relative grid size-10 place-items-center overflow-hidden rounded-xl bg-gradient-to-br ${avatarGradient} text-xs font-bold text-white ring-2 ring-card shadow-sm`}
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
      </div>

      {/* Top Desktop Bar (PC / Laptops) */}
      <div className="hidden md:flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 mb-2">
            <span className="size-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent-bright">
              {university || "Astana IT University"} · AI Workspace
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
            {userName ? `${t.greeting}, ${userName}!` : `${t.greeting}, ${t.student}!`}
          </h1>
          <p className="mt-1 text-xs text-copy-muted">
            {formatDisplayDate(lang)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={pdfFileInputRef}
            accept=".pdf,application/pdf,text/*,.txt,.md,audio/*,video/*"
            className="hidden"
            onChange={handlePdfSelect}
          />
          <div className="inline-flex items-center gap-2 rounded-2xl border border-line bg-card/60 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-copy-muted">
            <span className="size-2 rounded-full bg-green animate-pulse" />
            <span className="text-copy">{tr("Облако синхронизировано", "Бұлтпен байланыс белсенді", "Cloud Sync Active")}</span>
          </div>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Hero Action Cards, Schedule, Telemetry */}
        <div className="lg:col-span-7 space-y-6">

          {/* Bento Action Cards: Record & PDF */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Record Card */}
            <div
              role="button"
              tabIndex={0}
              className="record-cta group relative overflow-hidden rounded-3xl border border-accent/50 bg-gradient-to-br from-blue-deep via-accent to-purple p-5 sm:p-6 text-left shadow-lg shadow-accent/25 transition-all duration-300 hover:shadow-accent/40 hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between min-h-[170px]"
              onClick={() => navigate("record")}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate("record"); } }}
            >
              {/* Decorative mesh glows */}
              <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-white/10 blur-2xl group-hover:bg-white/20 transition" />
              <div className="pointer-events-none absolute -left-12 -bottom-12 size-40 rounded-full bg-purple/30 blur-2xl" />

              <div className="relative">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white border border-white/30">
                  <span className="size-1.5 rounded-full bg-white animate-ping" />
                  {t.oneTapCapture}
                </div>
                <h3 className="mt-2.5 text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  {t.recordLecture}
                </h3>
                <p className="mt-1 text-xs text-blue-100/90 leading-relaxed line-clamp-2">
                  {t.recordDesc}
                </p>
              </div>

              <div className="relative mt-4 flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-white transition flex items-center gap-1.5">
                  <span>{tr("Запись лекции", "Дәріс жазу", "Start recording")}</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </span>
                <span className="grid size-11 place-items-center rounded-2xl bg-white text-accent shadow-mic group-hover:scale-110 transition duration-300 shrink-0">
                  <Icon name="mic" className="size-5" />
                </span>
              </div>
            </div>

            {/* Upload PDF Card */}
            <div
              role="button"
              tabIndex={0}
              className="group relative overflow-hidden rounded-3xl border border-purple/30 bg-gradient-to-br from-card/90 via-card/60 to-elevated/80 backdrop-blur-xl p-5 sm:p-6 text-left shadow-lg shadow-purple/5 transition-all duration-300 hover:border-purple/70 hover:shadow-purple/15 hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between min-h-[170px]"
              onClick={() => pdfFileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pdfFileInputRef.current?.click(); } }}
            >
              <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-purple/20 blur-3xl group-hover:bg-purple/30 transition" />

              <div className="relative">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-purple/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-light border border-purple/25">
                  <Icon name="document" className="size-3" />
                  {tr("PDF · DOCX · Аудио", "PDF · DOCX · Аудио", "PDF · DOCX · Audio")}
                </div>
                <h3 className="mt-2.5 text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  {tr("Загрузить файл", "Файлды жүктеу", "Upload Document")}
                </h3>
                <p className="mt-1 text-xs text-copy-muted leading-relaxed line-clamp-2">
                  {tr(
                    "Загрузите PDF или аудио лекции для мгновенного конспекта, карточек и тестов.",
                    "Дәріс материалын жүктеп, лезде конспект пен тест құрастырыңыз.",
                    "Upload lecture PDF or audio for instant summary, flashcards, and quizzes."
                  )}
                </p>
              </div>

              <div className="relative mt-4 flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-purple-light group-hover:text-white transition flex items-center gap-1.5">
                  <span>{tr("Выбрать файл", "Файлды таңдау", "Choose file")}</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </span>
                <span className="grid size-11 place-items-center rounded-2xl bg-purple/20 text-purple-light border border-purple/30 group-hover:scale-110 group-hover:bg-purple group-hover:text-white transition duration-300 shrink-0">
                  <Icon name="document" className="size-5" />
                </span>
              </div>
            </div>
          </div>

          {/* Today's Schedule Card */}
          <section className="rounded-3xl border border-line bg-card/70 backdrop-blur-xl p-5 sm:p-6 shadow-sm transition hover:border-line-hover">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-xl bg-accent/15 text-accent-bright">
                  <Icon name="calendar" className="size-4" />
                </span>
                <Heading level={2} className="text-base sm:text-lg font-bold text-white">
                  {t.todaySchedule}
                </Heading>
              </div>
              <Button
                className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent-bright transition hover:bg-accent hover:text-white"
                onClick={() => {
                  setScheduleNotice("");
                  setPanel("schedule");
                }}
              >
                {lang === "Kazakh"
                  ? `Өзгерту (${scheduleItems.length})`
                  : lang === "English"
                    ? `Edit (${scheduleItems.length})`
                    : `Изменить (${scheduleItems.length})`}
              </Button>
            </div>
            <div className="space-y-3">
              {scheduleItems.length === 0 && (
                <div className="rounded-2xl border border-line/60 bg-elevated/40 p-6 text-center text-xs text-copy-muted">
                  {t.noSchedule}
                </div>
              )}
              {scheduleItems.slice(0, 3).map((item, index) => (
                <div
                  className={`group flex items-center gap-3.5 rounded-2xl border p-3.5 sm:p-4 transition ${
                    index === 0
                      ? "border-accent/40 bg-accent/5 hover:border-accent"
                      : "border-line bg-elevated/40 hover:border-line-hover hover:bg-elevated/70"
                  }`}
                  key={item.id}
                >
                  <div className="min-w-[80px] shrink-0">
                    <div className="text-xs font-bold text-white">{item.time}</div>
                    <div className={`mt-0.5 text-[11px] font-semibold ${index === 0 ? "text-accent-bright" : "text-copy-dim"}`}>
                      {item.status === "Сегодня" ? t.today : item.status === "Завтра" ? t.tomorrow : item.status}
                    </div>
                  </div>
                  <div className="h-9 w-px bg-line shrink-0" />
                  <Button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      startEditScheduleItem(item);
                      setPanel("schedule");
                    }}
                    title="Нажмите, чтобы изменить предмет"
                  >
                    <div className="truncate text-sm font-bold text-white group-hover:text-accent-bright transition">{item.subject}</div>
                    <div className="mt-0.5 text-xs text-copy-muted flex items-center gap-1.5">
                      <span className="size-1 rounded-full bg-copy-dim" />
                      <span>{item.place}</span>
                    </div>
                  </Button>
                  <Button
                    aria-label={`Record ${item.subject}`}
                    className={`grid size-10 shrink-0 place-items-center rounded-xl transition duration-200 active:scale-95 ${
                      index === 0 ? "bg-accent text-white shadow-glow hover:brightness-110" : "bg-elevated text-copy-muted hover:text-white hover:border hover:border-accent/40"
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

          {/* Smart Sensor & Telemetry Card */}
          <section className="rounded-3xl border border-accent/30 bg-gradient-to-br from-card/90 via-card/60 to-elevated/80 backdrop-blur-xl p-5 sm:p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-xl bg-green/15 text-green">
                  <Icon name="sparkles" className="size-4" />
                </span>
                <Heading level={2} className="text-base sm:text-lg font-bold text-white">
                  Smart Acoustic & Data Layer
                </Heading>
              </div>
              <span className="rounded-full border border-green/30 bg-green/10 px-2.5 py-0.5 text-mini font-bold text-green flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-green animate-pulse" />
                Live A3 + A4
              </span>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-accent-bright">
                PostgreSQL (Supabase) + Acoustic Telemetry
              </div>
              <p className="mt-1 text-xs leading-5 text-copy-muted">
                {tr(
                  "Хранилище: qcathxqziocmdjqflrsv.supabase.co (PostgreSQL 15 RLS + 6 таблиц). Web Audio модуль (EC/NS/AGC = false) измеряет уровень в dBFS, широкополосный SNR_bb и управляется 120 Гц Biquad HPF фильтром.",
                  "Қойма: qcathxqziocmdjqflrsv.supabase.co (PostgreSQL 15 RLS + 6 кесте). Web Audio модулі (EC/NS/AGC = false) dBFS деңгейін, кең жолақты SNR_bb өлшейді және 120 Гц Biquad HPF сүзгісімен басқарылады.",
                  "Storage: qcathxqziocmdjqflrsv.supabase.co (PostgreSQL 15 RLS + 6 tables). Web Audio pipeline (EC/NS/AGC = false) measures level in dBFS, broadband SNR_bb, and toggles a 120 Hz Biquad HPF."
                )}
              </p>
            </div>

            {/* Live Metrics Grid */}
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl border border-green/20 bg-green/5 p-3 text-center">
                <div className="text-base sm:text-lg font-extrabold text-green">-25.6 dBFS</div>
                <div className="mt-0.5 text-[11px] font-medium text-copy-muted">{tr("Уровень (EN dBFS)", "Деңгей (EN dBFS)", "Digital Level (dBFS)")}</div>
              </div>
              <div className="rounded-2xl border border-accent/20 bg-accent/5 p-3 text-center">
                <div className="text-base sm:text-lg font-extrabold text-accent-bright">29.2 dB</div>
                <div className="mt-0.5 text-[11px] font-medium text-copy-muted">{tr("SNR_bb (EN HPF)", "SNR_bb (EN HPF)", "Broadband SNR_bb")}</div>
              </div>
              <div className="rounded-2xl border border-purple/20 bg-purple/5 p-3 text-center">
                <div className="text-base sm:text-lg font-extrabold text-purple-light">7.28% WER</div>
                <div className="mt-0.5 text-[11px] font-medium text-copy-muted">Gemini x5 (EN HPF)</div>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <Button
                className="flex-1 rounded-xl border border-accent/40 bg-accent/15 py-2.5 px-3 text-xs font-bold text-accent-bright transition hover:bg-accent hover:text-white"
                onClick={() => setPanel("telemetry")}
              >
                {tr("📊 Data Layer, ERD и телеметрия (Task 1 & 4)", "📊 Data Layer, ERD және телеметрия (Task 1 & 4)", "📊 Open Data Layer, ERD & Telemetry")}
              </Button>
              <a
                href="/surveys.html"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-line bg-elevated/60 py-2.5 px-3 text-center text-xs font-semibold text-copy-muted transition hover:border-accent hover:text-white flex items-center justify-center gap-1.5"
              >
                <span>{tr("📋 Опрос студентов (N=64)", "📋 Студенттер сауалнамасы (N=64)", "📋 Student Surveys (N=64)")}</span>
                <span className="text-[10px]">↗</span>
              </a>
            </div>
          </section>
        </div>

        {/* Right Column (5 cols): Stats Bento, Quick Hub, Recent Lectures */}
        <div className="lg:col-span-5 space-y-6">

          {/* Study Stats Bento */}
          <section className="rounded-3xl border border-line bg-card/70 backdrop-blur-xl p-5 sm:p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <Heading level={2} className="text-base sm:text-lg font-bold text-white">
                {t.studyStats}
              </Heading>
              <span className="text-xs font-semibold text-copy-dim">
                {formatDisplayDate(lang).split(",")[0]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="group rounded-2xl border border-line bg-elevated/40 p-4 transition hover:border-accent/50 hover:bg-elevated/70">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-copy-muted">{t.statLectures}</span>
                  <span className="size-2 rounded-full bg-accent/60" />
                </div>
                <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {libraryCount !== null ? libraryCount : "0"}
                </div>
              </div>
              <div className="group rounded-2xl border border-line bg-elevated/40 p-4 transition hover:border-accent-bright/50 hover:bg-elevated/70">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-copy-muted">{t.statSummaries}</span>
                  <span className="size-2 rounded-full bg-accent-bright" />
                </div>
                <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-accent-bright tracking-tight">
                  {summariesCount}
                </div>
              </div>
              <div className="group rounded-2xl border border-line bg-elevated/40 p-4 transition hover:border-purple/50 hover:bg-elevated/70">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-copy-muted">{t.statQuizzes}</span>
                  <span className="size-2 rounded-full bg-purple" />
                </div>
                <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-purple-light tracking-tight">
                  {quizzesCount}
                </div>
              </div>
              <div className="group rounded-2xl border border-line bg-elevated/40 p-4 transition hover:border-green/50 hover:bg-elevated/70">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-copy-muted">{t.statMinutes}</span>
                  <span className="size-2 rounded-full bg-green" />
                </div>
                <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-green tracking-tight">
                  {totalMinutes}
                </div>
              </div>
            </div>
          </section>

          {/* Quick Practice Hub */}
          <section className="rounded-3xl border border-line bg-card/70 backdrop-blur-xl p-5 sm:p-6 shadow-sm">
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
                  className="group rounded-2xl border border-line bg-elevated/40 p-3.5 text-left transition-all duration-200 hover:border-accent hover:bg-elevated hover:-translate-y-0.5"
                  key={targetScreen}
                  onClick={() => {
                    if (targetScreen === "library") navigate("library");
                    else if (targetScreen === "tests") openTests("quiz");
                    else navigate("teacher");
                  }}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <span className="grid size-8 place-items-center rounded-xl bg-accent-muted text-accent-bright group-hover:bg-accent group-hover:text-white transition">
                      <Icon name={icon as IconName} className="size-4" />
                    </span>
                    <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold text-copy-muted border border-line">
                      {badge}
                    </span>
                  </div>
                  <span className="block text-xs font-bold text-white truncate group-hover:text-accent-bright transition">
                    {label}
                  </span>
                </Button>
              ))}
            </div>
          </section>

          {/* Recent Recordings List */}
          {recentRows.length > 0 && (
            <section className="rounded-3xl border border-line bg-card/70 backdrop-blur-xl p-5 sm:p-6 shadow-sm">
              <div className="mb-3.5 flex items-center justify-between">
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
                    className="group flex w-full items-center justify-between rounded-2xl border border-line bg-elevated/40 p-3.5 text-left transition hover:border-accent hover:bg-elevated"
                    key={row.id}
                    onClick={() => void onOpenRecording(row)}
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="truncate text-sm font-bold text-white group-hover:text-accent-bright transition">{row.title ?? t.navRecord}</div>
                      <div className="mt-0.5 text-xs text-copy-muted">
                        {row.created_at ? new Date(row.created_at).toLocaleDateString() : t.today}
                      </div>
                    </div>
                    <span className="grid size-7 place-items-center rounded-lg bg-card/80 text-accent-bright group-hover:translate-x-0.5 transition">
                      <Icon name="arrow" className="size-3.5 shrink-0" />
                    </span>
                  </Button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>


      {panel === "telemetry" && (
        <OverlayPanel
          title={tr("Smart Technology & Data Layer", "Smart Technology және деректер қабаты", "Smart Technology & Data Layer")}
          subtitle={tr("Assignment 3 (PostgreSQL) + Assignment 4 (Acoustic Telemetry)", "Assignment 3 (PostgreSQL) + Assignment 4 (Акустикалық телеметрия)", "Assignment 3 (PostgreSQL) + Assignment 4 (Acoustic Telemetry)")}
          onClose={() => setPanel(null)}
        >
          <div className="space-y-4">
            <section className="rounded-card border border-green/30 bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-green">{tr("1. Где хранятся данные (Assignment 3)", "1. Деректер қайда сақталады (Assignment 3)", "1. Data Storage Layer (Assignment 3)")}</span>
                <span className="rounded-full bg-green/15 px-2.5 py-0.5 text-mini font-bold text-green">Working Live</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-copy-muted">
                {tr(
                  "Все пользовательские данные хранятся в облачной СУБД PostgreSQL 15 (Supabase Cloud) на инстансе qcathxqziocmdjqflrsv.supabase.co с защитой политиками PostgreSQL Row-Level Security (RLS) на уровне СУБД:",
                  "Барлық пайдаланушы деректері qcathxqziocmdjqflrsv.supabase.co инстансындағы PostgreSQL 15 (Supabase Cloud) бұлттық жүйесінде Row-Level Security (RLS) қорғанысымен сақталады:",
                  "All user data is stored in PostgreSQL 15 (Supabase Cloud) on instance qcathxqziocmdjqflrsv.supabase.co with PostgreSQL database-engine Row-Level Security (RLS):"
                )}
              </p>
              <ul className="mt-2.5 space-y-1.5 text-xs text-copy-muted">
                <li>• <strong className="text-white">public.recordings</strong> — {tr("метаданные лекций, длительность, транскрипты и JSONB-конспекты", "дәріс метадеректері, ұзақтығы, транскрипттер және JSONB-конспектілер", "lecture metadata, duration, transcripts and JSONB summaries")}</li>
                <li>• <strong className="text-white">public.flashcards</strong> — {tr("термины и определения для активного припоминания", "белсенді қайталауға арналған терминдер мен анықтамалар", "terms & definitions for active recall")}</li>
                <li>• <strong className="text-white">public.quiz_questions</strong> — {tr("проверочные вопросы с 4 вариантами и объяснениями", "4 нұсқалы және түсіндірмелі тест сұрақтары", "quiz questions with 4 options and rationale")}</li>
                <li>• <strong className="text-white">public.smart_audio_telemetry</strong> — {tr("телеметрия датчика: уровень dBFS, широкополосный SNR_bb, темп WPM, статус 120 Гц HPF", "датчик телеметриясы: dBFS деңгейі, кең жолақты SNR_bb, WPM қарқыны, 120 Гц HPF күйі", "sensor telemetry: dBFS level, broadband SNR_bb, speech rate WPM, 120 Hz HPF state")}</li>
                <li>• <strong className="text-white">storage.objects (bucket: audio)</strong> — {tr("приватное хранилище аудиофайлов с временными подписанными URL Supabase Storage (1 ч)", "уақытша қол қойылған Supabase Storage URL (1 сағ) арқылы жеке аудио қоймасы", "private audio storage with time-limited signed URLs (1-hour expiry)")}</li>
              </ul>
            </section>

            <section className="rounded-card border border-accent/35 bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-accent-bright">{tr("2. Web Audio DSP (EC/NS/AGC = OFF), 5-кратный Gemini и Whisper Large-v3T", "2. Web Audio DSP (EC/NS/AGC = OFF), 5x Gemini және Whisper Large-v3T", "2. Web Audio DSP (EC/NS/AGC = OFF), 5x Gemini & Whisper Large-v3T")}</span>
                <span className="rounded-full bg-accent-muted px-2.5 py-0.5 text-mini font-bold text-accent-bright">Wilcoxon + Large-v3T</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-copy-muted">
                {tr(
                  "При записи отключается скрытая DSP-обработка браузера (echoCancellation, noiseSuppression, autoGainControl = false), вычисляются относительный уровень (dBFS), широкополосный SNR_bb и управляется Biquad High-Pass фильтр 2-го порядка (120 Гц, Q = 0.707):",
                  "Жазу кезінде браузердің жасырын DSP өңдеуі өшіріліп (echoCancellation, noiseSuppression, autoGainControl = false), салыстырмалы dBFS деңгейі, кең жолақты SNR_bb есептеледі және 2-ретті Biquad High-Pass сүзгісі (120 Гц, Q = 0.707) басқарылады:",
                  "Recording disables hidden browser DSP (echoCancellation, noiseSuppression, autoGainControl = false), computes uncalibrated digital level (dBFS) and broadband SNR_bb, and toggles a 2nd-order Butterworth 120 Hz Biquad High-Pass filter (Q = 0.707):"
                )}
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-mini text-copy-muted">
                  <thead>
                    <tr className="border-b border-line text-white">
                      <th className="py-1.5 pr-2">{tr("Набор / Метрика", "Жинақ / Метрика", "Dataset / Metric")}</th>
                      <th className="py-1.5 px-2">SNR_bb (Raw → HPF)</th>
                      <th className="py-1.5 px-2">{tr("Gemini x5 WER (R → H)", "Gemini x5 WER (R → H)", "Gemini x5 WER (R → H)")}</th>
                      <th className="py-1.5 pl-2">{tr("Whisper L-v3T / Base (R → H)", "Whisper L-v3T / Base (R → H)", "Whisper L-v3T / Base (R → H)")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    <tr>
                      <td className="py-1.5 pr-2 font-semibold text-green">{tr("EN реальные (N = 4)", "EN нақты (N = 4)", "EN Real (N = 4)")}</td>
                      <td className="py-1.5 px-2">29.07 → 29.20 dB</td>
                      <td className="py-1.5 px-2 text-white">7.76 ± 3.23% → 7.28 ± 2.57%</td>
                      <td className="py-1.5 pl-2 text-copy-muted">
                        <div>L-v3T: 8.49% → 10.39%</div>
                        <div className="text-copy-dim">Base: 20.23% → 20.91%</div>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-2 font-semibold text-purple-light">{tr("RU FLEURS 12-utt (3 зоны)", "RU FLEURS 12-utt (3 аймақ)", "RU FLEURS 12-utt (3 zones)")}</td>
                      <td className="py-1.5 px-2">20.23 → 25.34 dB</td>
                      <td className="py-1.5 px-2 text-white">9.01 ± 4.94% → 9.87 ± 8.04%</td>
                      <td className="py-1.5 pl-2 text-copy-muted">
                        <div>L-v3T: 12.02% → 12.66%</div>
                        <div className="text-copy-dim">Base: 38.62% → 37.98%</div>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-2 font-semibold text-purple-light">{tr("KZ FLEURS 12-utt (3 зоны)", "KZ FLEURS 12-utt (3 аймақ)", "KZ FLEURS 12-utt (3 zones)")}</td>
                      <td className="py-1.5 px-2">25.47 → 29.20 dB</td>
                      <td className="py-1.5 px-2 text-green">19.27 ± 5.82% → 16.72 ± 1.11%</td>
                      <td className="py-1.5 pl-2 text-red">
                        <div>L-v3T: 46.60% → 48.10%</div>
                        <div className="text-copy-dim">Base: 164.51% → 149.75%</div>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-2 font-semibold text-accent-bright">{tr("Уилкоксон (N = 10)", "Уилкоксон (N = 10)", "Wilcoxon (N = 10)")}</td>
                      <td className="py-1.5 px-2">{tr("Синт. HVAC: +4.81…+5.24 dB", "Синт. HVAC: +4.81…+5.24 dB", "Synth HVAC: +4.81 to +5.24 dB")}</td>
                      <td className="py-1.5 px-2 text-copy-muted">6↑ / 3↓ / 1= (exact p = 0.52)</td>
                      <td className="py-1.5 pl-2 text-copy-muted">L-v3T: p = 0.45 · Base: p = 0.36</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2.5 text-mini text-copy-dim">
                {tr(
                  "Честный вывод парного теста (5 прогонов gemini-3.5-flash-lite на клип, N = 10): 120 Гц HPF повышает SNR_bb на синтетическом HVAC-шуме (+4.81…+5.24 дБ по конструкции; +5.35 дБ на RU-1 Quiet связано с низкочастотным фоном пауз исходных записей FLEURS), но на реальных записях EN сдвиг минимален (-0.29…+0.52 дБ), и точный двусторонний тест Уилкоксона не выявил статистически значимого влияния на WER (p = 0.52 для Gemini, p = 0.45 для Whisper Large-v3-Turbo, p = 0.36 для Whisper Base; совместимо с устойчивостью современных ASR при N=10). На выборке из 12 казахских фраз FLEURS Gemini даёт заметно меньше ошибок, чем Whisper Large-v3-Turbo (16.72–19.27% против 46.60–48.10% WER при высоком разбросе SD до 7.8 п.п.).",
                  "Жұптық тесттің әділ қорытындысы (әр клипке 5 gemini-3.5-flash-lite прогоны, N = 10): 120 Гц HPF синтетикалық HVAC шуында SNR_bb-ді арттырады (+4.81…+5.24 дБ сүзгі дизайны бойынша; RU-1 Quiet-тағы +5.35 дБ бастапқы FLEURS үзіліс фонына байланысты), бірақ нақты EN жазбаларында айырмашылық шамалы (-0.29…+0.52 дБ) және дәл Уилкоксон тесті WER бойынша статистикалық маңызды әсер көрсетпеді (p = 0.52 Gemini, p = 0.45 Whisper Large-v3-Turbo, p = 0.36 Whisper Base). Соған қарамастан 12 қазақша FLEURS сөйлемінде Gemini Whisper Large-v3-Turbo-дан аз қате береді (16.72–19.27% vs 46.60–48.10% WER, SD 7.8 п.т. дейін).",
                  "Honest paired finding (5 strict gemini-3.5-flash-lite runs/clip, N = 10): 120 Hz HPF raises SNR_bb on synthetic HVAC noise (+4.81 to +5.24 dB by construction; +5.35 dB on RU-1 Quiet stems from low-frequency pause hum native to source FLEURS clips) while real EN captures shift minimally (-0.29 to +0.52 dB), with no statistically detectable WER change under exact two-sided Wilcoxon tests (p = 0.52 Gemini, p = 0.45 Whisper Large-v3-Turbo, p = 0.36 Whisper Base; consistent with neural ASR robustness at N=10). On our 12-utterance Kazakh FLEURS sample, Gemini achieves lower WER than Whisper Large-v3-Turbo (16.72–19.27% vs. 46.60–48.10%), with run SD up to 7.8 pp."
                )}
              </p>
            </section>

            <section className="rounded-card border border-line bg-card p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-white">{tr("3. Честный статус функций (Done / Partly / Planned)", "3. Функциялардың нақты күйі (Done / Partly / Planned)", "3. Honest Feature Status (Done / Partly / Planned)")}</div>
              <div className="mt-2.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-copy-muted">{tr("Запись аудио, загрузка PDF/аудио и плеер", "Аудио жазу, PDF/аудио жүктеу және ойнатқыш", "Audio recording, PDF/audio upload & player")}</span>
                  <span className="font-bold text-green">{tr("Done (Работает)", "Done (Жұмыс істейді)", "Done (Working live)")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-copy-muted">{tr("ИИ-конспект, словарь, квизы, карточки и AI Teacher (Gemini)", "AI-конспект, сөздік, тесттер, карточкалар және AI Оқытушы (Gemini)", "AI summary, glossary, quizzes, flashcards & AI Teacher (Gemini)")}</span>
                  <span className="font-bold text-green">{tr("Done (Работает)", "Done (Жұмыс істейді)", "Done (Working live)")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-copy-muted">{tr("База PostgreSQL + RLS + таблица smart_audio_telemetry", "PostgreSQL + RLS базасы + smart_audio_telemetry кестесі", "PostgreSQL + RLS DB + smart_audio_telemetry table")}</span>
                  <span className="font-bold text-green">{tr("Done (Работает)", "Done (Жұмыс істейді)", "Done (Working live)")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-copy-muted">{tr("Акустический сенсор (dBFS / SNR_bb) и 120 Гц HPF (DSP=false)", "Акустикалық сенсор (dBFS / SNR_bb) және 120 Гц HPF (DSP=false)", "In-browser sensor (dBFS / Broadband SNR) & 120 Hz HPF (DSP=false)")}</span>
                  <span className="font-bold text-accent-bright">Done (Web Audio Live)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-copy-muted">{tr("Внешний BLE-петличный смарт-микрофон и офлайн Whisper", "Сыртқы BLE-ілмекті смарт-микрофон және офлайн Whisper", "External BLE lapel smart mic & offline Whisper")}</span>
                  <span className="font-bold text-copy-dim">{tr("Planned (В планах)", "Planned (Жоспарда)", "Planned")}</span>
                </div>
              </div>
              <a
                href="/surveys.html"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3.5 block w-full rounded-xl border border-accent/40 bg-accent-muted py-2 text-center text-xs font-bold text-accent-bright transition hover:border-accent"
              >
                {tr("📋 Открыть данные и графики опроса студентов (N = 8 + 38 + 18 = 64) ↗", "📋 Студенттер сауалнамасының деректері мен графиктерін ашу (N = 8 + 38 + 18 = 64) ↗", "📋 Open student survey data & charts (N = 8 + 38 + 18 = 64) ↗")}
              </a>
            </section>
          </div>
        </OverlayPanel>
      )}

      {panel === "search" && (
        <OverlayPanel title={tr("Поиск по L-easy", "L-easy бойынша іздеу", "Search L-easy")} subtitle={tr("Ваши лекции, конспекты и разделы", "Сіздің дәрістеріңіз, конспектілеріңіз және бөлімдеріңіз", "Your lectures, notes and sections")} onClose={() => setPanel(null)}>
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
            <Icon name="search" className="size-4 text-copy-muted" />
            <Input
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-copy-dim"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tr("Поиск по названию, тексту или терминам...", "Атауы, мәтіні немесе терминдері бойынша іздеу...", "Search by title, text, or terms...")}
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
                    {tr("Мои лекции", "Менің дәрістерім", "My lectures")} ({matchedRows.length})
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
                            {row.title ?? tr("Лекция без названия", "Атаусыз дәріс", "Untitled lecture")}
                          </span>
                          <span className="mt-1 block truncate text-xs text-copy-muted">
                            {row.created_at ? new Date(row.created_at).toLocaleDateString(lang === "Kazakh" ? "kk-KZ" : lang === "English" ? "en-US" : "ru-RU") : ""}
                            {hasJsonContent(row.summary) ? ` · ${tr("ИИ-конспект", "AI-конспект", "AI Summary")}` : ""}
                            {hasJsonContent(row.study) ? ` · ${tr("Тест готов", "Тест дайын", "Quiz Ready")}` : ""}
                          </span>
                        </span>
                        <Icon name="arrow" className="size-4 shrink-0 text-accent-bright" />
                      </Button>
                    ))}
                    {matchedRows.length === 0 && (
                      <div className="rounded-2xl border border-line bg-card p-4 text-center text-xs text-copy-muted">
                        {tr(`Лекции по запросу «${query}» не найдены.`, `«${query}» сұранысы бойынша дәрістер табылмады.`, `No lectures found for "${query}".`)}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-mini font-bold uppercase tracking-wider text-copy-muted">
                    {tr("Быстрые переходы", "Жылдам өтулер", "Quick Navigation")}
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
        <OverlayPanel title={tr("Профиль студента", "Студент профилі", "Student Profile")} subtitle={tr("L-easy · Личный кабинет", "L-easy · Жеке кабинет", "L-easy · Personal account")} onClose={() => setPanel(null)}>
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
                aria-label={tr("Изменить фото профиля", "Профиль суретін өзгерту", "Change profile photo")}
                className={`group relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br ${avatarGradient} text-xl font-bold text-white shadow-glow ring-2 ring-white/20`}
                onClick={() => avatarInputRef.current?.click()}
                title={tr("Нажмите, чтобы загрузить фото", "Сурет жүктеу үшін басыңыз", "Click to upload a photo")}
              >
                {avatarUrl ? (
                  <img alt={userName || "Avatar"} className="size-full object-cover" src={avatarUrl} />
                ) : (
                  <span>{initials}</span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                  {tr("Фото", "Сурет", "Photo")}
                </span>
              </Button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate text-base font-bold text-white">{userName || tr("Студент", "Студент", "Student")}</div>
                  <span className="shrink-0 rounded-full bg-accent-muted px-2.5 py-0.5 text-mini font-bold text-accent-bright">
                    {tr("Ур.", "Деңг.", "Lv.")} {level} · {levelTitle}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-xs text-copy-muted">{userEmail || tr("Активный аккаунт", "Белсенді аккаунт", "Active account")}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-purple-light">
                  <span>{university}</span>
                  <span>·</span>
                  <span>{major}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-elevated p-3">
              <div className="flex items-center justify-between text-xs font-semibold text-white">
                <span>{tr("Уровень", "Деңгей", "Level")} {level} ({xp} XP)</span>
                <span className="text-copy-muted">{tr(`Ещё ${150 - (xp % 150)} XP до Ур. ${level + 1}`, `${level + 1}-деңгейге дейін ${150 - (xp % 150)} XP қалды`, `${150 - (xp % 150)} XP to Lv. ${level + 1}`)}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-card">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-purple transition-all duration-500"
                  style={{ width: `${Math.max(10, levelProgress)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-mini text-copy-muted">
                <span>{tr("+50 XP за лекцию", "+50 XP дәріс үшін", "+50 XP per lecture")}</span>
                <span>{tr("+40 XP за конспект", "+40 XP конспект үшін", "+40 XP per summary")}</span>
                <span>{tr("+60 XP за тест", "+60 XP тест үшін", "+60 XP per quiz")}</span>
              </div>
            </div>
          </section>

          {/* Реальная статистика из базы Supabase */}
          <section className="mt-3 grid grid-cols-4 gap-2">
            {[
              [String(libraryCount ?? 0), tr("Лекций", "Дәрістер", "Lectures"), "text-accent-bright"],
              [String(summariesCount), tr("Конспектов", "Конспектілер", "Summaries"), "text-purple-light"],
              [String(quizzesCount), tr("Квизов", "Квиздер", "Quizzes"), "text-green"],
              [`${totalMinutes}${tr("м", "мин", "m")}`, tr("Аудио", "Аудио", "Audio"), "text-white"],
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
              ["overview", tr("Настройки", "Баптаулар", "Settings")],
              ["edit", tr("Данные", "Деректер", "Details")],
              ["security", tr("Аккаунт", "Аккаунт", "Account")],
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
                  <div className="text-xs font-bold text-white">{tr("Тема оформления", "Безендіру тақырыбы", "Appearance theme")}</div>
                  <div className="mt-0.5 text-mini text-copy-muted">
                    {isDark ? tr("Тёмная тема", "Қараңғы тақырып", "Dark theme") : tr("Светлая тема (по умолчанию)", "Жарық тақырып (әдепкі)", "Light theme (default)")}
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
                    {tr("Светлая", "Жарық", "Light")}
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
                    {tr("Тёмная", "Қараңғы", "Dark")}
                  </Button>
                </div>
              </div>

              {/* Язык интерфейса приложения */}
              <div className="rounded-2xl border border-line bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-white">{tr("Язык интерфейса", "Интерфейс тілі", "Interface language")}</div>
                    <div className="mt-0.5 text-mini text-copy-muted">{tr("Кнопки, меню, карточки и навигация", "Батырмалар, мәзір, карточкалар мен навигация", "Buttons, menus, cards and navigation")}</div>
                  </div>
                  <div className="flex items-center gap-1 rounded-xl border border-line bg-elevated p-1">
                    {[
                      { id: "Kazakh" as const, label: "ҚАЗ" },
                      { id: "Russian" as const, label: "РУС" },
                      { id: "English" as const, label: "ENG" },
                    ].map((opt) => (
                      <Button
                        key={opt.id}
                        type="button"
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          lang === opt.id ? "bg-accent text-white shadow-glow" : "text-copy-muted hover:text-white"
                        }`}
                        onClick={() => {
                          setLang(opt.id);
                          setDefaultLang(opt.id);
                          void saveUserProfile({ default_lang: opt.id }, `${tr("Интерфейс тілі өзгертілді", "Язык интерфейса изменён", "Interface language changed")}: ${opt.label}`);
                        }}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-white">{tr("Язык ИИ-конспектов по умолчанию", "AI-конспектілердің әдепкі тілі", "Default AI summary language")}</div>
                    <div className="mt-0.5 text-mini text-copy-muted">{tr("Для Summary, Notes и AI Teacher", "Summary, Notes және AI Оқытушы үшін", "For Summary, Notes and AI Teacher")}</div>
                  </div>
                  <Select
                    className="rounded-xl border border-line bg-elevated px-3 py-2 text-xs font-bold text-white"
                    onChange={(e) => {
                      const nextLang = e.target.value as Language;
                      setDefaultLang(nextLang);
                      setLang(nextLang);
                      void saveUserProfile({ default_lang: nextLang }, `${tr("Язык по умолчанию", "Әдепкі тіл", "Default language")}: ${nextLang}`);
                    }}
                    value={defaultLang}
                  >
                    <option value="Kazakh">Қазақша</option>
                    <option value="Russian">Русский</option>
                    <option value="English">English</option>
                  </Select>
                </div>
              </div>

              {[
                {
                  title: tr("Живая транскрипция при записи", "Жазу кезіндегі тірі транскрипция", "Live transcript while recording"),
                  desc: tr("Распознавать речь в реальном времени", "Сөйлеуді нақты уақытта тану", "Recognize speech in real time"),
                  value: autoTranscribe,
                  toggle: () => {
                    const next = !autoTranscribe;
                    setAutoTranscribe(next);
                    void saveUserProfile({ auto_transcribe: next }, tr("Настройка транскрипции сохранена", "Транскрипция баптауы сақталды", "Transcription setting saved"));
                  },
                },
                {
                  title: tr("Акустическое шумоподавление", "Акустикалық шуды басу", "Acoustic noise reduction"),
                  desc: tr("Фильтровать шум аудитории при записи", "Жазу кезінде аудитория шуын сүзу", "Filter classroom noise while recording"),
                  value: defaultNoiseFilter,
                  toggle: () => {
                    const next = !defaultNoiseFilter;
                    setDefaultNoiseFilter(next);
                    void saveUserProfile({ default_noise_filter: next }, tr("Настройка фильтра шума сохранена", "Шу сүзгісінің баптауы сақталды", "Noise filter setting saved"));
                  },
                },
                {
                  title: tr("Голосовая озвучка AI Teacher", "AI Оқытушының дауыспен жауабы", "AI Teacher voice replies"),
                  desc: tr("Озвучивать ответы преподавателя в звонке", "Қоңырау кезінде жауаптарды дауыспен оқу", "Read teacher answers aloud during calls"),
                  value: voiceTts,
                  toggle: () => {
                    const next = !voiceTts;
                    setVoiceTts(next);
                    void saveUserProfile({ voice_tts: next }, tr("Настройка озвучки сохранена", "Дауыс баптауы сақталды", "Voice setting saved"));
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
                    {item.value ? tr("Вкл", "Қосу", "On") : tr("Выкл", "Өшір", "Off")}
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
                  {tr("Моя библиотека", "Менің кітапханам", "My library")}
                </Button>
                <Button
                  className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-card py-3.5 text-xs font-bold text-white"
                  onClick={() => {
                    setPanel(null);
                    openTests("quiz");
                  }}
                >
                  <Icon name="test" className="size-4 text-purple-light" />
                  {tr("Мои тесты", "Менің тестілерім", "My tests")}
                </Button>
              </div>
            </div>
          )}

          {/* Вкладка 2: Редактирование данных студента */}
          {profileTab === "edit" && (
            <div className="mt-4 space-y-3 rounded-card border border-line bg-card p-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-copy-muted">{tr("Имя и Фамилия", "Аты-жөні", "Full name")}</span>
                <Input
                  className="w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-white outline-none"
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder={tr("Например: Ералы Амангельдинов", "Мысалы: Ералы Амангельдинов", "e.g. Eraly Amangeldinov")}
                  value={userName}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-copy-muted">{tr("Университет / Колледж", "Университет / Колледж", "University / College")}</span>
                <Input
                  className="w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-white outline-none"
                  onChange={(e) => setUniversity(e.target.value)}
                  placeholder="Astana IT University"
                  value={university}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-copy-muted">{tr("Курс / Специальность / Группа", "Курс / Мамандық / Топ", "Year / Major / Group")}</span>
                <Input
                  className="w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-white outline-none"
                  onChange={(e) => setMajor(e.target.value)}
                  placeholder="ICT · Computer Science"
                  value={major}
                />
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-copy-muted">{tr("Фото и тема аватара", "Аватар суреті мен түсі", "Avatar photo and color")}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      className="text-xs font-bold text-accent-bright"
                      onClick={() => avatarInputRef.current?.click()}
                      type="button"
                    >
                      {tr("Загрузить фото", "Сурет жүктеу", "Upload photo")}
                    </Button>
                    {avatarUrl && (
                      <Button
                        className="text-xs font-bold text-red"
                        onClick={() => {
                          setAvatarUrl("");
                          void saveUserProfile({ avatar_url: "" }, tr("Фото удалено", "Сурет жойылды", "Photo removed"));
                        }}
                        type="button"
                      >
                        {tr("Удалить", "Жою", "Delete")}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    ["aurora", tr("Синий", "Көк", "Blue"), "from-accent to-purple"],
                    ["emerald", tr("Изумруд", "Зүмрәт", "Emerald"), "from-green to-accent"],
                    ["royal", tr("Неон", "Неон", "Neon"), "from-purple to-accent"],
                    ["crimson", tr("Рубин", "Лағыл", "Ruby"), "from-red to-purple"],
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
                {savingProfile ? tr("Сохранение…", "Сақталуда…", "Saving…") : tr("Сохранить профиль", "Профильді сақтау", "Save profile")}
              </Button>
            </div>
          )}

          {/* Вкладка 3: Безопасность и аккаунт */}
          {profileTab === "security" && (
            <div className="mt-4 space-y-3">
              <div className="rounded-card border border-line bg-card p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-copy-muted">{tr("Email аккаунта", "Аккаунт Email", "Account email")}</span>
                  <span className="font-semibold text-white">{userEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-copy-muted">{tr("Дата регистрации", "Тіркелген күні", "Member since")}</span>
                  <span className="font-semibold text-white">{memberSince || tr("Октябрь 2026", "Қазан 2026", "October 2026")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-copy-muted">{tr("Защита данных", "Деректерді қорғау", "Data protection")}</span>
                  <span className="font-semibold text-green">Supabase RLS · {tr("Активна", "Белсенді", "Active")}</span>
                </div>
              </div>

              <div className="rounded-card border border-line bg-card p-4">
                <div className="text-xs font-bold text-white">{tr("Изменить пароль", "Құпия сөзді өзгерту", "Change password")}</div>
                <Input
                  className="mt-2.5 w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-copy-dim"
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={tr("Новый пароль (мин. 6 символов)", "Жаңа құпия сөз (кемінде 6 таңба)", "New password (min. 6 characters)")}
                  type="password"
                  value={newPassword}
                />
                <Button
                  className="mt-3 w-full rounded-xl bg-accent py-3 text-xs font-bold text-white disabled:opacity-50"
                  disabled={savingProfile || !newPassword.trim()}
                  onClick={() => void handlePasswordUpdate()}
                >
                  {savingProfile ? tr("Обновление…", "Жаңартылуда…", "Updating…") : tr("Обновить пароль", "Құпия сөзді жаңарту", "Update password")}
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
            {tr("Выйти из аккаунта", "Аккаунттан шығу", "Sign out")}
          </Button>
        </OverlayPanel>
      )}

      {panel === "schedule" && (
        <OverlayPanel
          title={tr("Расписание занятий", "Сабақ кестесі", "Class Schedule")}
          subtitle={tr("Добавляйте и редактируйте свои пары", "Сабақтарыңызды қосыңыз және өңдеңіз", "Add and manage your university classes")}
          onClose={() => {
            resetScheduleForm();
            setPanel(null);
          }}
        >
          {/* Форма добавления / редактирования занятия */}
          <section className="rounded-card border border-line bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-accent-bright">
                {editingScheduleId ? tr("Редактирование занятия", "Сабақты өңдеу", "Edit class") : tr("Добавить новое занятие", "Жаңа сабақ қосу", "Add new class")}
              </div>
              {editingScheduleId && (
                <Button
                  className="text-xs font-semibold text-copy-muted"
                  onClick={resetScheduleForm}
                >
                  {tr("Отмена", "Бас тарту", "Cancel")}
                </Button>
              )}
            </div>

            <div className="mt-3 space-y-2.5">
              <Input
                className="w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-copy-dim"
                onChange={(e) => setSchedSubject(e.target.value)}
                placeholder={tr("Название предмета (напр. Database Systems)", "Пән атауы (мыс. Database Systems)", "Course name (e.g. Database Systems)")}
                value={schedSubject}
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  className="rounded-xl border border-line bg-elevated px-3 py-2.5 text-xs font-semibold text-white outline-none placeholder:text-copy-dim"
                  onChange={(e) => setSchedTime(e.target.value)}
                  placeholder={tr("Время (10:00)", "Уақыты (10:00)", "Time (10:00)")}
                  value={schedTime}
                />
                <Input
                  className="rounded-xl border border-line bg-elevated px-3 py-2.5 text-xs text-white outline-none placeholder:text-copy-dim"
                  onChange={(e) => setSchedPlace(e.target.value)}
                  placeholder={tr("Кабинет / Online", "Кабинет / Онлайн", "Room / Online")}
                  value={schedPlace}
                />
                <Select
                  className="rounded-xl border border-line bg-elevated px-2.5 py-2.5 text-xs font-semibold text-white outline-none"
                  onChange={(e) => setSchedStatus(e.target.value)}
                  value={schedStatus}
                >
                  <option value="Сегодня">{tr("Сегодня", "Бүгін", "Today")}</option>
                  <option value="Завтра">{tr("Завтра", "Ертең", "Tomorrow")}</option>
                  <option value="Понедельник">{tr("Пн", "Дс", "Mon")}</option>
                  <option value="Вторник">{tr("Вт", "Сс", "Tue")}</option>
                  <option value="Среда">{tr("Ср", "Ср", "Wed")}</option>
                  <option value="Четверг">{tr("Чт", "Бс", "Thu")}</option>
                  <option value="Пятница">{tr("Пт", "Жм", "Fri")}</option>
                  <option value="Суббота">{tr("Сб", "Сб", "Sat")}</option>
                </Select>
              </div>
              <Button
                className="w-full rounded-xl bg-gradient-to-r from-accent to-purple py-3 text-xs font-bold text-white shadow-glow"
                onClick={saveScheduleItem}
              >
                {editingScheduleId ? tr("Сохранить изменения", "Өзгерістерді сақтау", "Save changes") : tr("+ Добавить в расписание", "+ Кестеге қосу", "+ Add to schedule")}
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
              const displayStatus =
                item.status === "Сегодня"
                  ? tr("Сегодня", "Бүгін", "Today")
                  : item.status === "Завтра"
                    ? tr("Завтра", "Ертең", "Tomorrow")
                    : item.status;
              return (
                <div
                  className={`flex items-center gap-3 rounded-2xl border p-3.5 transition ${
                    isEditing ? "border-accent bg-accent-muted" : "border-line bg-card"
                  }`}
                  key={item.id}
                >
                  <div className="w-14 shrink-0">
                    <div className="text-xs font-bold text-white">{item.time}</div>
                    <div className="mt-0.5 text-mini text-accent-bright">{displayStatus}</div>
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
                      title={tr("Редактировать", "Өңдеу", "Edit")}
                    >
                      {tr("Изм.", "Өңд.", "Edit")}
                    </Button>
                    <Button
                      className="rounded-lg border border-red/25 bg-red/10 px-2.5 py-2 text-mini font-bold text-red"
                      onClick={() => deleteScheduleItem(item.id)}
                      title={tr("Удалить", "Жою", "Delete")}
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
                      title={`${tr("Записать лекцию", "Дәрісті жазу", "Record lecture")}: ${item.subject}`}
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
