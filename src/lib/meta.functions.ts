import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { META_ACCOUNTS } from "@/lib/meta-accounts";

// Integração com o Meta Marketing API (Graph API).
// O token de acesso (System User ou usuário, com permissão ads_read) fica APENAS no
// servidor, na variável de ambiente META_ACCESS_TOKEN — nunca no navegador.
// Mesmo padrão usado hoje pela integração do Google Calendar.

const API_VERSION = process.env.META_API_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

function getToken(): string | null {
  return process.env.META_ACCESS_TOKEN || null;
}

async function graph(path: string, params: Record<string, string>) {
  const token = getToken();
  if (!token) throw new Error("META_NOT_CONFIGURED");
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH}${path}?${qs.toString()}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message ?? `Meta API ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

// Diz se o servidor tem o token do Meta configurado (para a tela mostrar
// "conecte o Meta" em vez de dados vazios).
export const getMetaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ connected: !!getToken(), apiVersion: API_VERSION }));

// Visão geral por conta/cliente: campanhas ativas, gasto no período, gasto hoje e CTR.
export const getMetaOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { datePreset?: string }) => d ?? {})
  .handler(async ({ data }) => {
    if (!getToken()) return { connected: false, datePreset: "this_month", accounts: [] };
    const preset = data?.datePreset || "this_month";

    const accounts = await Promise.all(
      META_ACCOUNTS.map(async (acc) => {
        try {
          const [campaigns, periodIns, todayIns] = await Promise.all([
            graph(`/act_${acc.accountId}/campaigns`, {
              fields: "id,effective_status",
              effective_status: JSON.stringify(["ACTIVE"]),
              limit: "500",
            }),
            graph(`/act_${acc.accountId}/insights`, {
              date_preset: preset,
              fields: "spend,ctr,impressions,clicks",
            }),
            graph(`/act_${acc.accountId}/insights`, {
              date_preset: "today",
              fields: "spend",
            }),
          ]);
          const active = (campaigns.data ?? []).filter((c: any) => c.effective_status === "ACTIVE");
          const p = periodIns.data?.[0];
          const t = todayIns.data?.[0];
          return {
            client: acc.client,
            accountName: acc.accountName,
            accountId: acc.accountId,
            currency: acc.currency,
            activeCampaigns: active.length,
            spendPeriod: Number(p?.spend ?? 0),
            spendToday: Number(t?.spend ?? 0),
            ctr: Number(p?.ctr ?? 0),
            impressions: Number(p?.impressions ?? 0),
            clicks: Number(p?.clicks ?? 0),
            error: null as string | null,
          };
        } catch (e: any) {
          return {
            client: acc.client,
            accountName: acc.accountName,
            accountId: acc.accountId,
            currency: acc.currency,
            activeCampaigns: 0,
            spendPeriod: 0,
            spendToday: 0,
            ctr: 0,
            impressions: 0,
            clicks: 0,
            error: e?.message === "META_NOT_CONFIGURED" ? "Token não configurado" : (e?.message ?? "Erro ao consultar"),
          };
        }
      }),
    );

    return { connected: true, datePreset: preset, accounts };
  });

// Detalhe de uma conta: campanhas ativas com gasto, CTR, cliques, CPC e objetivo.
export const getMetaAccountCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { accountId: string; datePreset?: string }) => d)
  .handler(async ({ data }) => {
    if (!getToken()) return { connected: false, currency: "BRL", campaigns: [] };
    const acc = META_ACCOUNTS.find((a) => a.accountId === data.accountId);
    if (!acc) throw new Error("Conta não encontrada na lista configurada.");
    const preset = data.datePreset || "today";

    const json = await graph(`/act_${acc.accountId}/campaigns`, {
      fields: `name,objective,effective_status,daily_budget,lifetime_budget,insights.date_preset(${preset}){spend,ctr,impressions,clicks,cpc,reach}`,
      effective_status: JSON.stringify(["ACTIVE"]),
      limit: "300",
    });

    const campaigns = (json.data ?? []).map((c: any) => {
      const ins = c.insights?.data?.[0];
      return {
        id: c.id,
        name: c.name,
        objective: c.objective ?? null,
        status: c.effective_status,
        dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
        lifetimeBudget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
        spend: Number(ins?.spend ?? 0),
        ctr: Number(ins?.ctr ?? 0),
        impressions: Number(ins?.impressions ?? 0),
        clicks: Number(ins?.clicks ?? 0),
        cpc: Number(ins?.cpc ?? 0),
        reach: Number(ins?.reach ?? 0),
      };
    });

    // Maior gasto primeiro
    campaigns.sort((a: any, b: any) => b.spend - a.spend);

    return { connected: true, client: acc.client, currency: acc.currency, datePreset: preset, campaigns };
  });
