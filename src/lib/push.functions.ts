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

// Called by notifyUsers() right after it writes to the notifications table.
// Qualquer pessoa do time pode avisar outra — mas a entrada é validada e
// limitada: sem isso, uma conta comprometida disparava push com texto e link
// arbitrários para o sistema inteiro (phishing dentro do próprio app).
const MAX_TARGETS = 500;
const MAX_TITLE = 120;
const MAX_BODY = 400;

export const sendPushToUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userIds: string[]; title: string; body?: string; link?: string }) => {
    if (!Array.isArray(d?.userIds)) throw new Error("Lista de destinatários inválida");
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const userIds = [...new Set(d.userIds.filter((id) => typeof id === "string" && uuid.test(id)))];
    if (userIds.length > MAX_TARGETS) throw new Error("Destinatários demais em um envio só");
    // Link é sempre interno: bloqueia usar o push como isca para fora do app.
    const link = typeof d.link === "string" && d.link.startsWith("/") && !d.link.startsWith("//") ? d.link : "/";
    return {
      userIds,
      title: String(d?.title ?? "").slice(0, MAX_TITLE),
      body: String(d?.body ?? "").slice(0, MAX_BODY),
      link,
    };
  })
  .handler(async ({ data, context }) => {
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPublic || !vapidPrivate || data.userIds.length === 0) return { sent: 0 };

    // Só quem já faz parte do time dispara notificação.
    // `is_approved` é nova e ainda não está no types.ts gerado do Supabase.
    const { data: approved } = await (context.supabase as any).rpc("is_approved", { _user_id: context.userId });
    if (!approved) throw new Error("Acesso ainda não aprovado");

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
