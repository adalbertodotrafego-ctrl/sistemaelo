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
