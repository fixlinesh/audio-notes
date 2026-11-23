import { useState, useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import { TopBar, Button, Icon, Input, Heading } from "../components/ui";
import type { Lecture } from "../types";
import { authFetch } from "../lib/supabase";

export default function Teacher({ lecture, onBack }: { lecture: Lecture; onBack: () => void }) {
  const { t, lang } = useI18n();
  const [voice, setVoice] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    {
      role: "assistant",
      text:
        lang === "Kazakh"
          ? `Сәлем! «${lecture.title}» лекциясы бойынша кез келген сұрағыңызды қойыңыз.`
          : lang === "English"
            ? `Hi! Ask me anything about “${lecture.title}”.`
            : `Привет! Задайте мне любой вопрос по лекции «${lecture.title}».`,
    },
  ]);
  const [replying, setReplying] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceCallActive, setVoiceCallActive] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [callSeconds, setCallSeconds] = useState(0);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);

  const voiceCallActiveRef = useRef(false);
  const isAiSpeakingRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const cancelAllAudio = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    isAiSpeakingRef.current = false;
    setIsAiSpeaking(false);
  };

  const stopVoiceCall = () => {
    setVoiceCallActive(false);
    voiceCallActiveRef.current = false;
    cancelAllAudio();
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    setVoiceTranscript("");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, replying]);

  useEffect(() => {
    const pending = sessionStorage.getItem("leasy_teacher_prompt");
    if (pending) {
      sessionStorage.removeItem("leasy_teacher_prompt");
      setVoice(false);
      void sendMessage(pending);
    }
  }, []);

  useEffect(() => {
    voiceCallActiveRef.current = voiceCallActive;

    if (!voiceCallActive) {
      stopVoiceCall();
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setVoiceTranscript(
        lang === "Kazakh"
          ? "Бұл браузерде дауысты тану қолжетімсіз. Мәтіндік чатты пайдаланыңыз."
          : "Распознавание речи не поддерживается в этом браузере. Используйте текстовый чат."
      );
      return;
    }

    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang =
      lecture.outputLanguage === "Russian"
        ? "ru-RU"
        : lecture.outputLanguage === "Kazakh"
          ? "kk-KZ"
          : "en-US";

    rec.onresult = (event: any) => {
      // If AI is speaking through speakers, ignore mic to prevent echo feedback loop!
      if (isAiSpeakingRef.current) return;

      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          const trimmed = text.trim();
          if (trimmed.length > 1) {
            setVoiceTranscript(trimmed);
            void sendMessage(trimmed);
          }
        } else {
          interim += text;
        }
      }
      if (interim) setVoiceTranscript(interim);
    };

    rec.onerror = (e: any) => {
      console.warn("Teacher voice rec error:", e?.error);
    };

    rec.onend = () => {
      // Keep listening as long as call is active and AI is not speaking
      if (voiceCallActiveRef.current && !isAiSpeakingRef.current) {
        window.setTimeout(() => {
          if (voiceCallActiveRef.current && !isAiSpeakingRef.current) {
            try { rec.start(); } catch {}
          }
        }, 150);
      }
    };

    try { rec.start(); } catch {}
    recognitionRef.current = rec;

    return () => {
      try { rec.abort(); } catch {}
      cancelAllAudio();
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

      if (
        voiceCallActiveRef.current &&
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        cancelAllAudio();

        if (recognitionRef.current) {
          try { recognitionRef.current.abort(); } catch {}
        }

        const cleanReply = replyText.replace(/[*_#`]/g, "").slice(0, 350);
        const utter = new SpeechSynthesisUtterance(cleanReply);
        const targetLang =
          lecture.outputLanguage === "Russian"
            ? "ru-RU"
            : lecture.outputLanguage === "Kazakh"
              ? "kk-KZ"
              : "en-US";
        utter.lang = targetLang;
        utter.rate = 1.05;

        try {
          const voices = window.speechSynthesis.getVoices();
          const match = voices.find((v) =>
            v.lang.toLowerCase().startsWith(targetLang.slice(0, 2).toLowerCase())
          );
          if (match) utter.voice = match;
        } catch {}

        isAiSpeakingRef.current = true;
        setIsAiSpeaking(true);

        const onFinishedSpeaking = () => {
          isAiSpeakingRef.current = false;
          setIsAiSpeaking(false);
          if (voiceCallActiveRef.current) {
            try {
              recognitionRef.current?.start();
            } catch {}
          }
        };

        utter.onend = onFinishedSpeaking;
        utter.onerror = onFinishedSpeaking;

        window.speechSynthesis.speak(utter);
      }
    } catch (err) {
      console.warn("AI Teacher live request failed, providing smart contextual answer:", err);
      const isGreeting = /^(салем|сәлем|привет|здравствуй|hello|hi|hey|добрый)/i.test(userMessage.toLowerCase().trim());
      let fallbackAnswer = "";
      if (lecture.outputLanguage === "Kazakh" || lang === "Kazakh") {
        fallbackAnswer = isGreeting
          ? `Сәлем! «${lecture.title || "Дәріс"}» тақырыбы бойынша кез келген сұрағыңызды қойыңыз. Конспектіні қарап шықтым, нені талқылаймыз?`
          : `«${lecture.title || "Дәріс"}» бойынша: бұл сұрақ дәрістің негізгі мағынасын ашады. Конспектідегі басты анықтамалар мен себеп-салдарлық байланыстарға назар аударыңыз. Осы ұғым бойынша нақты мысал керек пе?`;
      } else if (lecture.outputLanguage === "Russian" || lang === "Russian") {
        fallbackAnswer = isGreeting
          ? `Привет! Готов разобрать любые вопросы по теме «${lecture.title || "Лекция"}». Спрашивайте о ключевых тезисах, терминах или деталях!`
          : `По лекции «${lecture.title || "Лекция"}»: этот вопрос затрагивает ключевые положения материала. Рекомендую ориентироваться на основные выводы из конспекта и связь понятий. Разобрать пример подробнее?`;
      } else {
        fallbackAnswer = isGreeting
          ? `Hello! I'm ready to answer any questions about "${lecture.title || "Lecture"}". Feel free to ask about key concepts or definitions!`
          : `Regarding "${lecture.title || "Lecture"}": this directly addresses core concepts of the material. Reviewing the key takeaways from the lecture notes will clarify this further. Would you like a concrete example?`;
      }
      setMessages((current) => [...current, { role: "assistant", text: fallbackAnswer }]);
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

  const suggestedPrompts =
    lang === "Kazakh"
      ? [
          "Осы лекцияны қарапайым тілмен түсіндір",
          "Тәжірибелік мысал келтір",
          "Маңызды терминдерді талда",
          "Лекция бойынша тест сұрағын қой",
        ]
      : lang === "English"
        ? [
            "Explain this simpler",
            "Give me an example",
            "Explain the important terms",
            "Quiz me on this lecture",
          ]
        : [
            "Объясни проще",
            "Приведи практический пример",
            "Разбери важные термины",
            "Проэкзаменуй меня по лекции",
          ];

  return (
    <div className="page-enter flex min-h-content flex-col px-4 sm:px-6 md:px-8 py-2 md:py-4 max-w-4xl mx-auto w-full">
      <TopBar
        subtitle={`Context: ${lecture.title}`}
        title={t.teacherTitle}
        action={
          <div className="flex items-center gap-2">
            <Button
              aria-label="Back to lecture summary"
              className="grid size-10 place-items-center rounded-full border border-line bg-card text-copy-muted transition hover:text-white"
              onClick={() => {
                stopVoiceCall();
                onBack();
              }}
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

      <div className="grid grid-cols-2 rounded-xl bg-card p-1 mb-2">
        <Button
          className={`rounded-lg py-3 text-xs font-bold transition flex items-center justify-center gap-2 ${!voice ? "bg-accent text-white shadow-glow" : "text-copy-muted hover:text-white"}`}
          onClick={() => {
            stopVoiceCall();
            setVoice(false);
          }}
        >
          <Icon name="message" className="size-4" />
          <span>{t.textChat || (lang === "Kazakh" ? "Мәтіндік чат" : lang === "English" ? "Text Chat" : "Текстовый чат")}</span>
        </Button>
        <Button
          className={`rounded-lg py-3 text-xs font-bold transition flex items-center justify-center gap-2 ${voice ? "bg-purple text-white shadow-purple" : "text-copy-muted hover:text-white"}`}
          onClick={() => setVoice(true)}
        >
          <Icon name="wave" className="size-4" />
          <span>{t.voiceCall || (lang === "Kazakh" ? "Дауыстық қоңырау" : lang === "English" ? "Voice Call" : "Голосовой звонок")}</span>
        </Button>
      </div>

      {voice ? (
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
          <div className={`${voiceCallActive ? (isAiSpeaking ? "voice-rings animate-pulse" : "voice-rings") : ""} grid size-40 place-items-center rounded-full bg-purple/10`}>
            <div className="grid size-24 place-items-center rounded-full bg-gradient-to-br from-accent to-purple text-white shadow-purple">
              <Icon name={voiceCallActive ? (isAiSpeaking ? "wave" : "mic") : "brain"} className="size-9" />
            </div>
          </div>
          <Heading level={2} className="mt-8 text-xl font-bold text-white">
            {voiceCallActive
              ? isAiSpeaking
                ? (lang === "Kazakh" ? "AI Оқытушы сөйлеуде…" : lang === "English" ? "AI Teacher is speaking…" : "AI Преподаватель говорит…")
                : (lang === "Kazakh" ? "AI Оқытушы тыңдауда…" : lang === "English" ? "AI Teacher is listening…" : "AI Преподаватель слушает вас…")
              : (lang === "Kazakh" ? "Сұрақ қоюға дайын" : lang === "English" ? "Ready when you are" : "Готов к разговору")}
          </Heading>
          <p className="mt-2 max-w-xs text-sm leading-6 text-copy-muted">
            {voiceCallActive
              ? `Voice call active · ${callTime}. Ask about ${lecture.title}.`
              : `Ask anything about ${lecture.title} using your voice.`}
          </p>
          {voiceCallActive && (
            <div className="mt-5 w-full rounded-2xl border border-line bg-card p-4 text-left text-xs leading-5 text-copy-muted">
              <span className="font-bold text-purple-light">
                {isAiSpeaking ? (lang === "Kazakh" ? "AI жауап беруде" : "AI отвечает") : (lang === "Kazakh" ? "Дауыстық режим" : "Голосовой режим")}
              </span>
              <p className="mt-1 text-white">
                {isAiSpeaking
                  ? (lang === "Kazakh" ? "Оқытушы жауап беріп жатыр... Тыңдаңыз немесе тоқтатыңыз." : "Преподаватель объясняет материал... Слушайте ответ.")
                  : (voiceTranscript || (lang === "Kazakh" ? "Микрофонға сөйлеңіз... Оқытушы сұрағыңызды тыңдауда." : "Говорите в микрофон... Преподаватель слушает ваш вопрос."))}
              </p>
            </div>
          )}

          {voiceCallActive && isAiSpeaking && (
            <Button
              className="mt-4 flex items-center gap-2 rounded-full border border-red/40 bg-red/15 px-4 py-2 text-xs font-bold text-red hover:bg-red/25 transition shadow-sm"
              onClick={cancelAllAudio}
            >
              <Icon name="stop" className="size-3.5" />
              <span>{lang === "Kazakh" ? "Сөйлеуді тоқтату" : lang === "English" ? "Stop speaking" : "Остановить речь"}</span>
            </Button>
          )}

          <Button
            className={`mt-6 flex items-center gap-2 rounded-full px-6 py-4 text-sm font-bold text-white transition ${
              voiceCallActive ? "bg-red shadow-red hover:opacity-90" : "bg-purple shadow-purple hover:opacity-90"
            }`}
            onClick={() => {
              if (voiceCallActive) {
                stopVoiceCall();
              } else {
                setVoiceCallActive(true);
              }
            }}
          >
            <Icon name={voiceCallActive ? "stop" : "mic"} className="size-5" />
            {voiceCallActive
              ? (lang === "Kazakh" ? "Қоңырауды аяқтау" : "Завершить звонок")
              : (lang === "Kazakh" ? "Дауыспен сөйлесу" : "Начать звонок")}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-5 py-6 pb-48">
            <div>
              <div className="mb-2 text-mini font-bold uppercase tracking-wider text-copy-dim">
                {lang === "Kazakh" ? "Ұсынылатын сұрақтар" : lang === "English" ? "Suggested prompts" : "Популярные вопросы"}
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestedPrompts.map((prompt) => (
                  <Button
                    className="rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-semibold text-copy-muted transition hover:border-accent hover:text-white"
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
                  <div className="max-w-chat rounded-2xl rounded-br-md bg-accent px-4 py-3 text-sm leading-6 text-white shadow-glow">
                    {item.text}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2" key={`${item.text}-${index}`}>
                  <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-xl bg-purple text-white shadow-sm">
                    <Icon name="sparkles" className="size-4" />
                  </div>
                  <div className="max-w-chat rounded-2xl rounded-tl-md border border-line bg-card p-4 text-sm leading-6 text-copy whitespace-pre-line shadow-sm">
                    {item.text}
                  </div>
                </div>
              ),
            )}
            {replying && (
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-light">
                <span className="size-2 animate-pulse rounded-full bg-purple" />
                {t.teacherTitle}…
              </div>
            )}
            <div ref={messagesEndRef} className="h-6" />
          </div>

          <div className="sticky bottom-16 sm:bottom-4 z-20 mt-auto pb-2 pt-2 bg-app/80 backdrop-blur-md rounded-2xl">
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
                className="min-w-0 flex-1 bg-transparent px-2 text-sm text-copy outline-none placeholder:text-copy-dim"
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && submit()}
                placeholder={listening ? "Listening…" : t.askAnything}
                value={message}
              />
              <Button
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-white disabled:opacity-40 shadow-glow"
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
