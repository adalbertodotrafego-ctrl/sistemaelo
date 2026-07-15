import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REPORTEI_METRIC_CATALOG, formatReporteiValue } from "@/lib/reportei-metrics";

// Integração com a API do Reportei (https://developers.reportei.com/).
// O token (Bearer) fica só no servidor, em REPORTEI_API_TOKEN — mesmo padrão
// já usado para Google Calendar e Meta Ads. Gerado em Reportei →
// Configurações da empresa → API Reportei.

const API_BASE = "https://app.reportei.com/api/v2";

function getToken(): string | null {
  return process.env.REPORTEI_API_TOKEN || null;
}

async function reportei(path: string, init?: RequestInit) {
  const token = getToken();
  if (!token) throw new Error("REPORTEI_NOT_CONFIGURED");
  // Em runtime serverless o fetch pode reaproveitar uma resposta em cache e devolver
  // números antigos — o que fazia o relatório "não vir atualizado". Forçamos uma busca
  // sempre nova: cache: "no-store", cabeçalhos anti-cache e um carimbo de tempo na URL
  // (cache-busting) para nunca cair numa resposta guardada por CDN/proxy.
  const sep = path.includes("?") ? "&" : "?";
  const url = `${API_BASE}${path}${sep}_ts=${Date.now()}`;
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = json?.message ?? json?.error ?? `Reportei API ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export const getReporteiStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ connected: !!getToken() }));

// Lista os projetos (clientes) cadastrados no Reportei — usado para vincular
// um cliente do sistema ao projeto correspondente lá.
export const listReporteiProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    if (!getToken()) return { connected: false, projects: [] as any[] };
    const json = await reportei("/projects?per_page=100");
    return { connected: true, projects: json.data ?? [] };
  });

// Salva qual projeto do Reportei corresponde a um cliente do sistema.
export const linkClientToReportei = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string; reporteiProjectId: number | null }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("clients")
      .update({ reportei_project_id: data.reporteiProjectId } as any)
      .eq("id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Puxa os indicadores reais de todas as plataformas conectadas do cliente no
// Reportei, no período pedido, já formatados como {label, value} — prontos
// para entrar direto na lista editável de indicadores do relatório.
export const getReporteiIndicators = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reporteiProjectId: number; start: string; end: string }) => d)
  .handler(async ({ data }) => {
    if (!getToken()) throw new Error("Reportei não está conectado. Configure REPORTEI_API_TOKEN no servidor.");

    const integrationsRes = await reportei(`/integrations?project_id=${data.reporteiProjectId}&per_page=100`);
    const integrations: any[] = (integrationsRes.data ?? []).filter((i: any) => i.status === "active");

    const results: { label: string; value: string; platform: string; error?: string }[] = [];

    for (const integ of integrations) {
      const catalog = REPORTEI_METRIC_CATALOG[integ.slug];
      if (!catalog || catalog.length === 0) continue;
      // Um projeto do Reportei pode ter mais de uma conta do mesmo tipo (ex.: dois
      // Facebook Ads de clientes distintos agrupados no mesmo projeto — caso real:
      // "Metronorte Florianópolis" tem BR-101 e Ivo Silveira como contas separadas).
      // Nesse caso, o nome da conta entra no rótulo pra não misturar os números.
      const sameSlugCount = integrations.filter((i) => i.slug === integ.slug).length;
      const suffix = sameSlugCount > 1 ? ` — ${integ.name}` : "";
      try {
        const body = {
          start: data.start,
          end: data.end,
          integration_id: integ.id,
          metrics: catalog.map((m) => {
            const { label, format, ...apiFields } = m;
            return apiFields;
          }),
        };
        const json = await reportei("/metrics/get-data", { method: "POST", body: JSON.stringify(body) });
        // A API embrulha o resultado num campo "data" — {"data": {"fb_ads:spend": {...}}} —
        // diferente do que uma ferramenta intermediária de teste tinha mostrado sem esse envelope.
        for (const m of catalog) {
          const raw = json?.data?.[m.reference_key]?.values;
          if (raw === undefined || raw === null) continue;
          results.push({ label: m.label + suffix, value: formatReporteiValue(raw, m.format), platform: integ.slug });
        }
      } catch (e: any) {
        results.push({ label: `${integ.name} (${integ.slug})`, value: "—", platform: integ.slug, error: e?.message ?? "Falha ao consultar" });
      }
    }

    return { connected: true, indicators: results, fetchedAt: new Date().toISOString(), start: data.start, end: data.end };
  });
