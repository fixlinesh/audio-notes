import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const geminiKey = () => process.env.GEMINI_API_KEY || "";

// Ordered list of candidate models verified available in Gemini API.
// gemini-3.5-flash and gemini-3.5-flash-lite are primary because they reliably answer without 503 spikes.
export const CANDIDATE_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
];

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
  const isGuestDemo = request.headers.get("x-guest-demo") === "true";
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!token && isGuestDemo && url && anon) {
    const guestClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return {
      user: { id: "guest-demo", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "" } as User,
      client: guestClient,
    };
  }
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
  options?: { allowEmpty?: boolean; timeoutMs?: number },
): Promise<{ text?: string; error?: string; status?: number; debug?: any }> {
  let lastError = "Could not reach AI service.";
  let lastStatus = 502;
  const attempts: any[] = [];
  const timeoutMs = options?.timeoutMs ?? 45000;

  for (const model of CANDIDATE_MODELS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey() },
          body: JSON.stringify({ contents: [{ parts }], ...(generationConfig ? { generationConfig } : {}) }),
          signal: controller.signal,
        },
      ).finally(() => clearTimeout(timeoutId));

      if (!upstream.ok) {
        const errText = await upstream.text();
        console.error(`Gemini API error on model ${model}:`, upstream.status, errText);
        attempts.push({ model, status: upstream.status, error: errText.slice(0, 150) });
        lastStatus = upstream.status === 429 ? 429 : 502;
        lastError =
          upstream.status === 429
            ? "AI rate limit reached. Please retry in a few seconds."
            : `AI service error (${upstream.status}).`;
        if (upstream.status === 503) {
          await new Promise((r) => setTimeout(r, 400));
        }
        continue;
      }
      const data = await upstream.json();
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? "")
        .join("")
        .trim();
      if (!text && !options?.allowEmpty) {
        attempts.push({ model, empty: true });
        continue;
      }
      return { text };
    } catch (err: any) {
      console.error(`Gemini network/timeout on model ${model}:`, err.message);
      attempts.push({ model, error: err.name === "AbortError" ? "timeout 6.5s" : err.message });
    }
  }

  return { error: lastError, status: lastStatus, debug: attempts };
}
