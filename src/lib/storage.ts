import { supabase } from "@/integrations/supabase/client";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export async function uploadImage(bucket: "avatars" | "logos", file: File, prefix: string) {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${prefix}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true, contentType: file.type,
  });
  if (error) throw error;
  const { data, error: sErr } = await supabase.storage.from(bucket).createSignedUrl(path, TEN_YEARS);
  if (sErr) throw sErr;
  return data.signedUrl;
}

export type Attachment = { name: string; path: string; type: string; size: number };

export async function uploadTaskFile(file: File, prefix: string): Promise<Attachment> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const { error } = await supabase.storage.from("task-files").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return { name: file.name, path, type: file.type, size: file.size };
}

export async function getTaskFileUrl(path: string) {
  const { data, error } = await supabase.storage.from("task-files").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
