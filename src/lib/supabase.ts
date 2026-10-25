import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anon);

export const AUDIO_BUCKET = "audio";

export type RecordingRow = {
  id: string;
  user_id?: string | null;
  title: string | null;
  audio_path: string | null;
  transcript: string | null;
  summary: unknown;
  study: unknown;
  duration: number | null;
  created_at: string | null;
};

function extensionFor(mime: string, fileName?: string) {
  const fromName = fileName?.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

/** Uploads a recording/file to Storage and creates its row in `recordings`. */
export async function saveMedia(
  blob: Blob,
  opts: { title: string; duration?: number; mimeType?: string; fileName?: string },
): Promise<{ row?: RecordingRow; error?: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { error: "You are not signed in." };

  const contentType = (opts.mimeType || blob.type || "audio/webm").split(";")[0];
  const path = `${uid}/${Date.now()}.${extensionFor(contentType, opts.fileName)}`;

  const up = await supabase.storage.from(AUDIO_BUCKET).upload(path, blob, { contentType });
  if (up.error) {
    console.error("Upload failed", up.error);
    return { error: `Upload failed: ${up.error.message}` };
  }

  // `duration` is an integer column: a fractional value (12.38) makes the insert fail.
  const seconds = Number.isFinite(opts.duration) ? Math.max(0, Math.round(opts.duration as number)) : null;
  const ins = await supabase
    .from("recordings")
    .insert({ user_id: uid, title: opts.title, audio_path: path, duration: seconds })
    .select()
    .single();
  if (ins.error) {
    console.error("Insert failed", ins.error);
    await supabase.storage.from(AUDIO_BUCKET).remove([path]);
    return { error: `Could not save the recording: ${ins.error.message}` };
  }
  return { row: ins.data as RecordingRow };
}

export async function updateRecording(
  id: string,
  patch: Partial<Pick<RecordingRow, "title" | "transcript" | "summary" | "study">>,
) {
  const { error } = await supabase.from("recordings").update(patch).eq("id", id);
  if (error) console.error("Update failed", error);
  return !error;
}

export async function listRecordings(): Promise<RecordingRow[]> {
  const { data, error } = await supabase
    .from("recordings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RecordingRow[];
}

export async function getSignedAudioUrl(path: string) {
  const { data, error } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteRecording(row: RecordingRow) {
  if (row.audio_path) await supabase.storage.from(AUDIO_BUCKET).remove([row.audio_path]);
  const { error } = await supabase.from("recordings").delete().eq("id", row.id);
  if (error) throw new Error(error.message);
}

/** fetch() to our /api routes with the user's Supabase token (the API rejects anonymous calls). */
export async function authFetch(input: string, body: unknown) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(input, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** Row for a lecture that has no audio (e.g. a PDF or a typed transcript). */
export async function createLectureRow(opts: { title: string; transcript?: string }) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { error: "You are not signed in." } as { row?: RecordingRow; error?: string };

  const { data, error } = await supabase
    .from("recordings")
    .insert({ user_id: uid, title: opts.title, transcript: opts.transcript ?? null })
    .select()
    .single();
  if (error) {
    console.error("Insert failed", error);
    return { error: `Could not save the lecture: ${error.message}` } as { row?: RecordingRow; error?: string };
  }
  return { row: data as RecordingRow } as { row?: RecordingRow; error?: string };
}
