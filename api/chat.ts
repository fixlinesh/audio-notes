// Serverless function (Vercel): "AI Teacher" chat grounded in the lecture transcript.
import { callGemini, geminiKey, json, requireUser } from "./_lib.js";

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

  const question = String(body.question ?? "").trim().slice(0, 2000);
  if (!question) return json({ error: "Empty question." }, 400);
  const title = String(body.title ?? "").slice(0, 200);
  const language = String(body.language ?? "English").slice(0, 30);
  const transcript = String(body.transcript ?? "").slice(0, 40_000);
  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
  const dialog = history
    .map((m: { role?: string; text?: string }) =>
      `${m.role === "user" ? "Student" : "Teacher"}: ${String(m.text ?? "").slice(0, 1500)}`,
    )
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

  const result = await callGemini([{ text: prompt }]);
  if (result.error) return json({ error: result.error }, 502);
  return json({ answer: result.text });
}
