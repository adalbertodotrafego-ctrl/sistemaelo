// Catálogo curado de indicadores puxados do Reportei por plataforma.
// Cada entrada replica exatamente o formato retornado por GET /v2/metrics do
// Reportei (reference_key, component, metrics, dimensions, type) — validado
// manualmente contra a API antes de codar, para os campos que POST
// /v2/metrics/get-data realmente aceita.
export type ReporteiMetricDef = {
  id: string;
  reference_key: string;
  component: string;
  metrics: string[];
  dimensions?: string[];
  type?: string | string[];
  label: string;
  format: "currency" | "percentage" | "add_percentage" | "number";
};

export const REPORTEI_METRIC_CATALOG: Record<string, ReporteiMetricDef[]> = {
  facebook_ads: [
    { id: "fb_ads:spend", reference_key: "fb_ads:spend", component: "number_v1", metrics: ["spend"], label: "Investido (Facebook Ads)", format: "currency" },
    { id: "fb_ads:impressions", reference_key: "fb_ads:impressions", component: "number_v1", metrics: ["impressions"], label: "Impressões (Facebook Ads)", format: "number" },
    { id: "fb_ads:clicks", reference_key: "fb_ads:clicks", component: "number_v1", metrics: ["clicks"], label: "Cliques (Facebook Ads)", format: "number" },
    { id: "fb_ads:ctr", reference_key: "fb_ads:ctr", component: "number_v1", metrics: ["ctr"], label: "CTR (Facebook Ads)", format: "add_percentage" },
    { id: "fb_ads:cpc", reference_key: "fb_ads:cpc", component: "number_v1", metrics: ["cpc"], label: "CPC médio (Facebook Ads)", format: "currency" },
    { id: "fb_ads:reach", reference_key: "fb_ads:reach", component: "number_v1", metrics: ["reach"], label: "Alcance (Facebook Ads)", format: "number" },
  ],
  google_adwords: [
    { id: "gads:cost_micros", reference_key: "gads:cost_micros", component: "number_v1", metrics: ["metrics.cost_micros"], label: "Investido (Google Ads)", format: "currency" },
    { id: "gads:clicks", reference_key: "gads:clicks", component: "number_v1", metrics: ["metrics.clicks"], label: "Cliques (Google Ads)", format: "number" },
    { id: "gads:impressions", reference_key: "gads:impressions", component: "number_v1", metrics: ["metrics.impressions"], label: "Impressões (Google Ads)", format: "number" },
    { id: "gads:ctr", reference_key: "gads:ctr", component: "number_v1", metrics: ["metrics.ctr"], label: "CTR (Google Ads)", format: "percentage" },
    { id: "gads:conversions", reference_key: "gads:conversions", component: "number_v1", metrics: ["metrics.conversions"], label: "Conversões (Google Ads)", format: "number" },
    { id: "gads:average_cpc", reference_key: "gads:average_cpc", component: "number_v1", metrics: ["metrics.average_cpc"], label: "CPC médio (Google Ads)", format: "currency" },
  ],
  instagram_business: [
    { id: "ig:reach", reference_key: "ig:reach", component: "number_v1", metrics: ["reach"], label: "Alcance (Instagram)", format: "number" },
    { id: "ig:profile_views", reference_key: "ig:profile_views", component: "number_v1", metrics: ["profile_views"], label: "Visitas ao perfil (Instagram)", format: "number" },
    { id: "ig:views", reference_key: "ig:views", component: "number_v1", metrics: ["views"], type: "total_impressions", label: "Visualizações (Instagram)", format: "number" },
    { id: "ig:media_count", reference_key: "ig:media_count", component: "number_v1", metrics: ["count"], dimensions: ["media"], type: "total_posts_count", label: "Posts publicados (Instagram)", format: "number" },
    { id: "ig:like_count", reference_key: "ig:like_count", component: "number_v1", metrics: ["likes"], dimensions: ["media"], label: "Curtidas (Instagram)", format: "number" },
    { id: "ig:comments_count", reference_key: "ig:comments_count", component: "number_v1", metrics: ["comments"], dimensions: ["media"], type: ["total_comments"], label: "Comentários (Instagram)", format: "number" },
  ],
};

export function formatReporteiValue(raw: unknown, format: ReporteiMetricDef["format"]): string {
  const n = Number(raw);
  if (Number.isNaN(n)) return String(raw ?? "—");
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
    case "percentage":
      return (n * 100).toFixed(2) + "%";
    case "add_percentage":
      return n.toFixed(2) + "%";
    default:
      return n.toLocaleString("pt-BR");
  }
}
