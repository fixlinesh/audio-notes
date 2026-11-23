import { useState, useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import { TopBar, Button, Icon, Heading, Audio, Select, Input, OverlayPanel } from "../components/ui";
import type { Language, RecorderState, SpeechRecognitionInstance, SpeechRecognitionConstructor } from "../types";
import { getInitialProfile } from "../utils/profile";

export const waveBars = [
  24, 40, 68, 52, 85, 38, 92, 60, 44, 76, 95, 48, 88, 32, 64, 80, 56, 36, 72,
  90, 62, 42, 84, 50, 70, 94, 46, 78, 58, 34, 66, 86,
];

export default function Recording({
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
  const { t, lang } = useI18n();
  const [recProfile] = useState(() => getInitialProfile());
  const [recordingState, setRecordingState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [sourceLanguage, setSourceLanguage] = useState(() =>
    lang === "Kazakh" ? "kk-KZ" : lang === "English" ? "en-US" : "ru-RU"
  );
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
  const [autoFilter, setAutoFilter] = useState(true);
  const [recordingNotice, setRecordingNotice] = useState("");
  const [recordingError, setRecordingError] = useState("");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState("");
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [liveDb, setLiveDb] = useState<number | null>(null);
  const [liveSnr, setLiveSnr] = useState<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const biquadFilterRef = useRef<BiquadFilterNode | null>(null);
  const autoFilterRef = useRef(true);
  autoFilterRef.current = autoFilter;
  const animFrameRef = useRef<number | null>(null);
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

  const stopAudioTelemetry = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    biquadFilterRef.current = null;
    if (audioContextRef.current) {
      try {
        void audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setLiveDb(null);
    setLiveSnr(null);
  };

  useEffect(() => {
    componentMountedRef.current = true;
    return () => {
      componentMountedRef.current = false;
      startRequestRef.current = false;
      stopAudioTelemetry();
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

  const runningRef = useRef(running);
  runningRef.current = running;
  const enabledRef = useRef(liveTranscriptEnabled);
  enabledRef.current = liveTranscriptEnabled;

  useEffect(() => {
    if (!running || !liveTranscriptEnabled) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
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
      setSpeechStatus(lang === "Kazakh" ? "Тыңдауда…" : lang === "English" ? "Listening…" : "Слушаю…");
    };

    recognition.onerror = (event: any) => {
      const err = event?.error;
      console.warn("Live transcript recognition event:", err);
      if (err === "no-speech" || err === "network" || err === "aborted") {
        return;
      }
      if (err === "not-allowed" || err === "service-not-allowed") {
        active = false;
        setSpeechStatus(lang === "Kazakh" ? "Микрофонға рұқсат берілмеді" : "Доступ к микрофону заблокирован");
      }
    };

    recognition.onend = () => {
      if (!active || !runningRef.current || !enabledRef.current) return;
      window.setTimeout(() => {
        if (active && runningRef.current && enabledRef.current) {
          try {
            recognition.start();
            setSpeechStatus(lang === "Kazakh" ? "Тыңдауда…" : lang === "English" ? "Listening…" : "Слушаю…");
          } catch {
            // Already started
          }
        }
      }, 150);
    };

    recognitionRef.current = recognition;
    setSpeechStatus(lang === "Kazakh" ? "Тыңдауда…" : lang === "English" ? "Listening…" : "Слушаю…");
    try {
      recognition.start();
    } catch {
      // Ignored
    }

    return () => {
      active = false;
      recognition.onend = null;
      try { recognition.stop(); } catch {}
      recognitionRef.current = null;
    };
  }, [liveTranscriptEnabled, running, sourceLanguage, lang]);

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
      // Disable browser DSP/AGC so raw microphone level (dBFS) and 120 Hz Biquad HPF effect remain isolated
      requestedStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: false,
          echoCancellation: false,
          autoGainControl: false,
        },
      });
      if (!componentMountedRef.current) {
        stopStreamTracks(requestedStream);
        startRequestRef.current = false;
        return;
      }

      let recordTargetStream = requestedStream;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const src = ctx.createMediaStreamSource(requestedStream);

          // Second-order Butterworth High-Pass BiquadFilterNode (f_c = 120 Hz, Q = 0.707)
          const biquadFilter = ctx.createBiquadFilter();
          biquadFilter.type = "highpass";
          biquadFilter.frequency.value = noiseFilter ? 120 : 10;
          biquadFilter.Q.value = 0.707;
          biquadFilterRef.current = biquadFilter;

          const analyser = ctx.createAnalyser();
          analyser.fftSize = 2048;
          analyser.smoothingTimeConstant = 0.4;

          src.connect(biquadFilter);
          biquadFilter.connect(analyser);

          if (typeof ctx.createMediaStreamDestination === "function") {
            const dest = ctx.createMediaStreamDestination();
            biquadFilter.connect(dest);
            if (dest.stream.getAudioTracks().length > 0) {
              recordTargetStream = dest.stream;
            }
          }

          audioContextRef.current = ctx;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          let baselineDbfs = -60;

          const measureLoop = () => {
            if (!componentMountedRef.current) return;
            analyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const norm = (dataArray[i] - 128) / 128;
              sum += norm * norm;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            const dbfs = Math.max(-96, Math.min(0, 20 * Math.log10(Math.max(1e-5, rms))));
            const roundedDbfs = Number(dbfs.toFixed(1));

            if (dbfs < baselineDbfs) baselineDbfs = baselineDbfs * 0.9 + dbfs * 0.1;
            else baselineDbfs = baselineDbfs * 0.995 + dbfs * 0.005;

            const snr = Math.max(0, Number((dbfs - baselineDbfs).toFixed(1)));

            // Engage 120 Hz High-Pass Biquad filter only when auto-filter is enabled and noise floor rises
            if (autoFilterRef.current && (baselineDbfs > -35 || snr < 12) && biquadFilter.frequency.value < 100) {
              biquadFilter.frequency.value = 120;
              setNoiseFilter(true);
            }

            setLiveDb(roundedDbfs);
            setLiveSnr(snr);
            animFrameRef.current = requestAnimationFrame(measureLoop);
          };
          animFrameRef.current = requestAnimationFrame(measureLoop);
        }
      } catch (err) {
        console.warn("Real Web Audio telemetry setup failed:", err);
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
          ? new MediaRecorder(recordTargetStream, { mimeType })
          : new MediaRecorder(recordTargetStream);
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
        stopAudioTelemetry();
        stopStreamTracks(mediaStreamRef.current);
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setRecorderError("mediaRecorderError", "The browser reported an error while recording.");
      };
      recorder.onstop = () => {
        stopAudioTelemetry();
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
    stopAudioTelemetry();
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
    if (file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") {
      setShowUpload(false);
      onUploadReady(file.name, file);
    }
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
          <div className="font-bold text-green flex items-center justify-center gap-1">
            {running && <span className="size-2 rounded-full bg-green animate-pulse" />}
            <span>{running && liveDb !== null ? `${liveDb.toFixed(1)} dBFS` : "-42.0 dBFS"}</span>
          </div>
          <div className="text-copy-dim">{running ? "Signal Level (dBFS)" : "Digital Level (dBFS)"}</div>
        </div>
        <div className="rounded-lg bg-elevated py-1.5">
          <div className="font-bold text-accent-bright">
            {running && liveSnr !== null ? `+${liveSnr.toFixed(1)} dB` : "+12.0 dB"}
          </div>
          <div className="text-copy-dim">Broadband SNR</div>
        </div>
        <div className="rounded-lg bg-elevated py-1.5">
          <div className="font-bold text-purple-light">{noiseFilter ? "HPF 120 Hz ON" : "Raw Bypass (DSP OFF)"}</div>
          <div className="text-copy-dim">Browser EC/NS/AGC: OFF</div>
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
            {noiseFilter ? "120 Hz Biquad HPF: ON" : "Raw Capture Bypass: OFF"}
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
        <section className="mt-4 rounded-2xl border border-line bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-white">120 Hz Biquad High-Pass Filter</div>
              <div className="mt-1 text-xs text-copy-muted">Suppresses low-frequency HVAC/rumble (&lt;120 Hz); browser EC/NS/AGC disabled</div>
            </div>
            <Button
              aria-pressed={noiseFilter}
              className={`rounded-full px-4 py-2 text-xs font-bold ${
                noiseFilter ? "bg-green/10 text-green" : "bg-elevated text-copy-muted"
              }`}
              onClick={() => {
                setNoiseFilter((prev) => {
                  const next = !prev;
                  if (biquadFilterRef.current) {
                    biquadFilterRef.current.frequency.value = next ? 120 : 10;
                  }
                  if (!next) setAutoFilter(false);
                  return next;
                });
              }}
            >
              {noiseFilter ? "On (120 Hz)" : "Off (Raw)"}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-line pt-3">
            <div>
              <div className="text-xs font-bold text-white">Auto-Engage on Low SNR / Noise Floor</div>
              <div className="mt-0.5 text-xs text-copy-muted">Turn off during paired raw-audio benchmarks</div>
            </div>
            <Button
              aria-pressed={autoFilter}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                autoFilter ? "bg-accent-muted text-accent-bright" : "bg-elevated text-copy-muted"
              }`}
              onClick={() => setAutoFilter((v) => !v)}
            >
              {autoFilter ? "Auto" : "Manual"}
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${running && liveTranscriptEnabled ? "animate-pulse bg-red" : "bg-copy-dim"}`} />
            <Heading level={2} className="text-sm font-bold text-white">
              Live Transcript
            </Heading>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-line bg-elevated p-0.5 text-mini">
              {[
                { id: "kk-KZ", label: "🇰🇿 Қаз" },
                { id: "ru-RU", label: "🇷🇺 Рус" },
                { id: "en-US", label: "🇬🇧 Eng" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSourceLanguage(item.id)}
                  className={`rounded-md px-2 py-0.5 font-bold transition ${
                    sourceLanguage === item.id ? "bg-accent text-white shadow" : "text-copy-muted hover:text-white"
                  }`}
                  title={item.label}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <span className="text-mini font-semibold uppercase tracking-wider text-copy-dim">
              {liveTranscriptEnabled ? speechStatus : "Optional"}
            </span>
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Button
              className="flex items-center justify-center gap-2 rounded-xl border border-purple/40 bg-purple/15 px-4 py-3.5 text-sm font-bold text-purple-light hover:bg-purple/25 transition shadow-sm"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = ".pdf,application/pdf,text/*,.txt,.md";
                  fileInputRef.current.click();
                }
              }}
            >
              <Icon name="document" className="size-5" />
              <span>{lang === "Kazakh" ? "📄 PDF құжат жүктеу" : lang === "English" ? "📄 Upload PDF Document" : "📄 Загрузить PDF документ"}</span>
            </Button>
            <Button
              className="flex items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent-muted px-4 py-3.5 text-sm font-bold text-accent-bright hover:bg-accent/20 transition"
              onClick={() => {
                setShowUpload(true);
                if (fileInputRef.current) fileInputRef.current.accept = "audio/*,video/*,.pdf";
              }}
            >
              <Icon name="upload" className="size-5" />
              <span>{lang === "Kazakh" ? "🎵 Аудио файл жүктеу" : lang === "English" ? "🎵 Upload Audio File" : "🎵 Загрузить аудиозапись"}</span>
            </Button>
          </div>
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
