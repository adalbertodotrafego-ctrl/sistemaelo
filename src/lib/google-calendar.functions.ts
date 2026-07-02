import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CALENDAR_SCOPE = "openid email https://www.googleapis.com/auth/calendar";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CAL_API = "https://www.googleapis.com/calendar/v3";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

function randomState() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Credenciais do Google não configuradas no servidor.");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description ?? "Falha ao renovar acesso ao Google. Reconecte o Google Calendar.");
  return json.access_token as string;
}

async function gcal(accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`${CAL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

function toGoogleEvent(e: any) {
  return {
    summary: e.title,
    location: e.location ?? undefined,
    description: e.notes ?? undefined,
    start: { dateTime: new Date(e.start_at).toISOString() },
    end: { dateTime: new Date(e.end_at ?? e.start_at).toISOString() },
  };
}

// Step 1: browser calls this while authenticated, then redirects to the returned authUrl.
export const beginGoogleCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { redirectUri: string }) => d)
  .handler(async ({ data, context }) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error("GOOGLE_CLIENT_ID não configurado no servidor.");
    const state = randomState();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("google_oauth_states" as any).insert({
      state,
      user_id: context.userId,
      redirect_uri: data.redirectUri,
    });
    if (error) throw new Error(error.message);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: data.redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      scope: CALENDAR_SCOPE,
      state,
    });
    return { authUrl: `${AUTH_URL}?${params.toString()}` };
  });

// Step 2: the /google-calendar-callback page calls this with the ?code and ?state Google sent back.
export const completeGoogleCalendarConnect = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; state: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: stateRow, error: stateErr } = await supabaseAdmin
      .from("google_oauth_states" as any)
      .select("*")
      .eq("state", data.state)
      .maybeSingle();
    if (stateErr || !stateRow) throw new Error("Sessão de conexão expirada. Tente conectar novamente.");
    await supabaseAdmin.from("google_oauth_states" as any).delete().eq("state", data.state);

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Credenciais do Google não configuradas no servidor.");

    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: data.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: (stateRow as any).redirect_uri,
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenJson.error_description ?? "Falha ao obter tokens do Google");
    if (!tokenJson.refresh_token) {
      throw new Error(
        "O Google não retornou permissão contínua. Remova o acesso do app em myaccount.google.com/permissions e tente conectar de novo.",
      );
    }

    const userinfoRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tokenJson.access_token}` } });
    const userinfo = await userinfoRes.json();

    const { error: upsertErr } = await supabaseAdmin.from("google_calendar_connections" as any).upsert(
      {
        user_id: (stateRow as any).user_id,
        google_email: userinfo.email ?? null,
        refresh_token: tokenJson.refresh_token,
        calendar_id: "primary",
      },
      { onConflict: "user_id" },
    );
    if (upsertErr) throw new Error(upsertErr.message);

    return { ok: true, email: userinfo.email ?? null };
  });

export const getGoogleCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("google_calendar_connections" as any)
      .select("google_email")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { connected: !!data, email: (data as any)?.google_email ?? null };
  });

export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("google_calendar_connections" as any).delete().eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Two-way sync: pushes this user's own month-view events up, then pulls their Google events down.
// Week schedule (week_items) is a separate table and is never touched here.
export const syncGoogleCalendarNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conn } = await supabaseAdmin
      .from("google_calendar_connections" as any)
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!conn) throw new Error("Google Calendar não está conectado.");
    const c = conn as any;
    const accessToken = await refreshAccessToken(c.refresh_token);
    const calendarId = c.calendar_id || "primary";

    // Events created before this integration existed have no owner — adopt them so they sync too.
    await supabaseAdmin.from("events").update({ created_by: context.userId }).is("created_by", null);

    const { data: localEvents } = await supabaseAdmin.from("events").select("*").eq("created_by", context.userId);
    let pushed = 0;
    for (const ev of localEvents ?? []) {
      try {
        if (ev.external_source === "google_calendar" && ev.external_id) {
          await gcal(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(ev.external_id)}`, {
            method: "PATCH",
            body: JSON.stringify(toGoogleEvent(ev)),
          });
        } else {
          const created = await gcal(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, {
            method: "POST",
            body: JSON.stringify(toGoogleEvent(ev)),
          });
          await supabaseAdmin.from("events").update({ external_id: created.id, external_source: "google_calendar" }).eq("id", ev.id);
        }
        pushed++;
      } catch {
        // one bad event shouldn't stop the rest of the sync
      }
    }

    const now = new Date();
    const timeMin = new Date(now.getTime() - 14 * 86400000).toISOString();
    const timeMax = new Date(now.getTime() + 60 * 86400000).toISOString();
    const qs = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
    const list = await gcal(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events?${qs}`);
    const items: any[] = list.items ?? [];
    let pulled = 0;
    for (const ev of items) {
      const start = ev.start?.dateTime ?? (ev.start?.date ? `${ev.start.date}T00:00:00Z` : null);
      const end = ev.end?.dateTime ?? (ev.end?.date ? `${ev.end.date}T23:59:59Z` : null);
      if (!start) continue;
      const meetLink = ev.hangoutLink ?? ev.conferenceData?.entryPoints?.find((p: any) => p.entryPointType === "video")?.uri ?? null;
      const { error } = await supabaseAdmin.from("events").upsert(
        {
          title: ev.summary ?? "(sem título)",
          type: "meeting",
          start_at: start,
          end_at: end,
          location: ev.location ?? null,
          notes: ev.description ?? null,
          meet_link: meetLink,
          external_id: ev.id,
          external_source: "google_calendar",
          created_by: context.userId,
        },
        { onConflict: "external_source,external_id" },
      );
      if (!error) pulled++;
    }

    return { pushed, pulled };
  });

// Deletes a month-view event both locally and (if it was linked) on Google, in one call.
export const deleteCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ev } = await supabaseAdmin.from("events").select("*").eq("id", data.id).maybeSingle();
    if (ev?.external_source === "google_calendar" && ev.external_id && ev.created_by === context.userId) {
      const { data: conn } = await supabaseAdmin
        .from("google_calendar_connections" as any)
        .select("*")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (conn) {
        try {
          const accessToken = await refreshAccessToken((conn as any).refresh_token);
          await gcal(
            accessToken,
            `/calendars/${encodeURIComponent((conn as any).calendar_id || "primary")}/events/${encodeURIComponent(ev.external_id)}`,
            { method: "DELETE" },
          );
        } catch {
          // Google-side deletion failing shouldn't block the local delete
        }
      }
    }
    const { error } = await supabaseAdmin.from("events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
