import { Document, Page, View, Text, StyleSheet, pdf } from "@react-pdf/renderer";
import { computeHighlights, groupMetricsByChannel, type ReportMetric } from "@/lib/report-summary";

const PAGE_PAD = 28;
const PRIMARY = "#2563EB";
const ACCENT = "#10B981";
const NAVY = "#111827";

const styles = StyleSheet.create({
  page: { fontSize: 8.5, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: {
    backgroundColor: NAVY, paddingHorizontal: PAGE_PAD, paddingVertical: 16,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
  },
  agencyName: { fontSize: 9, fontWeight: 700, color: "#93c5fd", textTransform: "uppercase", letterSpacing: 1 },
  agencySubtitle: { fontSize: 7, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 1 },
  reportTitle: { fontSize: 18, fontWeight: 700, color: "#fff", marginTop: 8 },
  reportPeriod: { fontSize: 8, color: "#d1d5db", marginTop: 3 },
  clientName: { fontSize: 15, fontWeight: 700, color: "#fff", textAlign: "right" },
  clientMeta: { fontSize: 7, color: "#9ca3af", textAlign: "right", marginTop: 3 },
  accentBar: { height: 3, flexDirection: "row" },
  accentHalf: { flex: 1 },

  section: { paddingHorizontal: PAGE_PAD, marginTop: 14 },
  sectionTitle: { fontSize: 10, fontWeight: 700, color: PRIMARY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },

  resumoRow: { flexDirection: "row" },
  glossaryBox: {
    width: "34%", backgroundColor: "#eef2ff", borderLeftWidth: 2, borderLeftColor: PRIMARY,
    padding: 10, marginRight: 12,
  },
  glossaryTitle: { fontSize: 8, fontWeight: 700, marginBottom: 5 },
  glossaryItem: { fontSize: 6.8, lineHeight: 1.4, marginBottom: 3, color: "#374151" },
  glossaryTerm: { fontWeight: 700, color: "#111827" },

  resumoCol: { flex: 1 },
  resumoTitle: { fontSize: 8, fontWeight: 700, marginBottom: 5 },
  resumoText: { fontSize: 8, lineHeight: 1.5, color: "#333" },

  highlightsRow: { flexDirection: "row", paddingHorizontal: PAGE_PAD, marginTop: 14 },
  highlightCard: { flex: 1, borderTopWidth: 2, paddingTop: 6, marginRight: 8 },
  highlightValue: { fontSize: 15, fontWeight: 700, color: "#111827" },
  highlightLabel: { fontSize: 6.8, color: "#6b7280", marginTop: 2, textTransform: "uppercase" },

  channelsRow: { flexDirection: "row", flexWrap: "wrap" },
  channelBox: { width: "48%", marginRight: "2%", marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 3, overflow: "hidden" },
  channelHeader: { paddingVertical: 6, paddingHorizontal: 10 },
  channelHeaderTitle: { fontSize: 8.5, fontWeight: 700, color: "#fff" },
  channelRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4.5, paddingHorizontal: 10 },
  channelRowAlt: { backgroundColor: "#f9fafb" },
  channelLabel: { fontSize: 7.5, color: "#4b5563" },
  channelValue: { fontSize: 7.5, fontWeight: 700, color: "#111827" },

  notesText: { fontSize: 8, lineHeight: 1.5, color: "#333" },

  footer: {
    position: "absolute", bottom: 16, left: PAGE_PAD, right: PAGE_PAD, flexDirection: "row",
    justifyContent: "space-between", fontSize: 6.8, color: "#9ca3af",
    borderTopWidth: 0.5, borderTopColor: "#e5e7eb", paddingTop: 6,
  },
});

const CHANNEL_COLORS = [PRIMARY, "#0891b2", ACCENT, "#7c3aed"];

