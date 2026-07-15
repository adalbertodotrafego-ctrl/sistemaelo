import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getMetaOverview } from "@/lib/meta.functions";
import { getGoogleAdsOverview } from "@/lib/google-ads.functions";

// Junta a verba (orçamento diário configurado) do Meta com a do Google Ads por cliente,
// pra alimentar o card de cada cliente na aba Clientes em tempo real.

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Um cliente pode ter mais de uma conta de anúncio (ex.: duas unidades no Meta) — por isso
// o casamento é por "contém" nos dois sentidos, e tudo que casar é somado.
function matches(clientLabel: string, adAccountLabel: string) {
  const a = normalize(clientLabel);
  const b = normalize(adAccountLabel);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

export type ClientAdBudget = {
  budgetDaily: number;
  spendToday: number;
  currency: string;
  hasMeta: boolean;
  hasGoogle: boolean;
};

export const getClientsAdBudgets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: clients, error } = await supabaseAdmin.from("clients").select("id,name,company");
    if (error) throw new Error(error.message);

    const [meta, google] = await Promise.all([
      getMetaOverview({ data: { datePreset: "today" } }),
      getGoogleAdsOverview({ data: { datePreset: "today" } }),
    ]);

    const byClient: Record<string, ClientAdBudget> = {};
    for (const c of clients ?? []) {
      const label = c.company || c.name;
      const metaMatches = (meta.accounts ?? []).filter((a: any) => !a.error && matches(label, a.client));
      const googleMatches = (google.accounts ?? []).filter((a: any) => !a.error && matches(label, a.client));
      if (metaMatches.length === 0 && googleMatches.length === 0) continue;
      const all = [...metaMatches, ...googleMatches];
      byClient[c.id] = {
        budgetDaily: all.reduce((s, a) => s + Number(a.budgetDaily || 0), 0),
        spendToday: all.reduce((s, a) => s + Number(a.spendToday || 0), 0),
        currency: metaMatches[0]?.currency || googleMatches[0]?.currency || "BRL",
        hasMeta: metaMatches.length > 0,
        hasGoogle: googleMatches.length > 0,
      };
    }

    return {
      metaConnected: meta.connected,
      googleConnected: google.connected,
      byClient,
    };
  });
