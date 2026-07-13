// Gera resumo e observações automaticamente a partir da lista de indicadores
// do relatório — sempre com tom positivo (o cliente não precisa ler números
// ruins, só oportunidades e conquistas). Roda 100% no navegador, sem custo
// de API: é heurística sobre os rótulos/valores já preenchidos no relatório.

export type ReportMetric = { label: string; value: string };

type Parsed = {
  label: string;
  value: string;
  channel: string | null;
  kind: string | null;
  numeric: number | null;
  isPercent: boolean;
};

const KIND_PATTERNS: [RegExp, string][] = [
  [/custo por convers/i, "cost_per_conversion"],
  [/invest/i, "spend"],
  [/^cliques|cliques\s/i, "clicks"],
  [/ctr/i, "ctr"],
  [/^cpc|cpc\s|cpc médio/i, "cpc"],
  [/cpm/i, "cpm"],
  [/alcance/i, "reach"],
  [/impress/i, "impressions"],
  [/convers[ãa]o|convers[õo]es/i, "conversions"],
  [/lead/i, "leads"],
  [/receita/i, "revenue"],
  [/roas/i, "roas"],
  [/post/i, "posts"],
  [/segu(idor|ir)/i, "followers"],
  [/visita.*perfil/i, "profile_views"],
  [/visualiza/i, "views"],
  [/curtid/i, "likes"],
  [/coment/i, "comments"],
  [/venda/i, "sales"],
  [/conversa/i, "conversations"],
];

function detectKind(label: string): string | null {
  for (const [re, kind] of KIND_PATTERNS) if (re.test(label)) return kind;
  return null;
}

function extractChannel(label: string): string | null {
  const paren = label.match(/\(([^)]+)\)/);
  return paren ? paren[1].trim() : null;
}

// "R$ 1.350,47" -> 1350.47 · "2,41%" -> 2.41 · "1.799" -> 1799
function parseNumeric(value: string): number | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[R$\s%]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

function parseMetrics(metrics: ReportMetric[]): Parsed[] {
  return metrics.map((m) => ({
    label: m.label,
    value: m.value,
    channel: extractChannel(m.label),
    kind: detectKind(m.label),
    numeric: parseNumeric(m.value),
    isPercent: m.value.trim().endsWith("%"),
  }));
}

