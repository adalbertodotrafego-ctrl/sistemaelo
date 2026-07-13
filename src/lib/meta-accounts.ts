// Contas do Meta Ads monitoradas na seção "Meta Ads".
// Mapeamento fixo: nome do cliente (como a Elo se refere) -> conta de anúncio no Meta.
// Isso não contém segredos — o token de acesso fica só no servidor (META_ACCESS_TOKEN).
// Para adicionar/remover um cliente, basta editar esta lista.

export type MetaAccount = {
  /** Nome do cliente exibido no sistema */
  client: string;
  /** Nome da conta no Meta (referência) */
  accountName: string;
  /** ID numérico da conta de anúncio (sem o prefixo "act_") */
  accountId: string;
  /** Moeda da conta */
  currency: "BRL" | "USD";
};

export const META_ACCOUNTS: MetaAccount[] = [
  { client: "VPM", accountName: "VPM", accountId: "735903792791233", currency: "BRL" },
  { client: "Roller", accountName: "Roller Floripa", accountId: "1280882835946920", currency: "BRL" },
  { client: "Vicente", accountName: "Vicente Orige | RES.", accountId: "1003129572093681", currency: "BRL" },
  { client: "Gitá", accountName: "GITA RES.1", accountId: "1507363577605090", currency: "BRL" },
  { client: "Metronorte BR-101", accountName: "Metronorte BR-101", accountId: "5107031246060509", currency: "BRL" },
  { client: "Metronorte Ivo Silveira", accountName: "Metronorte Ivo Silveira - FLN Continente", accountId: "1245540332881307", currency: "BRL" },
  { client: "OffShox", accountName: "OffShox", accountId: "441551493131206", currency: "BRL" },
  { client: "Gracie Barra Peoria", accountName: "CA Gracie Barra Peoria", accountId: "1432274001233982", currency: "USD" },
  { client: "Estuda.com", accountName: "Grupo Estuda", accountId: "515246108686333", currency: "BRL" },
  { client: "Saladas Grill", accountName: "Saladas Grill", accountId: "446039922655275", currency: "BRL" },
  { client: "Belluno", accountName: "ADS BELLUNO MOVEIS", accountId: "418877553118587", currency: "BRL" },
  { client: "ACF Tecnologia", accountName: "CA. ACF Tecnologia", accountId: "1746535465926292", currency: "BRL" },
  { client: "Porto 1922", accountName: "Porto 1922", accountId: "373536504692253", currency: "BRL" },
  { client: "Espaço do Sorriso", accountName: "Espaço do Sorriso Ingleses", accountId: "651362898865407", currency: "BRL" },
];

// Tradução amigável dos objetivos de campanha do Meta.
export const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_SALES: "Vendas",
  OUTCOME_LEADS: "Leads",
  OUTCOME_AWARENESS: "Reconhecimento",
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_APP_PROMOTION: "Promoção de app",
  LINK_CLICKS: "Cliques no link",
  LEAD_GENERATION: "Geração de leads",
  CONVERSIONS: "Conversões",
  REACH: "Alcance",
  BRAND_AWARENESS: "Reconhecimento",
  MESSAGES: "Mensagens",
  VIDEO_VIEWS: "Visualizações de vídeo",
  POST_ENGAGEMENT: "Engajamento",
  PAGE_LIKES: "Curtidas na página",
};

export function objectiveLabel(objective?: string | null) {
  if (!objective) return "—";
  return OBJECTIVE_LABELS[objective] ?? objective.replace(/^OUTCOME_/, "").toLowerCase();
}
