import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("push_subscriptions" as any).upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpoint: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("push_subscriptions" as any).delete().eq("endpoint", data.endpoint).eq("user_id", context.userId);
    return { ok: true };
  });

// Called by notifyUsers() right after it writes to the notifications table — requires the
// caller to be logged in (same trust model as the "notif insert any" policy: any authenticated
// user may notify any other user), but the target user list can be anyone, not just the caller.
export const sendPushToUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userIds: string[]; title: string; body?: string; link?: string }) => d)
  .handler(async ({ data }) => {
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPublic || !vapidPrivate || data.userIds.length === 0) return { sent: 0 };

    const webpush = await import("web-push");
    webpush.setVapidDetails("mailto:contato@elomarketing.com.br", vapidPublic, vapidPrivate);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs } = await supabaseAdmin.from("push_subscriptions" as any).select("*").in("user_id", data.userIds);

    const payload = JSON.stringify({ title: data.title, body: data.body ?? "", link: data.link ?? "/" });
    let sent = 0;
    for (const sub of (subs ?? []) as any[]) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        sent++;
      } catch (err: any) {
        // Subscription is gone (browser data cleared, uninstalled, etc.) — stop trying it.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabaseAdmin.from("push_subscriptions" as any).delete().eq("id", sub.id);
        }
      }
    }
    return { sent };
  });
