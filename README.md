# Audio Notes

React + Vite app: sign up / sign in (Supabase Auth), record a lecture or upload audio/video/PDF, get a transcript and an AI summary (Google Gemini), keep everything in a private per-user library, and chat with an AI teacher about the lecture.

## Setup

1. **Supabase** → SQL Editor → run all of `supabase.sql` (table `recordings`, private bucket `audio`, row-level security).
2. **Supabase** → Authentication → Providers → Email: for testing you may turn "Confirm email" off.
3. **Vercel** → Project → Settings → Environment Variables (then redeploy):

| Name | Where it is used |
| --- | --- |
| `VITE_SUPABASE_URL` | browser + API |
| `VITE_SUPABASE_ANON_KEY` | browser + API |
| `GEMINI_API_KEY` | API only (never `VITE_`) |
| `GEMINI_MODEL` | optional, default `gemini-3.5-flash-lite` |

Local: copy `.env.example` to `.env`, `npm install`, `npm run dev` (the `/api` routes need `vercel dev` or a deployed project).

## How it works

- `src/lib/supabase.ts` — Supabase client, upload + save (`saveMedia`), list/delete, `authFetch` (sends the user's token to `/api`).
- `api/summarize.ts`, `api/transcribe.ts`, `api/chat.ts` — Gemini calls. They reject requests without a valid Supabase session.
- Transcript sources: browser live transcription while recording, PDF text, or server speech-to-text for uploaded audio (files up to ~14 MB).