const GLOSSARY: { term: string; text: string }[] = [
  { term: "Impressões:", text: " quantas vezes os anúncios apareceram na tela." },
  { term: "Alcance:", text: " quantas pessoas diferentes viram os anúncios." },
  { term: "Cliques:", text: " quantas vezes as pessoas clicaram no anúncio." },
  { term: "CTR:", text: " de cada 100 que viram, quantas clicaram." },
  { term: "CPC:", text: " quanto se pagou, em média, por clique." },
  { term: "Conversões:", text: " ação de valor concluída (contato, venda) após o clique." },
];

export type ReportPdfProps = {
  agencyName: string;
  clientName: string;
  title: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  status: string;
  metrics: ReportMetric[];
  summary?: string | null;
  notes?: string | null;
};

function fmtDate(d?: string | null) {
  if (!d) return null;
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

export function ReportPDF(props: ReportPdfProps) {
  const period = props.periodStart || props.periodEnd
    ? `${fmtDate(props.periodStart) ?? "—"} a ${fmtDate(props.periodEnd) ?? "—"}`
    : null;
  const highlights = computeHighlights(props.metrics);
  const channels = groupMetricsByChannel(props.metrics).filter((g) => g.items.length > 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.agencyName}>{props.agencyName}</Text>
            <Text style={styles.agencySubtitle}>Performance & Resultados</Text>
            <Text style={styles.reportTitle}>{props.title}</Text>
            {period && <Text style={styles.reportPeriod}>{period}</Text>}
          </View>
          <View>
            <Text style={styles.clientName}>{props.clientName}</Text>
            <Text style={styles.clientMeta}>valores em R$</Text>
          </View>
        </View>
        <View style={styles.accentBar}>
          <View style={[styles.accentHalf, { backgroundColor: PRIMARY }]} />
          <View style={[styles.accentHalf, { backgroundColor: ACCENT }]} />
        </View>

        {(props.summary || GLOSSARY.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resumo do período</Text>
            <View style={styles.resumoRow}>
              <View style={styles.glossaryBox}>
                <Text style={styles.glossaryTitle}>O que significa cada métrica?</Text>
                {GLOSSARY.map((g, i) => (
                  <Text key={i} style={styles.glossaryItem}>
                    <Text style={styles.glossaryTerm}>{g.term}</Text>
                    {g.text}
                  </Text>
                ))}
              </View>
              <View style={styles.resumoCol}>
                <Text style={styles.resumoText}>{props.summary || "—"}</Text>
              </View>
            </View>
          </View>
        )}

        {highlights.length > 0 && (
          <View style={styles.highlightsRow}>
            {highlights.map((h, i) => (
              <View key={i} style={[styles.highlightCard, { borderTopColor: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }]}>
                <Text style={styles.highlightValue}>{h.value}</Text>
                <Text style={styles.highlightLabel}>{h.label}</Text>
              </View>
            ))}
          </View>
        )}

        {channels.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detalhamento por canal</Text>
            <View style={styles.channelsRow}>
              {channels.map((ch, ci) => (
                <View key={ch.channel} style={styles.channelBox}>
                  <View style={[styles.channelHeader, { backgroundColor: CHANNEL_COLORS[ci % CHANNEL_COLORS.length] }]}>
                    <Text style={styles.channelHeaderTitle}>{ch.channel}</Text>
                  </View>
                  {ch.items.map((it, i) => (
                    <View key={i} style={i % 2 === 1 ? [styles.channelRow, styles.channelRowAlt] : styles.channelRow}>
                      <Text style={styles.channelLabel}>{it.label}</Text>
                      <Text style={styles.channelValue}>{it.value}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
        )}

        {props.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observações</Text>
            <Text style={styles.notesText}>{props.notes}</Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>{props.agencyName} · Relatório de Performance</Text>
          <Text render={({ pageNumber, totalPages }) => `página ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function downloadReportPdf(props: ReportPdfProps, filename: string) {
  const blob = await pdf(<ReportPDF {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
