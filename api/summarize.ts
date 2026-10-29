// Serverless function (Vercel): lecture summary via Google Gemini. Requires a signed-in user.
import { callGemini, escapeXml, geminiKey, json, requireUser, sanitizeLang } from "./_lib.js";

const MAX_TRANSCRIPT_CHARS = 60_000;

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
  if (transcript.length < 20) return json({ error: "The transcript is too short to summarize." }, 400);

  const title = escapeXml(String(body.title ?? "").slice(0, 200));
  const subject = escapeXml(String(body.subject ?? "").slice(0, 200));
  const sourceLanguage = sanitizeLang(body.sourceLanguage, "English");
  const outputLanguage = sanitizeLang(body.outputLanguage, "English");

  const prompt = `
You are an expert study assistant for university students. Your task is to provide a comprehensive, deep, and highly detailed summary of the lecture transcript provided below.
The transcript comes from speech recognition and may contain errors; fix obvious ones using context.
Provide a thorough and exhaustive breakdown of all topics, core arguments, concepts, and logical steps covered in the lecture. Do not be too brief — explain the concepts fully.
Write every field in ${outputLanguage}. Do not invent facts that are not supported by the lecture.

Lecture title: ${title}
Subject: ${subject}
Spoken language: ${sourceLanguage}

<transcript>
${transcript}
</transcript>
`;

  const result = await callGemini([{ text: prompt }], {
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        explanation: {
          type: "STRING",
          description:
            "A comprehensive, detailed academic explanation covering all main topics and concepts of the lecture in 6-10 rich, informative sentences.",
        },
        simplified: {
          type: "STRING",
          description:
            "A clear, detailed step-by-step breakdown explaining the concepts simply with everyday analogies and examples in 5-8 sentences.",
        },
        keyPoints: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "6-10 detailed and informative key points capturing the core insights of the lecture.",
        },
        terms: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "5-12 important terms and definitions mentioned in the lecture.",
        },
        example: {
          type: "STRING",
          description: "A detailed practical example or case study from or consistent with the lecture.",
        },
      },
      required: ["explanation", "simplified", "keyPoints", "terms", "example"],
    },
  });
  if (result.error) return json({ error: result.error }, result.status ?? 502);

  try {
    return json(JSON.parse(result.text as string));
  } catch {
    return json({ error: "Failed to parse AI response." }, 502);
  }
}
