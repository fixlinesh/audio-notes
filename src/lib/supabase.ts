import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

export async function saveRecording(blob: Blob, duration: number, mimeType: string, title: string) {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return;
  const cleanType = (mimeType || blob.type || "audio/webm").split(";")[0];
  const ext = cleanType.includes("mp4") ? "m4a" : "webm";
  const path = `${uid}/${Date.now()}.${ext}`;
  const up = await supabase.storage.from("audio").upload(path, blob, { contentType: cleanType });
  if (up.error) {
    console.error("Upload failed", up.error);
    return;
  }
  const ins = await supabase.from("recordings").insert({ title, audio_path: path, duration });
  if (ins.error) console.error("Insert failed", ins.error);
}
