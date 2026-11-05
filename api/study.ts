// Serverless function (Vercel): quiz questions + flashcards generated from the lecture transcript.
import { callGemini, escapeXml, geminiKey, json, requireUser, sanitizeLang } from "./_lib.js";

const MAX_TRANSCRIPT_CHARS = 60_000;

type Question = { question: string; answers: string[]; correct: number; explanation: string };
type Card = { term: string; definition: string };

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

  const transcript = escapeXml(String(body.transcript ?? "").trim().slice(0, MAX_TRANSCRIPT_CHARS));
  if (transcript.length < 20) return json({ error: "The transcript is too short to make a test." }, 400);
  const title = escapeXml(String(body.title ?? "").slice(0, 200));
  const language = sanitizeLang(body.language, "English");

  const prompt = `
You are an expert university professor creating a high-quality academic self-check test and flashcards strictly based on the lecture material below.
The material comes from speech recognition / lecture notes and may contain errors; fix obvious ones using context.
Write everything in ${language}.

Create:
- 8 substantive, specific multiple-choice questions directly testing the actual concepts, facts, causes, mechanisms, or principles from this lecture.
  * DO NOT ask generic meta-questions (e.g., avoid "What is the goal of studying this topic", "What should a student avoid").
  * Ask concrete, factual, and analytical questions (e.g., "Why did X happen according to the lecture?", "Which definition best explains Y?", "What was the direct consequence of Z?").
  * Each question must have exactly 4 plausible, well-written academic answer options. One is correct, and three are realistic distractors relevant to the lecture's field.
  * Provide a concise, clear explanation for why the correct answer is right based on the lecture.
  * Distribute the correct answer index randomly among 0, 1, 2, and 3 across the questions.
- 8 flashcards: a clear, specific key term or concept on the front and an accurate academic definition or explanation on the back.

Lecture title: ${title}

<lecture_content>
${transcript}
</lecture_content>
`;

  const result = await callGemini([{ text: prompt }], {
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        quiz: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              question: { type: "STRING" },
              answers: { type: "ARRAY", items: { type: "STRING" } },
              correct: { type: "INTEGER", description: "0-based index of the correct answer in answers" },
              explanation: { type: "STRING" },
            },
            required: ["question", "answers", "correct", "explanation"],
          },
        },
        flashcards: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { term: { type: "STRING" }, definition: { type: "STRING" } },
            required: ["term", "definition"],
          },
        },
      },
      required: ["quiz", "flashcards"],
    },
  });
  if (result.error) return json({ error: result.error }, result.status ?? 502);

  try {
    const raw = JSON.parse(result.text as string) as { quiz?: Question[]; flashcards?: Card[] };

    // Keep only well-formed questions and shuffle the options so the right answer is not always first.
    const quiz = (raw.quiz ?? [])
      .filter(
        (q) =>
          q?.question &&
          Array.isArray(q.answers) &&
          q.answers.length === 4 &&
          Number.isInteger(q.correct) &&
          q.correct >= 0 &&
          q.correct < 4,
      )
      .map((q) => {
        const order = shuffle([0, 1, 2, 3]);
        return {
          question: q.question,
          answers: order.map((i) => q.answers[i]),
          correct: order.indexOf(q.correct),
          explanation: q.explanation ?? "",
        };
      });
    const flashcards = (raw.flashcards ?? []).filter((c) => c?.term && c?.definition);

    if (quiz.length === 0 && flashcards.length === 0) {
      return json({ error: "The AI did not return a usable test. Please try again." }, 502);
    }
    return json({ quiz, flashcards });
  } catch {
    return json({ error: "Failed to parse AI response." }, 502);
  }
}