function groupByChannel(parsed: Parsed[]): Map<string, Parsed[]> {
  const groups = new Map<string, Parsed[]>();
  for (const p of parsed) {
    const key = p.channel ?? "Geral";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  return groups;
}

function findByKind(items: Parsed[], kind: string): Parsed | undefined {
  return items.find((i) => i.kind === kind);
}

function joinNatural(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(", ") + " e " + parts[parts.length - 1];
}

export function computeHighlights(metrics: ReportMetric[]): ReportMetric[] {
  const parsed = parseMetrics(metrics);
  const highlights: ReportMetric[] = [];

  const spendItems = parsed.filter((p) => p.kind === "spend" && p.numeric !== null);
  if (spendItems.length) {
    const total = spendItems.reduce((s, p) => s + (p.numeric ?? 0), 0);
    highlights.push({ label: "Investimento total", value: brl(total) });
  }
  const clickItems = parsed.filter((p) => p.kind === "clicks" && p.numeric !== null);
  if (clickItems.length) {
    const total = clickItems.reduce((s, p) => s + (p.numeric ?? 0), 0);
    highlights.push({ label: "Cliques totais", value: Math.round(total).toLocaleString("pt-BR") });
  }
  // Conversões/leads/vendas por canal entram individualmente — não dá pra somar
  // com significado entre canais diferentes sem confundir o cliente.
  const conversionLike = parsed.filter((p) => ["conversions", "leads", "sales", "conversations"].includes(p.kind ?? ""));
  for (const c of conversionLike.slice(0, 4 - highlights.length)) {
    highlights.push({ label: c.channel ? `${labelForKind(c.kind!)} (${c.channel})` : labelForKind(c.kind!), value: c.value });
  }
  // Preenche com o que sobrar até 4, priorizando alcance/impressões.
  if (highlights.length < 4) {
    const reach = parsed.filter((p) => p.kind === "reach" && p.numeric !== null);
    if (reach.length) {
      const total = reach.reduce((s, p) => s + (p.numeric ?? 0), 0);
      highlights.push({ label: "Alcance total", value: Math.round(total).toLocaleString("pt-BR") });
    }
  }
  return highlights.slice(0, 4);
}

function labelForKind(kind: string): string {
  const map: Record<string, string> = {
    conversions: "Conversões", leads: "Leads", sales: "Vendas", conversations: "Conversas",
  };
  return map[kind] ?? "Resultado";
}

function brl(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

const POSITIVE_CLOSINGS = [
  "Próximo foco: ampliar o investimento nos públicos e criativos que mais performaram, para escalar esses resultados.",
  "Próximo foco: testar novas variações de criativo para manter o engajamento em alta e captar ainda mais oportunidades.",
  "Próximo foco: refinar a segmentação para aproveitar ainda melhor o orçamento e acelerar os resultados já conquistados.",
  "Próximo foco: ativar novos formatos de anúncio para transformar o engajamento atual em ainda mais conversões.",
];

export function generateSummaryText(metrics: ReportMetric[]): string {
  const parsed = parseMetrics(metrics);
  if (parsed.length === 0) return "";
  const groups = groupByChannel(parsed);
  const sentences: string[] = [];

  for (const [channel, items] of groups) {
    const spend = findByKind(items, "spend");
    const reach = findByKind(items, "reach");
    const clicks = findByKind(items, "clicks");
    const ctr = findByKind(items, "ctr");
    const cpc = findByKind(items, "cpc");
    const conv = findByKind(items, "conversions") ?? findByKind(items, "leads") ?? findByKind(items, "sales") ?? findByKind(items, "conversations");

    const parts: string[] = [];
    if (reach) parts.push(`alcançou ${reach.value} pessoas`);
    if (clicks) parts.push(`gerou ${clicks.value} cliques`);
    if (ctr) parts.push(`CTR de ${ctr.value}`);
    if (cpc) parts.push(`CPC de ${cpc.value}`);
    if (conv) parts.push(`${conv.value} ${labelForKind(conv.kind!).toLowerCase()}`);

    if (parts.length === 0) continue;

    const opening = channel === "Geral"
      ? "No geral, a operação"
      : `O ${channel}`;
    const investPart = spend ? ` com investimento de ${spend.value}` : "";
    sentences.push(`${opening} entregou bons resultados${investPart}: ${joinNatural(parts)}.`);
  }

  if (sentences.length === 0) {
    // Sem indicadores classificáveis — ainda assim gera algo positivo e genérico.
    return "O período apresentou avanços consistentes nas frentes acompanhadas, com sinais positivos de engajamento do público com a marca.";
  }

  const closing = POSITIVE_CLOSINGS[Math.abs(hashCode(metrics.map((m) => m.label).join())) % POSITIVE_CLOSINGS.length];
  return sentences.join(" ") + " " + closing;
}

const POSITIVE_NOTES_POOL = [
  "Os resultados deste período mostram uma base sólida para continuar investindo — os públicos que mais engajaram indicam onde escalar com segurança.",
  "O comportamento do público segue favorável, o que abre espaço para testar novos criativos e formatos sem perder a eficiência já conquistada.",
  "A performance no período reforça que a estratégia atual está no caminho certo — o próximo passo é ampliar o alcance mantendo essa qualidade.",
  "Os dados indicam boa receptividade do público-alvo, sinal de que vale a pena reforçar o investimento nos formatos que mais se destacaram.",
];

export function generateNotesText(metrics: ReportMetric[]): string {
  const parsed = parseMetrics(metrics);
  const base = POSITIVE_NOTES_POOL[Math.abs(hashCode(metrics.map((m) => m.value).join())) % POSITIVE_NOTES_POOL.length];

  const extras: string[] = [];
  const hasCtr = parsed.some((p) => p.kind === "ctr");
  const hasConv = parsed.some((p) => ["conversions", "leads", "sales"].includes(p.kind ?? ""));
  const hasReach = parsed.some((p) => p.kind === "reach");

  if (hasCtr) extras.push("O CTR observado mostra que os criativos estão despertando interesse real do público.");
  if (hasConv) extras.push("As conversões no período confirmam que a jornada do clique até a ação está funcionando bem.");
  if (hasReach && !hasConv) extras.push("O alcance conquistado é uma ótima base para converter ainda mais nas próximas semanas.");

  return [base, ...extras.slice(0, 1)].join(" ");
}

// Hash simples e determinístico só pra variar a escolha do fechamento sem
// repetir sempre a mesma frase — não precisa ser criptográfico.
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

export function groupMetricsByChannel(metrics: ReportMetric[]): { channel: string; items: ReportMetric[] }[] {
  const parsed = parseMetrics(metrics);
  const groups = groupByChannel(parsed);
  return Array.from(groups.entries()).map(([channel, items]) => ({
    channel,
    items: items.map((i) => ({ label: stripChannelSuffix(i.label), value: i.value })),
  }));
}

function stripChannelSuffix(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s*—.*$/, "").trim();
}
