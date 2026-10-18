import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
export const geminiKey = () => process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";

export async function requireUser(
  request: Request,
): Promise<{ user: User; client: SupabaseClient } | null> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, client };
}

export async function callGemini(parts: unknown[], generationConfig?: unknown) {
  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey() },
      body: JSON.stringify({ contents: [{ parts }], ...(generationConfig ? { generationConfig } : {}) }),
    },
  );
  if (!upstream.ok) {
    console.error("Gemini API error", upstream.status, await upstream.text());
    return { error: `AI service error (${upstream.status}).` };
  }
  const data = await upstream.json();
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim();
  if (!text) return { error: "The AI returned an empty response." };
  return { text };
}
