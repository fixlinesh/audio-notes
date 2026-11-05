import { useState } from "react";
import { supabase } from "./lib/supabase";
import { useTheme } from "./theme";

export default function Auth({ onContinueGuest }: { onContinueGuest?: () => void }) {
  const { isDark, toggleTheme } = useTheme();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [university, setUniversity] = useState("Astana IT University");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const submit = async () => {
    setMessage("");
    setIsSuccess(false);
    if (!email.trim() || password.length < 6) {
      setMessage("Введите корректный Email и пароль не менее 6 символов.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const cleanName = fullName.trim() || email.trim().split("@")[0] || "Студент";
        const cleanUni = university.trim() || "Astana IT University";
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: cleanName,
              university: cleanUni,
              major: "ICT · Computer Science",
              avatar_theme: "aurora",
              default_lang: "Russian",
            },
          },
        });
        if (error) {
          setMessage(error.message);
        } else {
          try {
            localStorage.setItem(
              "leasy_profile_cache",
              JSON.stringify({
                userName: cleanName,
                userEmail: email.trim(),
                memberSince: new Date().toLocaleDateString("ru-RU", { month: "short", year: "numeric" }),
                university: cleanUni,
                major: "ICT · Computer Science",
                avatarTheme: "aurora",
                avatarUrl: "",
                defaultLang: "Russian",
                autoTranscribe: true,
                defaultNoiseFilter: true,
                voiceTts: true,
              }),
            );
          } catch {}
          if (!data.session) {
            setIsSuccess(true);
            setMessage("Аккаунт создан! Проверьте почту для подтверждения или войдите.");
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          setMessage(
            error.message.includes("Invalid login")
              ? "Неверный Email или пароль. Проверьте данные или зарегистрируйтесь."
              : error.message,
          );
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-page">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center bg-app px-6 py-10 shadow-phone">
        <div className="absolute right-6 top-6">
          <div
            role="radiogroup"
            aria-label="Тема оформления"
            className="inline-flex items-center gap-1 rounded-full border border-line bg-card p-1 shadow-sm"
          >
            <button
              type="button"
              onClick={() => { if (isDark) toggleTheme(); }}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-mini font-bold transition ${
                !isDark ? "bg-accent text-white shadow-glow" : "text-copy-muted hover:text-white"
              }`}
            >
              <span>☀️</span>
              <span>Светлая</span>
            </button>
            <button
              type="button"
              onClick={() => { if (!isDark) toggleTheme(); }}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-mini font-bold transition ${
                isDark ? "bg-accent text-white shadow-glow" : "text-copy-muted hover:text-white"
              }`}
            >
              <span>🌙</span>
              <span>Тёмная</span>
            </button>
          </div>
        </div>
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-accent to-purple text-white shadow-glow">
            <svg className="size-8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0M12 17v4M9 21h6" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">L-easy · Audio Notes</h1>
          <p className="mt-1.5 text-xs leading-5 text-copy-muted">
            Запись лекций, ИИ-конспекты, тесты и персональный преподаватель на базе Gemini
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="mt-7 grid grid-cols-2 rounded-xl border border-line bg-card p-1">
          <button
            className={`rounded-lg py-2.5 text-xs font-bold transition ${
              mode === "signin" ? "bg-accent text-white shadow-glow" : "text-copy-muted"
            }`}
            onClick={() => {
              setMessage("");
              setMode("signin");
            }}
            type="button"
          >
            Вход в аккаунт
          </button>
          <button
            className={`rounded-lg py-2.5 text-xs font-bold transition ${
              mode === "signup" ? "bg-accent text-white shadow-glow" : "text-copy-muted"
            }`}
            onClick={() => {
              setMessage("");
              setMode("signup");
            }}
            type="button"
          >
            Регистрация
          </button>
        </div>

        {/* Auth Form Card */}
        <div className="mt-5 rounded-card border border-line bg-card p-5 space-y-3.5">
          {mode === "signup" && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-copy-muted">Ваше имя и фамилия</label>
                <input
                  className="w-full rounded-xl border border-line bg-elevated px-4 py-3 text-sm text-white outline-none placeholder:text-copy-dim"
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Например: Ералы Амангельдинов"
                  type="text"
                  value={fullName}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-copy-muted">Университет / Колледж</label>
                <input
                  className="w-full rounded-xl border border-line bg-elevated px-4 py-3 text-sm text-white outline-none placeholder:text-copy-dim"
                  onChange={(e) => setUniversity(e.target.value)}
                  placeholder="Astana IT University"
                  type="text"
                  value={university}
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-copy-muted">Email</label>
            <input
              autoComplete="email"
              className="w-full rounded-xl border border-line bg-elevated px-4 py-3 text-sm text-white outline-none placeholder:text-copy-dim"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@astanait.edu.kz"
              type="email"
              value={email}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold text-copy-muted">Пароль</label>
              <button
                className="text-mini font-semibold text-accent-bright"
                onClick={() => setShowPass((v) => !v)}
                type="button"
              >
                {showPass ? "Скрыть" : "Показать"}
              </button>
            </div>
            <input
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="w-full rounded-xl border border-line bg-elevated px-4 py-3 text-sm text-white outline-none placeholder:text-copy-dim"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Минимум 6 символов"
              type={showPass ? "text" : "password"}
              value={password}
            />
          </div>

          {message && (
            <div
              className={`rounded-xl border p-3 text-xs font-semibold ${
                isSuccess ? "border-green/30 bg-green/10 text-green" : "border-red/30 bg-red/10 text-red"
              }`}
            >
              {message}
            </div>
          )}

          <button
            className="w-full rounded-xl bg-gradient-to-r from-accent to-purple py-3.5 text-sm font-bold text-white shadow-glow disabled:opacity-50"
            disabled={busy}
            onClick={submit}
            type="button"
          >
            {busy ? "Подождите…" : mode === "signin" ? "Войти в L-easy" : "Создать аккаунт"}
          </button>

          {onContinueGuest && (
            <button
              className="w-full rounded-xl border border-accent/40 bg-accent-muted py-3 text-xs font-bold text-accent-bright transition hover:border-accent"
              onClick={onContinueGuest}
              type="button"
            >
              🚀 Открыть демо без входа (Competition Jury Mode)
            </button>
          )}
        </div>

        <p className="mt-5 text-center text-mini text-copy-dim">
          🔒 Все аудиозаписи и конспекты защищены политиками Supabase Row-Level Security и доступны только вам.
        </p>
      </div>
    </div>
  );
}
