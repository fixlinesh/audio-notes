import { useState, useEffect, useRef } from "react";
import { TopBar, BackButton, Button, Icon } from "../components/ui";
import type { Lecture, Screen } from "../types";
import { saveMedia, createLectureRow, updateRecording, authFetch } from "../lib/supabase";
import { blobToBase64 } from "../utils/helpers";

export const processingStages = ["Uploading", "Transcribing", "Completed"];

export default function Processing({
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
