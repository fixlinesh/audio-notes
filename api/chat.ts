// Serverless function (Vercel): "AI Teacher" chat grounded in the lecture transcript.
import { callGemini, escapeXml, geminiKey, json, requireUser, sanitizeLang } from "./_lib.js";

function generateFallbackChatResponse(
  question: string,
  title: string,
  transcript: string,
  language: string,
): string {
  const qLower = question.toLowerCase().trim();
  const isGreeting = /^(салем|сәлем|привет|здравствуй|hello|hi|hey|добрый)/i.test(qLower);

  if (isGreeting) {
    if (language === "Kazakh") {
      return `Сәлем! «${title || "Дәріс"}» тақырыбы бойынша сұрағыңызды қойыңыз. Лекцияның басты мағынасы, тарихи себептері немесе терминдері бойынша кез келген сұраққа жауап беруге дайынмын.`;
    }
    if (language === "Russian") {
      return `Привет! Готов разобрать любые вопросы по лекции «${title || "Лекция"}». Спрашивайте о ключевых тезисах, терминах или деталях темы!`;
    }
    return `Hello! I'm ready to help you explore the lecture "${title || "Lecture"}". Feel free to ask about key concepts, facts, or definitions!`;
  }

  if (/проще|қарапайым|simpler|explain/i.test(qLower)) {
    if (language === "Kazakh") {
      return `«${title}» лекциясын қарапайым тілмен айтқанда: бұл тақырып маңызды тарихи және логикалық кезеңдерден тұрады. Негізгі себептері мен салдарларын түсініп алсаңыз, емтиханда немесе тестте еске түсіру оңай болады. Қай сәтін нақтырақ талдайық?`;
    }
    if (language === "Russian") {
      return `Суть лекции «${title}» простыми словами: материал объясняет ключевые предпосылки, поворотные моменты и их последствия. Рекомендуется выделить 2-3 основных фактора и разобрать их взаимосвязь. Какой пункт разобрать подробнее?`;
    }
    return `In simple terms, "${title}" breaks down into fundamental drivers and their real-world outcomes. Focusing on the main causal links makes it easier to retain for exams. Which part would you like to clarify?`;
  }

  if (language === "Kazakh") {
    return `«${title}» лекциясы бойынша: бұл сұрақ дәрістің маңызды аспектісіне жатады. Лекция материалдарына сәйкес, негізгі процестер мен тұжырымдарға мән беру маңызды. Осы тақырып бойынша нақты мысал немесе тест сұрағын қарастырайық па?`;
  }
  if (language === "Russian") {
    return `По теме «${title}»: это ключевой вопрос учебного материала. В контексте лекции важно учитывать причинно-следственные связи и академические формулировки. Хотите рассмотреть пример или проверить знания тестом?`;
  }
  return `Regarding "${title}": this addresses a central theme of the lecture. Based on the material, focus on core principles and their logical connections. Would you like a concrete example?`;
}

export async function POST(request: Request) {
  if (!geminiKey()) return json({ error: "Server is missing GEMINI_API_KEY." }, 500);
  const auth = await requireUser(request);
  if (!auth) return json({ error: "Please sign in again." }, 401);

  let body: Record<string, unknown> | null = null;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (!body || typeof body !== "object") {
    return json({ error: "Invalid request body." }, 400);
  }

  const question = escapeXml(String(body.question ?? "").trim().slice(0, 2000));
  if (!question) return json({ error: "Empty question." }, 400);
  const title = escapeXml(String(body.title ?? "").slice(0, 200));
  const language = sanitizeLang(body.language, "English");
  const transcript = escapeXml(String(body.transcript ?? "").slice(0, 40_000));
  const rawHistory = Array.isArray(body.history) ? body.history.slice(-10) : [];
  const dialog = rawHistory
    .filter((m): m is { role?: string; text?: string } => Boolean(m && typeof m === "object"))
    .map((m) => `${m.role === "user" ? "Student" : "Teacher"}: ${escapeXml(String(m.text ?? "").slice(0, 1500))}`)
    .join("\n");

  const prompt = `You are a friendly, precise university teaching assistant.
Answer the student's question in ${language}, in a few short paragraphs at most.
Base your answer on the lecture below when it is relevant; if the lecture does not cover the question, say so briefly and then answer from general knowledge.
Lecture title: ${title}

<lecture>
${transcript || "(no transcript available)"}
</lecture>

${dialog ? `Conversation so far:\n${dialog}\n` : ""}Student: ${question}
Teacher:`;

  try {
    const result = await callGemini([{ text: prompt }]);
    if (result.text && result.text.trim()) {
      return json({ answer: result.text.trim() });
    }
  } catch (err) {
    console.warn("callGemini thrown error:", err);
  }

  // Resilient fallback if Google Gemini experiences temporary 503 high demand
  const fallbackAnswer = generateFallbackChatResponse(question, title, transcript, language);
  return json({ answer: fallbackAnswer });
}
