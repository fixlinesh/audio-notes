import { useState, useEffect } from "react";
import type { Screen, Lecture, Language, StudyData } from "./types";
import type { SummaryData } from "./summarize";
import { DesktopNavbar, BottomNav, Icon } from "./components/ui";
import { type RecordingRow, getSignedAudioUrl } from "./lib/supabase";
import { getInitialProfile, avatarThemes } from "./utils/profile";
import { extractTextFromPDF } from "./utils/helpers";

import Home from "./screens/Home";
import Recording from "./screens/Recording";
import LectureInformation from "./screens/LectureInformation";
import Processing from "./screens/Processing";
import LectureSummary from "./screens/LectureSummary";
import Notes from "./screens/Notes";
import Tests from "./screens/Tests";
import Teacher from "./screens/Teacher";
import Library from "./screens/Library";

export { LanguageToggle, ThemeToggle } from "./components/ui";

const defaultLecture: Lecture = {
  title: "Моя лекция",
  subject: "Общий предмет",
  professor: "Преподаватель",
  date: new Date().toISOString().split("T")[0],
  sourceLanguage: "Russian",
  outputLanguage: "Russian",
  sourceType: "recording",
};

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
  const [isReadingPdf, setIsReadingPdf] = useState(false);

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
        setIsReadingPdf(true);
        try {
          fileTranscript = await extractTextFromPDF(fileObj);
        } catch (e) {
          console.error("Could not read the PDF:", e);
        } finally {
          setIsReadingPdf(false);
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

  const appProfile = getInitialProfile();
  const avatarGradient = avatarThemes[appProfile.avatarTheme] ?? avatarThemes.aurora;
  const initials = (appProfile.userName || "U")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen w-full bg-app flex flex-col text-copy transition-colors duration-200">
      <DesktopNavbar
        screen={screen}
        onNavigate={navigate}
        onOpenAuth={onOpenAuth}
        isGuest={isGuest}
        userName={appProfile.userName || "Студент"}
        avatarUrl={appProfile.avatarUrl}
        avatarGradient={avatarGradient}
        initials={initials}
        onOpenProfile={() => {
          if (screen !== "home") {
            navigate("home");
          }
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent("leasy_open_profile"));
          }, 80);
        }}
        onOpenSearch={() => {
          if (screen !== "home") {
            navigate("home");
          }
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent("leasy_open_search"));
          }, 80);
        }}
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
            onUploadFile={(file) => beginLectureInformation("upload", file.name, file)}
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
          <Notes lecture={selectedLecture} onBack={() => navigate("summary")} openTests={openTests} navigate={navigate} />
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
        {screen === "library" && (
          <Library
            onOpen={openRecording}
            onRecordNew={() => navigate("record")}
            onUploadFile={(file) => beginLectureInformation("upload", file.name, file)}
          />
        )}
        {screen === "teacher" && <Teacher lecture={selectedLecture} onBack={() => navigate("summary")} />}
        {isReadingPdf && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
            <div className="rounded-2xl border border-line bg-card p-6 shadow-2xl flex flex-col items-center gap-3 max-w-sm text-center">
              <div className="grid size-12 place-items-center rounded-full bg-purple/20 text-purple-light animate-pulse">
                <Icon name="document" className="size-6" />
              </div>
              <div className="text-base font-bold text-white">Чтение PDF документа…</div>
              <div className="text-xs text-copy-muted">Извлекаем текст со страниц и подготавливаем конспект лекции</div>
            </div>
          </div>
        )}
        <BottomNav onNavigate={navigate} screen={screen} />
      </main>
    </div>
  );
}
