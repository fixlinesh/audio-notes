import type { SummaryData } from "./summarize";

export type Screen =
  | "home"
  | "record"
  | "lecture-info"
  | "processing"
  | "summary"
  | "notes"
  | "tests"
  | "teacher"
  | "library";

export type Language = "English" | "Russian" | "Kazakh";

export type QuizQuestion = {
  question: string;
  answers: string[];
  correct: number;
  explanation: string;
};

export type StudyData = {
  quiz: QuizQuestion[];
  flashcards: { term: string; definition: string }[];
};

export type Lecture = {
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

export type IconName =
  | "arrow"
  | "book"
  | "brain"
  | "cards"
  | "calendar"
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
  | "document"
  | "message"
  | "upload"
  | "wave";

export type ScheduleItem = {
  id: string;
  time: string;
  subject: string;
  place: string;
  status: string;
};

export type CachedProfile = {
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

export type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
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

export type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export type RecorderState =
  | "idle"
  | "requestingPermission"
  | "recording"
  | "paused"
  | "stopping"
  | "recorded"
  | "error";
