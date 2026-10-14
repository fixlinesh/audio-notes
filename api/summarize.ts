// Serverless function (Vercel) for Google Gemini
const MODEL = "gemini-1.5-flash";
const MAX_TRANSCRIPT_CHARS = 60_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function POST(request: Request) {
    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: "Server is missing Gemini API key." }, 500);


  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const transcript = String(body.transcript ?? "").trim().slice(0, MAX_TRANSCRIPT_CHARS);
  if (transcript.length < 20) return json({ error: "The transcript is too short to summarize." }, 400);

  const title = String(body.title ?? "").slice(0, 200);
  const subject = String(body.subject ?? "").slice(0, 200);
  const sourceLanguage = String(body.sourceLanguage ?? "English").slice(0, 30);
  const outputLanguage = String(body.outputLanguage ?? "English").slice(0, 30);

  const prompt = `
You are a study assistant for university students. You turn lecture transcripts into clear, accurate summaries.
The transcript comes from speech recognition and may contain errors; fix obvious ones using context.
Write every field in ${outputLanguage}. Do not invent facts that are not supported by the lecture.

Lecture title: ${title}
Subject: ${subject}
Spoken language: ${sourceLanguage}

<transcript>
${transcript}
</transcript>
`;

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              explanation: { type: "STRING", description: "Clear academic explanation, 2-4 sentences." },
              simplified: { type: "STRING", description: "Explained simply with an everyday analogy, 2-4 sentences." },
              keyPoints: { type: "ARRAY", items: { type: "STRING" }, description: "3-6 key points." },
              terms: { type: "ARRAY", items: { type: "STRING" }, description: "3-8 important terms." },
              example: { type: "STRING", description: "One short worked example." }
            },
            required: ["explanation", "simplified", "keyPoints", "terms", "example"]
          }
        }
      }),
    }
  );

  if (!upstream.ok) {
    console.error("Gemini API error", upstream.status, await upstream.text());
    return json({ error: "The AI service failed. Please try again." }, 502);
  }

  const data = await upstream.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textResponse) return json({ error: "The AI returned an unexpected response." }, 502);

  try {
    const parsed = JSON.parse(textResponse);
    return json(parsed);
  } catch {
    return json({ error: "Failed to parse AI response." }, 502);
  }
}
