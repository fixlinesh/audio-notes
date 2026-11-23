import {
  createElement,
  type ButtonHTMLAttributes,
  type ComponentPropsWithRef,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { useI18n, type UILanguage } from "../i18n";
import { useTheme } from "../theme";
import type { IconName, Screen } from "../types";

export const iconPaths: Record<IconName, ReactNode> = {
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
  document: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </>
  ),
  message: (
    <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </>
  ),
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
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
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

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
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
      {iconPaths[name]}
    </svg>
  );
}

export function Button({
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return createElement("button", { className: `focus-ring ${className}`, ...props }, children);
}

export function Input({ className = "", ...props }: ComponentPropsWithRef<"input">) {
  return createElement("input", { className: `focus-ring ${className}`, ...props });
}

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return createElement("select", { className: `focus-ring ${className}`, ...props }, children);
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return createElement("textarea", { className: `focus-ring ${className}`, ...props });
}

export function Audio({ ...props }: ComponentPropsWithRef<"audio">) {
  return createElement("audio", props);
}

export function Heading({
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

export function DesktopNavbar({
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

export function TopBar({
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

export function OverlayPanel({
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

export function BackButton({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <Button className="mb-3 flex items-center gap-2 text-xs font-bold text-accent-bright" onClick={onClick}>
      <Icon name="arrow" className="size-3 rotate-180" /> {label}
    </Button>
  );
}

export function BottomNav({
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
