import { Document, Page, View, Text, Image, StyleSheet, pdf } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 32, paddingBottom: 56, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  headerRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: 20, borderBottomWidth: 2, borderBottomColor: "#2563EB", paddingBottom: 14,
  },
  logo: { width: 48, height: 48, objectFit: "contain" },
  agencyName: { fontSize: 11, fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: 1 },
  title: { fontSize: 18, fontWeight: 700, marginTop: 6 },
  subtitle: { fontSize: 10, color: "#666", marginTop: 3 },
  statusBadge: { fontSize: 8, color: "#2563EB", marginTop: 6, textTransform: "uppercase" },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 18, marginBottom: 8, color: "#2563EB" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap" },
  metricBox: {
    width: "31%", marginRight: "3%", marginBottom: 8, borderWidth: 1, borderColor: "#e5e5e5",
    borderRadius: 6, padding: 10,
  },
  metricLabel: { fontSize: 7.5, color: "#888", textTransform: "uppercase" },
  metricValue: { fontSize: 14, fontWeight: 700, marginTop: 4, color: "#111" },
  paragraph: { fontSize: 10, lineHeight: 1.5, color: "#333" },
  footer: {
    position: "absolute", bottom: 24, left: 32, right: 32, flexDirection: "row",
    justifyContent: "space-between", fontSize: 8, color: "#999",
    borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 8,
  },
});

export type ReportPdfMetric = { label: string; value: string };

export type ReportPdfProps = {
  agencyName: string;
  agencyLogoUrl?: string | null;
  clientName: string;
  title: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  status: string;
  metrics: ReportPdfMetric[];
  summary?: string | null;
  notes?: string | null;
};

function fmtDate(d?: string | null) {
  if (!d) return null;
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

const statusLabels: Record<string, string> = { draft: "Rascunho", final: "Finalizado" };

export function ReportPDF(props: ReportPdfProps) {
  const period = props.periodStart || props.periodEnd
    ? `${fmtDate(props.periodStart) ?? "—"} a ${fmtDate(props.periodEnd) ?? "—"}`
    : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.agencyName}>{props.agencyName}</Text>
            <Text style={styles.title}>{props.title}</Text>
            <Text style={styles.subtitle}>{props.clientName}{period ? ` · ${period}` : ""}</Text>
            <Text style={styles.statusBadge}>{statusLabels[props.status] ?? props.status}</Text>
          </View>
          {props.agencyLogoUrl && <Image src={props.agencyLogoUrl} style={styles.logo} />}
        </View>

        {props.metrics.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Indicadores</Text>
            <View style={styles.metricsGrid}>
              {props.metrics.map((m, i) => (
                <View key={i} style={styles.metricBox}>
                  <Text style={styles.metricLabel}>{m.label}</Text>
                  <Text style={styles.metricValue}>{m.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {props.summary && (
          <View>
            <Text style={styles.sectionTitle}>Resumo</Text>
            <Text style={styles.paragraph}>{props.summary}</Text>
          </View>
        )}

        {props.notes && (
          <View>
            <Text style={styles.sectionTitle}>Observações</Text>
            <Text style={styles.paragraph}>{props.notes}</Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>Gerado por {props.agencyName} · Sistema Elo</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
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
