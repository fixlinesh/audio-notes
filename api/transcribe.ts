// Serverless function (Vercel): speech-to-text for an uploaded recording via Google Gemini.
// The browser first uploads the file to Supabase Storage; here we download it with the user's own
// token (so Storage RLS applies) and send it to Gemini. Vercel limits request bodies to ~4.5 MB,
// which is why the file is not posted to this function directly.
import { Buffer } from "node:buffer";
import { callGemini, geminiKey, json, requireUser, sanitizeLang } from "./_lib.js";

const MAX_BYTES = 14 * 1024 * 1024; // base64 inflates by ~33%; Gemini inline limit is ~20 MB

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

  const path = String(body.path ?? "");
  const language = sanitizeLang(body.language, "English");

  let mimeType = (String(body.mimeType ?? "") || "audio/mpeg").split(";")[0].toLowerCase().trim();
  if (mimeType === "audio/webm") mimeType = "video/webm";
  if (mimeType === "audio/m4a" || mimeType === "audio/x-m4a") mimeType = "audio/mp4";
  let data = "";

  if (body.data && typeof body.data === "string") {
    // Direct audio data passed (base64 string)
    data = body.data;
  } else if (path) {
    if (!path.startsWith(`${auth.user.id}/`) || path.includes("..")) {
      return json({ error: "Forbidden." }, 403);
    }
    const file = await auth.client.storage.from("audio").download(path);
    if (file.error || !file.data) return json({ error: "Could not read the uploaded file." }, 404);
    if (file.data.size > MAX_BYTES) {
      return json({ error: "File is too large for automatic transcription (max ~14 MB)." }, 413);
    }
    mimeType = (file.data.type || mimeType || "audio/mpeg").split(";")[0].toLowerCase().trim();
    if (mimeType === "audio/webm") mimeType = "video/webm"; // browser recordings: audio-only WebM container
    if (mimeType === "audio/m4a" || mimeType === "audio/x-m4a") mimeType = "audio/mp4";
    data = Buffer.from(await file.data.arrayBuffer()).toString("base64");
  } else {
    return json({ error: "No audio file or path provided." }, 400);
  }

  const result = await callGemini(
    [
      { inlineData: { mimeType, data } },
      {
        text:
          `Transcribe this lecture recording word for word. The spoken language is ${language}. ` +
          `Return only the transcript text, without timestamps, speaker labels or comments. ` +
          `If there is no speech, return an empty string.`,
      },
    ],
    undefined,
    { allowEmpty: true, timeoutMs: 55000 },
  );
  if (result.error) return json({ error: result.error }, result.status ?? 502);
  return json({ transcript: result.text ?? "" });
}
