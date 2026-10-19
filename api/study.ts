// Serverless function (Vercel): quiz questions + flashcards generated from the lecture transcript.
import { callGemini, geminiKey, json, requireUser } from "./_lib.js";

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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const transcript = String(body.transcript ?? "").trim().slice(0, MAX_TRANSCRIPT_CHARS);
  if (transcript.length < 20) return json({ error: "The transcript is too short to make a test." }, 400);
  const title = String(body.title ?? "").slice(0, 200);
  const language = String(body.language ?? "English").slice(0, 30);

  const prompt = `
You are an expert teacher making a self-check test for a student from the lecture transcript below.
The transcript comes from speech recognition and may contain errors; fix obvious ones using context.
Write everything in ${language}.

Create:
- 8 multiple-choice questions. Each has exactly 4 answer options with exactly one correct answer, and a one or two sentence explanation of why it is correct. Test understanding of the lecture's key ideas, not trivia. Wrong options must be plausible but clearly wrong according to the lecture.
- 8 flashcards: a short key term or question on the front and a clear definition or answer on the back.
Use only facts supported by the lecture.

Lecture title: ${title}

<transcript>
${transcript}
</transcript>
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
  if (result.error) return json({ error: result.error }, 502);

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
