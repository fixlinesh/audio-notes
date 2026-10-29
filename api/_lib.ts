import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const geminiKey = () => process.env.GEMINI_API_KEY || "";

const ALLOWED_LANGUAGES = new Set(["English", "Russian", "Kazakh"]);

export function sanitizeLang(val: unknown, fallback = "English"): string {
  const s = String(val ?? "").trim();
  return ALLOWED_LANGUAGES.has(s) ? s : fallback;
}

export function escapeXml(val: string): string {
  return val.replace(/<\/?(transcript|lecture)>/gi, "");
}

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

export async function callGemini(
  parts: unknown[],
  generationConfig?: unknown,
  options?: { allowEmpty?: boolean },
): Promise<{ text?: string; error?: string; status?: number }> {
  try {
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
      return {
        error: upstream.status === 429 ? "AI rate limit reached. Please retry in a few seconds." : `AI service error (${upstream.status}).`,
        status: upstream.status === 429 ? 429 : 502,
      };
    }
    const data = await upstream.json();
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();
    if (!text && !options?.allowEmpty) return { error: "The AI returned an empty response.", status: 502 };
    return { text };
  } catch (err) {
    console.error("Gemini network error", err);
    return { error: "Could not reach AI service.", status: 502 };
  }
}
