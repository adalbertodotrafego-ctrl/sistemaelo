import { supabase } from "@/integrations/supabase/client";
import { sendPushToUsers } from "@/lib/push.functions";

type NotifyKind = "info" | "warning" | "success" | "task" | "meeting" | "mention";

export async function notifyUsers(
  userIds: string[],
  opts: { kind: NotifyKind; title: string; body?: string; link?: string; excludeUserId?: string | null },
) {
  const targets = Array.from(new Set(userIds)).filter((id) => id && id !== opts.excludeUserId);
  if (targets.length === 0) return;
  await supabase.from("notifications").insert(
    targets.map((user_id) => ({
      user_id,
      kind: opts.kind,
      title: opts.title,
      body: opts.body ?? null,
      link: opts.link ?? null,
    })),
  );
  try {
    await sendPushToUsers({ data: { userIds: targets, title: opts.title, body: opts.body, link: opts.link } });
  } catch {
    // Push is a best-effort extra — the in-app notification above already landed.
  }
}
