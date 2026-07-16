import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GOOGLE_ADS_ACCOUNTS } from "@/lib/google-ads-accounts";

// Integração com a Google Ads API (REST), no mesmo espírito da integração do Meta:
// as credenciais ficam só no servidor, nunca no navegador.
//
// Env vars necessárias: GOOGLE_ADS_DEVELOPER_TOKEN e GOOGLE_ADS_REFRESH_TOKEN.
// O client OAuth (GOOGLE_ADS_CLIENT_ID/GOOGLE_ADS_CLIENT_SECRET) é opcional — se não
// forem definidos, reaproveita o mesmo GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET já usados
// pelo Google Calendar (basta ativar a "Google Ads API" nesse mesmo projeto do Google Cloud).
// Se as contas estiverem sob uma conta gerenciadora (MCC), defina também
// GOOGLE_ADS_LOGIN_CUSTOMER_ID. Enquanto faltar alguma dessas variáveis, esta integração
// fica "não conectada" e a verba em Clientes usa só o Meta.

// Versões da Google Ads API são desativadas ~1 ano após o lançamento — v17 já
// era; v21 (out/2025) vale até ~out/2026. Se um dia falhar com "version not
// supported", basta setar GOOGLE_ADS_API_VERSION no servidor, sem mexer no código.
const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v21";
const ADS_API = `https://googleads.googleapis.com/${API_VERSION}`;
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const DATE_RANGE: Record<string, string> = {
  today: "TODAY",
  this_month: "THIS_MONTH",
  last_7d: "LAST_7_DAYS",
  last_30d: "LAST_30_DAYS",
};

function clientId() {
  return process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
}

function clientSecret() {
  return process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
}

function isConfigured() {
  return !!(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    clientId() &&
    clientSecret() &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN
  );
}

async function getAccessToken() {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId()!,
      client_secret: clientSecret()!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description ?? "Falha ao renovar acesso ao Google Ads");
  return json.access_token as string;
}

async function searchStream(customerId: string, accessToken: string, query: string) {
  const res = await fetch(`${ADS_API}/customers/${customerId}/googleAds:searchStream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      ...(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
        ? { "login-customer-id": process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID }
        : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json().catch(() => []);
  if (!res.ok) {
    const msg = json?.[0]?.error?.message ?? json?.error?.message ?? `Google Ads API ${res.status}`;
    throw new Error(msg);
  }
  // searchStream devolve uma lista de "batches" — juntamos todos os results num array só.
  const results: any[] = [];
  for (const batch of Array.isArray(json) ? json : [json]) {
    results.push(...(batch.results ?? []));
  }
  return results;
}

// Diz se o servidor tem as credenciais do Google Ads configuradas (pra tela mostrar
// "conecte o Google Ads" em vez de dados vazios).
export const getGoogleAdsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ connected: isConfigured(), apiVersion: API_VERSION }));

// Visão geral por conta/cliente: orçamento diário configurado nas campanhas ativas,
// gasto no período e gasto hoje — mesmo formato do getMetaOverview, pra somar os dois.
export const getGoogleAdsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { datePreset?: string }) => d ?? {})
  .handler(async ({ data }) => {
    if (!isConfigured() || GOOGLE_ADS_ACCOUNTS.length === 0) {
      return { connected: isConfigured(), datePreset: "this_month", accounts: [] };
    }
    const preset = data?.datePreset || "this_month";
    const range = DATE_RANGE[preset] || "THIS_MONTH";
    const accessToken = await getAccessToken();

    const accounts = await Promise.all(
      GOOGLE_ADS_ACCOUNTS.map(async (acc) => {
        try {
          const rows = await searchStream(
            acc.customerId,
            accessToken,
            `SELECT campaign.id, campaign_budget.amount_micros, metrics.cost_micros, metrics.clicks, metrics.impressions
             FROM campaign
             WHERE campaign.status = 'ENABLED' AND segments.date DURING ${range}`,
          );
          const todayRows =
            range === "TODAY"
              ? rows
              : await searchStream(
                  acc.customerId,
                  accessToken,
                  `SELECT campaign.id, metrics.cost_micros
                   FROM campaign
                   WHERE campaign.status = 'ENABLED' AND segments.date DURING TODAY`,
                );

          const seenBudget = new Set<string>();
          let budgetDaily = 0;
          let spendPeriod = 0;
          let impressions = 0;
          let clicks = 0;
          for (const r of rows) {
            const id = r.campaign?.id;
            if (id && !seenBudget.has(id)) {
              seenBudget.add(id);
              budgetDaily += Number(r.campaignBudget?.amountMicros ?? 0) / 1_000_000;
            }
            spendPeriod += Number(r.metrics?.costMicros ?? 0) / 1_000_000;
            impressions += Number(r.metrics?.impressions ?? 0);
            clicks += Number(r.metrics?.clicks ?? 0);
          }
          const spendToday = todayRows.reduce((s: number, r: any) => s + Number(r.metrics?.costMicros ?? 0) / 1_000_000, 0);

          return {
            client: acc.client,
            accountName: acc.accountName,
            customerId: acc.customerId,
            currency: acc.currency,
            budgetDaily,
            spendPeriod,
            spendToday,
            ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
            impressions,
            clicks,
            error: null as string | null,
          };
        } catch (e: any) {
          return {
            client: acc.client,
            accountName: acc.accountName,
            customerId: acc.customerId,
            currency: acc.currency,
            budgetDaily: 0,
            spendPeriod: 0,
            spendToday: 0,
            ctr: 0,
            impressions: 0,
            clicks: 0,
            error: e?.message ?? "Erro ao consultar",
          };
        }
      }),
    );

    return { connected: true, datePreset: preset, accounts };
  });
