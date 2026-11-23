import type { CachedProfile } from "../types";

export const avatarThemes: Record<string, string> = {
  aurora: "from-accent to-purple",
  emerald: "from-green to-accent",
  royal: "from-purple to-accent",
  crimson: "from-red to-purple",
};

export function getInitialProfile(): CachedProfile {
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

export function getInitialStats(expectedEmail?: string) {
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
