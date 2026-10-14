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
import { supabase, saveRecording } from "./lib/supabase";
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
  | "teacher";
type Language = "English" | "Russian" | "Kazakh";
type Lecture = {
  title: string;
  subject: string;
  professor: string;
  date: string;
  sourceLanguage: Language;
  outputLanguage: Language;
  sourceType: "recording" | "upload";
  sourceFile?: string;
  audioBlob?: Blob;
  audioUrl?: string;
  audioDuration?: number;
  audioMimeType?: string;
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
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-app px-5 pb-page">
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
      {children}
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

const schedule = [
  ["10:00 AM", "Math Analysis", "Room 302", "In 24 min"],
  ["12:30 PM", "Computer Science 101", "Auditorium B", "Later"],
  ["3:00 PM", "Academic English", "Online", "Later"],
  ["Tomorrow", "Linear Algebra", "Room 208", "9:00 AM"],
  ["Tomorrow", "Research Methods", "Online", "1:30 PM"],
];

function Home({
  navigate,
  openTests,
}: {
  navigate: (screen: Screen) => void;
  openTests: (mode: "quiz" | "cards") => void;
}) {
  const [panel, setPanel] = useState<"search" | "profile" | "schedule" | null>(null);
  const [query, setQuery] = useState("");
  const [profileFeedback, setProfileFeedback] = useState("");
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
        subtitle="Wednesday, October 16"
        title="Hello, Zhibek!"
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
              className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-accent to-purple text-sm font-bold text-white ring-2 ring-card"
              onClick={() => setPanel("profile")}
            >
              Z
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
          <Button className="text-xs font-semibold text-accent-bright" onClick={() => setPanel("schedule")}>
            View all
          </Button>
        </div>
        <div className="space-y-3">
          {schedule.slice(0, 3).map(([time, subject, place, status], index) => (
            <div
              className={`flex items-center gap-3 rounded-2xl border p-4 ${
                index === 0 ? "border-accent/40 bg-accent-muted" : "border-line bg-card"
              }`}
              key={subject}
            >
              <div className="w-16">
                <div className="text-xs font-bold text-white">{time}</div>
                <div className={`mt-1 text-mini ${index === 0 ? "text-accent-bright" : "text-copy-dim"}`}>
                  {status}
                </div>
              </div>
              <div className="h-9 w-px bg-line" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{subject}</div>
                <div className="mt-1 text-xs text-copy-muted">{place}</div>
              </div>
              <Button
                aria-label={`Record ${subject}`}
                className={`grid size-10 place-items-center rounded-xl ${
                  index === 0 ? "bg-accent text-white shadow-glow" : "bg-elevated text-copy-muted"
                }`}
                onClick={() => navigate("record")}
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
            ["book", "Recent", "Transcripts", "12"],
            ["test", "Pending", "Quizzes", "3"],
            ["sparkles", "AI", "Tutor", "Ask"],
          ].map(([icon, first, second, badge], index) => (
            <Button
              className="rounded-2xl border border-line bg-card p-3 text-left transition hover:border-accent/50"
              key={second}
              onClick={() => {
                if (index === 1) openTests("quiz");
                else navigate(index === 0 ? "notes" : "teacher");
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
        <OverlayPanel title="Search L-easy" subtitle="Lectures, notes and practice" onClose={() => setPanel(null)}>
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
            <Icon name="search" className="size-4 text-copy-muted" />
            <Input
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-copy-dim"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your learning space..."
              value={query}
            />
          </div>
          <div className="mt-5 space-y-3">
            {searchResults.map((item) => (
              <Button
                className="flex w-full items-center justify-between rounded-2xl border border-line bg-card p-4 text-left"
                key={item.title}
                onClick={() => {
                  setPanel(null);
                  if (item.screen === "tests") openTests("quiz");
                  else navigate(item.screen);
                }}
              >
                <span>
                  <span className="block text-sm font-bold text-white">{item.title}</span>
                  <span className="mt-1 block text-xs text-copy-muted">{item.detail}</span>
                </span>
                <Icon name="arrow" className="size-4 text-accent-bright" />
              </Button>
            ))}
            {searchResults.length === 0 && (
              <div className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-copy-muted">
                No results found. Try “notes” or “quiz”.
              </div>
            )}
          </div>
        </OverlayPanel>
      )}

      {panel === "profile" && (
        <OverlayPanel title="Your Profile" subtitle="L-easy learner" onClose={() => setPanel(null)}>
          <div className="flex items-center gap-4 rounded-card border border-line bg-card p-5">
            <div className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-accent to-purple text-lg font-bold text-white">
              Z
            </div>
            <div>
              <div className="font-bold text-white">Zhibek</div>
              <div className="mt-1 text-xs text-copy-muted">7 day learning streak · Level 4</div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {["Learning profile", "Notification settings", "Sign out"].map((item) => (
              <Button
                className="flex w-full items-center justify-between rounded-2xl border border-line bg-card p-4 text-sm font-semibold text-white"
                key={item}
                onClick={() =>
                  item === "Sign out"
                    ? supabase.auth.signOut()
                    : setProfileFeedback(`${item} updated for this demo.`)
                }
              >
                {item}
                <Icon name="arrow" className="size-4 text-copy-dim" />
              </Button>
            ))}
          </div>
          {profileFeedback && (
            <div className="mt-4 rounded-xl border border-green/25 bg-green/10 p-3 text-xs font-semibold text-green">
              {profileFeedback}
            </div>
          )}
        </OverlayPanel>
      )}

      {panel === "schedule" && (
        <OverlayPanel title="Full Schedule" subtitle="This week" onClose={() => setPanel(null)}>
          <div className="space-y-3 overflow-y-auto">
            {schedule.map(([time, subject, place, status]) => (
              <div className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4" key={`${time}-${subject}`}>
                <div className="w-16 text-xs font-bold text-white">{time}</div>
                <div className="h-9 w-px bg-line" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{subject}</div>
                  <div className="mt-1 text-xs text-copy-muted">{place} · {status}</div>
                </div>
                <Button
                  aria-label={`Record ${subject}`}
                  className="grid size-10 place-items-center rounded-xl bg-elevated text-accent-bright"
                  onClick={() => {
                    setPanel(null);
                    navigate("record");
                  }}
                >
                  <Icon name="mic" className="size-4" />
                </Button>
              </div>
            ))}
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
  onRecordingContinue: (audio: { blob: Blob; duration: number; mimeType: string }) => void;
  onUploadReady: (sourceFile: string) => void;
}) {
  const [recordingState, setRecordingState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [sourceLanguage, setSourceLanguage] = useState("en-US");
  const [outputLanguage, setOutputLanguage] = useState("kk-KZ");
  const [liveTranscriptEnabled, setLiveTranscriptEnabled] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [speechStatus, setSpeechStatus] = useState("Ready");
  const [showOptions, setShowOptions] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [noiseFilter, setNoiseFilter] = useState(true);
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
    recognition.onerror = () => setSpeechStatus("Microphone access needed");
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
      requestedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
    if (!file) return;
    setSelectedFile(file);
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
              accept="audio/*,video/*"
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
              onClick={() => selectedFile && onUploadReady(selectedFile.name)}
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

const processingStages = [
  "Uploading",
  "Transcribing",
  "Summarizing",
  "Translating",
  "Generating Notes",
  "Completed",
];

function Processing({
  lecture,
  initiallyComplete,
  onBack,
  onComplete,
  navigate,
  openTests,
}: {
  lecture: Lecture;
  initiallyComplete: boolean;
  onBack: () => void;
  onComplete: () => void;
  navigate: (screen: Screen) => void;
  openTests: (mode: "quiz" | "cards") => void;
}) {
  const [stage, setStage] = useState(initiallyComplete ? processingStages.length : 0);

  useEffect(() => {
    if (stage >= processingStages.length) {
      onComplete();
      return;
    }
    const timer = window.setTimeout(() => setStage((value) => value + 1), 700);
    return () => window.clearTimeout(timer);
  }, [stage, onComplete]);

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
        <p className="mt-3 text-xs leading-5 text-copy-dim">
          Prototype simulation: your recorded audio stays in this browser. Transcription, translation, and AI generation are demonstrated locally.
        </p>

        <div className="mt-6 space-y-1">
          {processingStages.map((item, index) => {
            const completed = index < stage;
            const active = index === stage;
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
}: {
  lecture: Lecture;
  onBack: () => void;
  navigate: (screen: Screen) => void;
  openTests: (mode: "quiz" | "cards") => void;
}) {
  const [version, setVersion] = useState<"original" | "simplified">("original");
  const [language, setLanguage] = useState<Language>(lecture.outputLanguage);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [explanation, setExplanation] = useState(
    "Dijkstra’s algorithm solves the single-source shortest-path problem by repeatedly selecting the unvisited vertex with the smallest known distance and relaxing its outgoing edges.",
  );
  const simplified =
    "Dijkstra works like choosing the closest place you can reach next. Each time it finds a shorter route, it updates the map until every destination has the best known distance.";

  const download = () => {
    setDownloadStatus("Preparing printable summary…");
    window.setTimeout(() => {
      setDownloadStatus("Summary ready for PDF.");
      window.print();
    }, 400);
  };

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
          <Select
            aria-label="Summary language"
            className="rounded-xl bg-elevated px-3 py-2 text-xs font-semibold text-white"
            onChange={(event) => setLanguage(event.target.value as Language)}
            value={language}
          >
            {languages.map((item) => <option key={item}>{item}</option>)}
          </Select>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl bg-elevated p-3 text-copy-muted">Source: <span className="text-white">{lecture.sourceLanguage}</span></div>
          <div className="rounded-xl bg-elevated p-3 text-copy-muted">Output: <span className="text-white">{language}</span></div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 rounded-xl bg-card p-1">
        <Button
          className={`rounded-lg py-3 text-xs font-bold ${version === "original" ? "bg-accent text-white" : "text-copy-muted"}`}
          onClick={() => setVersion("original")}
        >
          Original
        </Button>
        <Button
          className={`rounded-lg py-3 text-xs font-bold ${version === "simplified" ? "bg-purple text-white" : "text-copy-muted"}`}
          onClick={() => setVersion("simplified")}
        >
          Simplified
        </Button>
      </div>

      <section className="mt-4 rounded-card border border-line bg-card p-5">
        <div className="flex items-center justify-between">
          <Heading level={2} className="text-base font-bold text-white">AI Explanation</Heading>
          <Button className="text-xs font-bold text-accent-bright" onClick={() => setEditing((value) => !value)}>
            {editing ? "Done" : "Edit"}
          </Button>
        </div>
        {editing ? (
          <Textarea
            className="mt-4 min-h-36 w-full resize-none rounded-xl border border-accent/30 bg-elevated p-4 text-sm leading-6 text-white outline-none"
            onChange={(event) => {
              setExplanation(event.target.value);
              setSaved(false);
            }}
            value={explanation}
          />
        ) : (
          <p className="mt-4 text-sm leading-7 text-copy-muted">{version === "original" ? explanation : simplified}</p>
        )}
        <Button
          className="mt-4 rounded-xl bg-elevated px-4 py-3 text-xs font-bold text-white"
          onClick={() => {
            setSaved(true);
            setEditing(false);
          }}
        >
          Save
        </Button>
        {saved && <span className="ml-3 text-xs font-semibold text-green">Saved successfully</span>}
      </section>

      <section className="mt-4 rounded-card border border-line bg-card p-5">
        <Heading level={2} className="text-base font-bold text-white">Key Points</Heading>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-copy-muted">
          {[
            "Always selects the unvisited node with the smallest known distance.",
            "Uses edge relaxation to improve tentative distances.",
            "Requires non-negative edge weights for correct results.",
          ].map((item) => (
            <li className="flex gap-3" key={item}><span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-bright" />{item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-card border border-line bg-card p-5">
        <Heading level={2} className="text-base font-bold text-white">Important Terms</Heading>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Relaxation", "Priority Queue", "Weighted Graph", "Greedy Strategy"].map((term) => (
            <span className="rounded-full border border-purple/30 bg-purple/10 px-3 py-2 text-xs font-semibold text-purple-light" key={term}>{term}</span>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-card border border-line bg-card p-5">
        <Heading level={2} className="text-base font-bold text-white">Example</Heading>
        <p className="mt-3 text-sm leading-7 text-copy-muted">
          If A→B costs 4 and A→C→B costs 2 + 1, relaxation updates the distance to B from 4 to 3.
        </p>
      </section>

      <section className="mt-4 rounded-card border border-line bg-card p-5">
        <Heading level={2} className="text-base font-bold text-white">Original Transcript</Heading>
        <p className="mt-3 text-sm leading-7 text-copy-muted">
          Today we’re looking at graph traversal, specifically how Dijkstra’s algorithm finds the shortest path between nodes. We maintain a set of unvisited vertices and select the smallest known distance.
        </p>
      </section>

      <section className="mt-4 rounded-card border border-purple/30 bg-purple/10 p-5">
        <Heading level={2} className="text-base font-bold text-white">Simplified Explanation</Heading>
        <p className="mt-3 text-sm leading-7 text-copy-muted">{simplified}</p>
      </section>

      {downloadStatus && <div className="mt-4 rounded-xl bg-accent-muted p-3 text-xs font-semibold text-accent-bright">{downloadStatus}</div>}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button className="rounded-xl border border-line bg-card py-4 text-sm font-bold text-white" onClick={download}>
          Download PDF
        </Button>
        <Button className="rounded-xl bg-accent py-4 text-sm font-bold text-white" onClick={() => navigate("notes")}>
          View Notes
        </Button>
        <Button className="rounded-xl border border-line bg-card py-4 text-sm font-bold text-white" onClick={() => openTests("quiz")}>
          Take Test
        </Button>
        <Button className="rounded-xl bg-purple py-4 text-sm font-bold text-white" onClick={() => navigate("teacher")}>
          Ask AI Teacher
        </Button>
      </div>
    </div>
  );
}

const vocabularyDefinitions: Record<string, string> = {
  Relaxation: "The process of improving the currently known shortest distance to a vertex.",
  "Priority Queue": "A structure that always returns the unvisited node with the smallest known distance.",
  "Weighted Graph": "A graph whose edges carry costs such as distance, time, or price.",
  Greedy: "A strategy that makes the best local choice available at each step.",
};

function Notes({
  lecture,
  openTests,
  onBack,
}: {
  lecture: Lecture;
  openTests: (mode: "quiz" | "cards") => void;
  onBack: () => void;
}) {
  const [selectedTerm, setSelectedTerm] = useState("Relaxation");
  const [actionStatus, setActionStatus] = useState("");
  const [downloading, setDownloading] = useState(false);

  const downloadNotes = () => {
    setDownloading(true);
    setActionStatus("Preparing your PDF notes…");
    window.setTimeout(() => {
      setDownloading(false);
      setActionStatus("PDF is ready. Choose “Save as PDF” in the print dialog.");
      window.print();
    }, 500);
  };

  const shareNotes = async () => {
    const shareData = {
      title: `L-easy · ${lecture.title}`,
      text: `AI lecture notes for ${lecture.title}: Dijkstra’s algorithm, priority queues, and weighted graphs.`,
    };

    if (navigator.share) {
      setActionStatus("Opening share options…");
      await navigator.share(shareData)
        .then(() => setActionStatus("Notes shared successfully."))
        .catch(() => setActionStatus("Sharing was cancelled."));
      return;
    }

    try {
      await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}`);
      setActionStatus("Share text copied to your clipboard.");
    } catch {
      setActionStatus("Sharing is unavailable in this browser.");
    }
  };

  return (
    <div className="notes-page page-enter px-5">
      <TopBar
        subtitle={`${lecture.subject} · ${lecture.date}`}
        title={lecture.title}
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
      <div className="flex gap-3">
        <Button
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-purple px-4 py-3.5 text-sm font-bold text-white shadow-glow"
          disabled={downloading}
          onClick={downloadNotes}
        >
          <Icon name="download" className="size-4" />
          {downloading ? "Preparing PDF…" : "Download PDF Notes"}
        </Button>
        <Button
          aria-label="Share notes"
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
            Executive Summary
          </Heading>
        </div>
        <ul className="space-y-3 text-sm leading-6 text-copy-muted">
          {[
            "Dijkstra’s algorithm finds the shortest path in weighted graphs.",
            "It uses a greedy strategy and a priority queue.",
            "The algorithm requires all edge weights to be non-negative.",
          ].map((item) => (
            <li className="flex gap-3" key={item}>
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-bright" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-card border border-line bg-card p-5">
        <Heading level={2} className="text-base font-bold text-white">
          Key Concepts & Formulas
        </Heading>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-elevated p-4">
            <div className="text-xs font-semibold text-copy-muted">Time complexity</div>
            <div className="mt-2 font-mono text-lg font-semibold text-blue-soft">O((V + E) log V)</div>
          </div>
          <div className="rounded-xl bg-elevated p-4">
            <div className="text-xs font-semibold text-copy-muted">Relaxation rule</div>
            <div className="mt-2 font-mono text-sm font-semibold text-blue-soft">
              dist[v] = min(dist[v], dist[u] + w)
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-card border border-line bg-card p-5">
        <Heading level={2} className="text-base font-bold text-white">
          Interactive Vocab
        </Heading>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Relaxation", "Priority Queue", "Weighted Graph", "Greedy"].map((term) => (
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
            {vocabularyDefinitions[selectedTerm]}
          </p>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-card border border-purple/40 bg-gradient-to-br from-purple/20 to-accent-muted p-5">
        <div className="text-xs font-bold uppercase tracking-widest text-purple-light">Master this lecture</div>
        <Heading level={2} className="mt-2 text-lg font-bold text-white">
          Ready to test your knowledge?
        </Heading>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button
            className="rounded-xl bg-white px-3 py-3 text-xs font-bold text-ink"
            onClick={() => openTests("quiz")}
          >
            Start Quiz <span className="block text-mini font-medium text-copy-dim">5 questions</span>
          </Button>
          <Button
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-xs font-bold text-white"
            onClick={() => openTests("cards")}
          >
            Practice Cards <span className="block text-mini font-medium text-copy-muted">12 terms</span>
          </Button>
        </div>
      </section>
    </div>
  );
}

const quizSets = [
  { title: "Graph Algorithms", meta: "CS101 · 3 questions", score: "85% Mastery", progress: 80, complete: "Ready to continue" },
  { title: "Sorting & Complexity", meta: "CS101 · 3 questions", score: "72% Mastery", progress: 50, complete: "New practice set" },
  { title: "Linear Algebra", meta: "Math · 3 questions", score: "New", progress: 16, complete: "Start your first attempt" },
];

const quizQuestions = [
  {
    question: "What condition must hold for Dijkstra’s algorithm to work correctly?",
    answers: ["All edge weights are non-negative", "The graph has no cycles", "Every node has two edges", "The graph is unweighted"],
    correct: 0,
    explanation: "Negative edges can make a previously finalized shortest path cheaper later.",
  },
  {
    question: "Which structure efficiently selects the next closest unvisited node?",
    answers: ["Stack", "Priority queue", "Hash set", "Linked list"],
    correct: 1,
    explanation: "A priority queue returns the node with the smallest known distance.",
  },
  {
    question: "What does edge relaxation do?",
    answers: ["Deletes heavy edges", "Adds a new vertex", "Improves a known distance", "Sorts all vertices"],
    correct: 2,
    explanation: "Relaxation updates a distance when a shorter route is discovered.",
  },
];

const flashcards = [
  ["Dijkstra Algorithm", "Finds the shortest path from one source node to all other nodes in a weighted graph."],
  ["Relaxation", "Updates a vertex distance when a shorter path is discovered through another node."],
  ["Priority Queue", "Returns the unvisited node with the smallest currently known distance."],
  ["Weighted Graph", "A graph whose edges represent costs such as distance, time, or price."],
];

function Tests({
  initialMode,
  lecture,
  onBack,
}: {
  initialMode: "quiz" | "cards";
  lecture: Lecture;
  onBack: () => void;
}) {
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

  useEffect(() => {
    setTab(initialMode);
  }, [initialMode]);

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
    setCardFeedback(`${rating} saved. Review schedule updated.`);
    setFlipped(false);
    window.setTimeout(() => {
      if (cardIndex === flashcards.length - 1) setDeckComplete(true);
      else setCardIndex((value) => value + 1);
      setCardFeedback("");
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

      {tab === "quiz" && !activeQuiz && (
        <div className="mt-6 space-y-4">
          {quizSets.map(({ title, meta, score, progress, complete }, index) => {
            const quizTitle = index === 0 ? lecture.title : title;
            return (
            <Button
              className="w-full rounded-card border border-line bg-card p-5 text-left transition hover:border-accent/50"
              key={quizTitle}
              onClick={() => startQuiz(quizTitle)}
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-bold text-white">{quizTitle}</span>
                  <span className="mt-1 block text-xs text-copy-muted">{meta}</span>
                </span>
                <span className={`rounded-full px-2.5 py-1 text-mini font-bold ${
                  score === "New" ? "bg-purple/15 text-purple-light" : "bg-green/10 text-green"
                }`}>
                  {score}
                </span>
              </span>
              <span className="mt-5 block h-1.5 overflow-hidden rounded-full bg-elevated">
                <span className="block h-full rounded-full bg-gradient-to-r from-accent to-purple" style={{ width: `${progress}%` }} />
              </span>
              <span className="mt-2 flex items-center justify-between text-mini text-copy-dim">
                <span>{complete}</span>
                <span className="flex items-center gap-1 text-accent-bright">
                  Open quiz <Icon name="arrow" className="size-3" />
                </span>
              </span>
            </Button>
            );
          })}
        </div>
      )}

      {tab === "quiz" && activeQuiz && !quizComplete && (
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
          <Button className="mt-6 w-full rounded-xl bg-accent py-4 text-sm font-bold text-white" onClick={() => startQuiz(activeQuiz ?? "Graph Algorithms")}>
            Try Again
          </Button>
          <Button className="mt-3 w-full rounded-xl border border-line py-4 text-sm font-bold text-copy-muted" onClick={() => setActiveQuiz(null)}>
            Back to Quizzes
          </Button>
        </section>
      )}

      {tab === "cards" && !deckComplete && (
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
            <span className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/10 text-blue-soft">
              <Icon name="speaker" className="size-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-accent-bright">
              {flipped ? "Definition" : "Key term"}
            </span>
            <span className="mt-5 block text-2xl font-bold leading-tight text-white">
              {flipped ? flashcards[cardIndex][1] : flashcards[cardIndex][0]}
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

      {tab === "cards" && deckComplete && (
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
  const [messages, setMessages] = useState([
    { role: "user", text: "Why can’t Dijkstra’s algorithm work with negative weights?" },
    {
      role: "assistant",
      text: "Think of it like choosing the nearest city on a map. Once Dijkstra finalizes a path, it assumes no future route can make it cheaper. A negative edge breaks that assumption because a later route could reduce the total.",
    },
  ]);
  const [replying, setReplying] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceCallActive, setVoiceCallActive] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);

  const sendMessage = (text: string) => {
    const userMessage = text.trim();
    if (!userMessage || replying) return;
    setMessages((current) => [...current, { role: "user", text: userMessage }]);
    setMessage("");
    setReplying(true);
    window.setTimeout(() => {
      const normalized = userMessage.toLowerCase();
      const response = normalized.includes("quiz")
        ? `Quick check on ${lecture.title}: why must edge weights be non-negative for Dijkstra’s algorithm?`
        : normalized.includes("term")
          ? "The important terms are relaxation, priority queue, weighted graph, and greedy strategy. Relaxation improves distances, while the priority queue selects the closest unvisited node."
          : normalized.includes("simpler")
            ? "Think of Dijkstra as expanding a travel map from your starting point. Always visit the closest reachable place next, then update nearby routes if you find a shortcut."
            : normalized.includes("example")
        ? "Imagine routes A→B costs 5, while A→C costs 7 and C→B costs −4. Dijkstra may finalize B at 5 before discovering that A→C→B actually costs 3."
        : normalized.includes("complex") || normalized.includes("fast")
          ? "With a binary-heap priority queue, Dijkstra’s time complexity is O((V + E) log V). The queue keeps selection of the next closest node efficient."
            : normalized.includes("relax")
              ? "Relaxation checks whether going through the current node creates a shorter route: dist[v] = min(dist[v], dist[u] + w)."
            : `Based on ${lecture.title}, focus on three ideas: non-negative weights, repeatedly choosing the nearest unvisited node, and relaxing its outgoing edges.`;
      setMessages((current) => [...current, { role: "assistant", text: response }]);
      setReplying(false);
    }, 700);
  };

  const submit = () => sendMessage(message);

  const toggleVoiceInput = () => {
    if (listening) {
      setListening(false);
      return;
    }
    setListening(true);
    window.setTimeout(() => {
      setMessage("Explain relaxation with a simple example");
      setListening(false);
    }, 900);
  };

  useEffect(() => {
    if (!voiceCallActive) return;
    const timer = window.setInterval(() => setCallSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [voiceCallActive]);

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
          onClick={() => setVoice(false)}
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
            <div className="mt-5 rounded-2xl border border-line bg-card p-4 text-left text-xs leading-5 text-copy-muted">
              <span className="font-bold text-purple-light">Demo transcript</span>
              <p className="mt-1">“How does the priority queue make Dijkstra faster?”</p>
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
  title: "Graph Algorithms",
  subject: "Computer Science 101",
  professor: "Dr. Sarah Chen",
  date: "2025-10-16",
  sourceLanguage: "English",
  outputLanguage: "Kazakh",
  sourceType: "recording",
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedLecture, setSelectedLecture] = useState<Lecture>(defaultLecture);
  const [processed, setProcessed] = useState(false);
  const [testMode, setTestMode] = useState<"quiz" | "cards">("quiz");
  const [testsEntry, setTestsEntry] = useState(0);

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

  const beginLectureInformation = (sourceType: Lecture["sourceType"], sourceFile?: string) => {
    setSelectedLecture((current) => ({
      ...current,
      sourceType,
      sourceFile,
      audioBlob: undefined,
      audioUrl: undefined,
      audioDuration: undefined,
      audioMimeType: undefined,
    }));
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

  const continueRecordedLecture = (audio: { blob: Blob; duration: number; mimeType: string }) => {
    const audioUrl = URL.createObjectURL(audio.blob);
    void saveRecording(audio.blob, audio.duration, audio.mimeType, `Lecture ${new Date().toLocaleString()}`);
    setSelectedLecture((current) => ({
      ...current,
      sourceType: "recording",
      sourceFile: "Lecture Recording",
      audioBlob: audio.blob,
      audioUrl,
      audioDuration: audio.duration,
      audioMimeType: audio.mimeType,
    }));
    setProcessed(false);
    setScreen("processing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-page">
      <div className="relative mx-auto min-h-screen max-w-md overflow-x-hidden bg-app pb-page shadow-phone">
        {screen === "home" && <Home navigate={navigate} openTests={openTests} />}
        {screen === "record" && (
          <Recording
            onRecordingContinue={continueRecordedLecture}
            onUploadReady={(sourceFile) => beginLectureInformation("upload", sourceFile)}
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
            openTests={openTests}
          />
        )}
        {screen === "summary" && (
          <LectureSummary
            lecture={selectedLecture}
            navigate={navigate}
            onBack={() => navigate("processing")}
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
          />
        )}
        {screen === "teacher" && <Teacher lecture={selectedLecture} onBack={() => navigate("summary")} />}
        <BottomNav onNavigate={navigate} screen={screen} />
      </div>
    </div>
  );
}
