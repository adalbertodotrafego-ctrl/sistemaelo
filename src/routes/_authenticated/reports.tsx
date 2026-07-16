import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BarChart3, Users, FolderKanban, ListChecks, DollarSign, Target, Download,
  FileBarChart, Plus, Sparkles, Pencil, Trash2, MoreVertical, Eye, Printer, X,
  Link2, FileDown, Loader2, Wand2, CalendarRange, FolderPlus, Folder, FolderInput,
  CheckSquare, Square, FolderX,
} from "lucide-react";
import { brl, shortDate } from "@/lib/format";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-auth";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { listReporteiProjects, linkClientToReportei, getReporteiIndicators } from "@/lib/reportei.functions";
import { suggestReporteiProject } from "@/lib/reportei-metrics";
import { generateSummaryText, generateNotesText } from "@/lib/report-summary";

// O gerador de PDF (react-pdf + fontes) pesa ~1,5MB — só baixa quando alguém
// realmente clica em gerar/baixar um PDF, não ao abrir a página de Relatórios.
const loadPdf = () => import("@/components/report-pdf");

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Relatórios — Elo Marketing OS" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Crescimento"
        title="Relatórios"
        description="Visão consolidada da operação e relatórios por cliente, prontos para enviar."
      />
      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="client-reports">Relatórios de clientes</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-0"><OverviewTab /></TabsContent>
        <TabsContent value="client-reports" className="mt-0"><ClientReportsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

const COLORS = ["#2563EB", "#7C3AED", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"];

function OverviewTab() {
  const { data } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const [clients, projects, tasks, finance, campaigns, goals] = await Promise.all([
        supabase.from("clients").select("id, status"),
        supabase.from("projects").select("id, status, priority"),
        supabase.from("tasks").select("id, status, priority"),
        supabase.from("finance_entries").select("kind, amount, due_date"),
        supabase.from("campaigns").select("channel, invested, leads, roas"),
        supabase.from("goals").select("title, target, progress"),
      ]);
      return {
        clients: clients.data ?? [], projects: projects.data ?? [], tasks: tasks.data ?? [],
        finance: finance.data ?? [], campaigns: campaigns.data ?? [], goals: goals.data ?? [],
      };
    },
  });

  if (!data) return null;

  const income = data.finance.filter((f: any) => f.kind === "income").reduce((s: number, f: any) => s + Number(f.amount), 0);
  const expense = data.finance.filter((f: any) => f.kind === "expense").reduce((s: number, f: any) => s + Number(f.amount), 0);
  const tasksByStatus = ["todo", "in_progress", "in_review", "done"].map(s => ({
    name: s, value: data.tasks.filter(t => t.status === s).length,
  }));
  const investedByChannel = Object.entries(
    data.campaigns.reduce((acc: Record<string, number>, c) => {
      acc[c.channel] = (acc[c.channel] ?? 0) + Number(c.invested ?? 0); return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const exportCSV = () => {
    const rows = [
      ["Métrica", "Valor"],
      ["Clientes", data.clients.length],
      ["Projetos", data.projects.length],
      ["Tarefas", data.tasks.length],
      ["Receita", income],
      ["Despesa", expense],
      ["Lucro", income - expense],
      ["Campanhas ativas", data.campaigns.length],
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={exportCSV} variant="outline"><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Clientes" value={data.clients.length} icon={Users} />
        <StatCard label="Projetos" value={data.projects.length} icon={FolderKanban} accent="primary" />
        <StatCard label="Tarefas" value={data.tasks.length} icon={ListChecks} accent="warning" />
        <StatCard label="Lucro" value={brl(income - expense)} icon={DollarSign} accent="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-5">
          <h3 className="mb-4 font-display text-base font-semibold">Tarefas por status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tasksByStatus}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--surface-2))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card p-5">
          <h3 className="mb-4 font-display text-base font-semibold">Investimento por canal</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={investedByChannel} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                  {investedByChannel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--surface-2))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any) => brl(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card p-5 lg:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold"><Target className="h-4 w-4 text-primary" />Progresso das metas</h3>
          {data.goals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {data.goals.map((g: any, i: number) => {
                const pct = g.target > 0 ? Math.min(100, (Number(g.progress) / Number(g.target)) * 100) : 0;
                return (
                  <div key={i}>
                    <div className="mb-1 flex justify-between text-xs"><span>{g.title}</span><span className="text-muted-foreground">{pct.toFixed(0)}%</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="surface-card p-5 lg:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold"><BarChart3 className="h-4 w-4 text-primary" />Resumo financeiro</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><div className="text-xs uppercase tracking-wider text-muted-foreground">Receita</div><div className="mt-1 font-display text-xl font-semibold text-emerald-400">{brl(income)}</div></div>
            <div><div className="text-xs uppercase tracking-wider text-muted-foreground">Despesa</div><div className="mt-1 font-display text-xl font-semibold text-red-400">{brl(expense)}</div></div>
            <div><div className="text-xs uppercase tracking-wider text-muted-foreground">Lucro</div><div className="mt-1 font-display text-xl font-semibold text-primary">{brl(income - expense)}</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

type Metric = { label: string; value: string };
const emptyReportForm = { client_id: "", title: "", period_start: "", period_end: "", status: "draft", summary: "", notes: "" };
const statusLabels: Record<string, string> = { draft: "Rascunho", final: "Finalizado" };

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// Última semana COMPLETA, de segunda a domingo (a semana que já encerrou).
function lastCompleteWeek(): { start: string; end: string } {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // 0 = segunda … 6 = domingo
  const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
  const start = new Date(thisMonday); start.setDate(thisMonday.getDate() - 7);
  const end = new Date(thisMonday); end.setDate(thisMonday.getDate() - 1);
  return { start: isoDate(start), end: isoDate(end) };
}
// Mês passado completo (dia 1 ao último dia).
function lastCompleteMonth(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start: isoDate(start), end: isoDate(end) };
}
function periodTitle(type: "weekly" | "monthly", start: string, end: string): string {
  if (type === "monthly") {
    const d = new Date(start + "T00:00:00");
    return `${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`;
  }
  return `semana de ${shortDate(start)} a ${shortDate(end)}`;
}

function ClientReportsTab() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const listReporteiProjectsFn = useServerFn(listReporteiProjects);
  const linkClientToReporteiFn = useServerFn(linkClientToReportei);
  const getReporteiIndicatorsFn = useServerFn(getReporteiIndicators);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyReportForm);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [autoFilling, setAutoFilling] = useState(false);
  const [pullingReportei, setPullingReportei] = useState(false);
  const [lastPull, setLastPull] = useState<{ at: string; start: string; end: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [viewTarget, setViewTarget] = useState<any>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Pastas, seleção em massa e geração automática
  const [activeFolder, setActiveFolder] = useState<string>("all"); // "all" | "none" | folderId
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<any>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [genType, setGenType] = useState<"weekly" | "monthly">("weekly");
  const [genClientIds, setGenClientIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 });

  const { data: reports } = useQuery({
    queryKey: ["client_reports"],
    queryFn: async () =>
      (await (supabase as any).from("client_reports").select("*, clients(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });
  const { data: clientsReportei } = useQuery({
    queryKey: ["clients-reportei-link"],
    queryFn: async () => (await (supabase as any).from("clients").select("id, reportei_project_id")).data ?? [],
  });
  const { data: reporteiProjects } = useQuery({
    queryKey: ["reportei-projects"],
    enabled: open,
    queryFn: async () => (await listReporteiProjectsFn()).projects ?? [],
  });
  const { data: agencySettings } = useQuery({
    queryKey: ["agency-settings"],
    queryFn: async () => (await supabase.from("agency_settings").select("*").limit(1).maybeSingle()).data,
  });
  const { data: folders } = useQuery({
    queryKey: ["report-folders"],
    queryFn: async () => (await (supabase as any).from("report_folders").select("*").order("created_at")).data ?? [],
  });

  // Relatórios visíveis conforme a pasta selecionada no topo.
  const visibleReports = (reports ?? []).filter((r: any) =>
    activeFolder === "all" ? true : activeFolder === "none" ? !r.folder_id : r.folder_id === activeFolder,
  );
  const countInFolder = (folderId: string | "none") =>
    (reports ?? []).filter((r: any) => (folderId === "none" ? !r.folder_id : r.folder_id === folderId)).length;
  const allVisibleSelected = visibleReports.length > 0 && visibleReports.every((r: any) => selectedIds.has(r.id));

  // Trocar de pasta limpa a seleção — senão "Excluir selecionados" poderia apagar
  // relatórios que ficaram marcados mas não estão mais visíveis na tela.
  const selectFolder = (id: string) => {
    setActiveFolder(id);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const toggleSelectAllVisible = () =>
    setSelectedIds((prev) => {
      if (visibleReports.every((r: any) => prev.has(r.id))) return new Set();
      return new Set(visibleReports.map((r: any) => r.id));
    });

  const currentReporteiProjectId = clientsReportei?.find((c: any) => c.id === form.client_id)?.reportei_project_id ?? null;
  const selectedClientName = clients?.find((c: any) => c.id === form.client_id)?.name ?? "";
  const suggestedProject = !currentReporteiProjectId && selectedClientName && reporteiProjects
    ? suggestReporteiProject(selectedClientName, reporteiProjects)
    : null;

  const linkReportei = useMutation({
    mutationFn: async (reporteiProjectId: number | null) => {
      if (!form.client_id) throw new Error("Selecione um cliente primeiro");
      await linkClientToReporteiFn({ data: { clientId: form.client_id, reporteiProjectId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients-reportei-link"] });
      toast.success("Vínculo com o Reportei salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyReportForm);
    setMetrics([]);
    setLastPull(null);
    setOpen(true);
  };

  const openEdit = (r: any) => {
    setEditingId(r.id);
    setLastPull(null);
    setForm({
      client_id: r.client_id ?? "", title: r.title ?? "",
      period_start: r.period_start ?? "", period_end: r.period_end ?? "",
      status: r.status ?? "draft", summary: r.summary ?? "", notes: r.notes ?? "",
    });
    setMetrics(Array.isArray(r.metrics) ? r.metrics : []);
    setOpen(true);
  };

  const addMetric = () => setMetrics((m) => [...m, { label: "", value: "" }]);
  const updateMetric = (i: number, patch: Partial<Metric>) =>
    setMetrics((m) => m.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const removeMetric = (i: number) => setMetrics((m) => m.filter((_, idx) => idx !== i));

  const autofill = async () => {
    if (!form.client_id) return toast.error("Selecione um cliente primeiro");
    setAutoFilling(true);
    try {
      const from = form.period_start || "1900-01-01";
      const to = form.period_end || "2999-12-31";
      const [camp, fin, social] = await Promise.all([
        (supabase as any).from("campaigns").select("invested, leads, roas, ctr").eq("client_id", form.client_id),
        (supabase as any).from("finance_entries").select("amount").eq("client_id", form.client_id).eq("kind", "income")
          .gte("paid_at", from).lte("paid_at", to),
        (supabase as any).from("social_posts").select("id", { count: "exact", head: true })
          .eq("client_id", form.client_id).eq("status", "published"),
      ]);
      const campaigns = camp.data ?? [];
      const invested = campaigns.reduce((s: number, c: any) => s + Number(c.invested || 0), 0);
      const leads = campaigns.reduce((s: number, c: any) => s + Number(c.leads || 0), 0);
      const avgRoas = campaigns.length ? campaigns.reduce((s: number, c: any) => s + Number(c.roas || 0), 0) / campaigns.length : 0;
      const avgCtr = campaigns.length ? campaigns.reduce((s: number, c: any) => s + Number(c.ctr || 0), 0) / campaigns.length : 0;
      const income = (fin.data ?? []).reduce((s: number, f: any) => s + Number(f.amount || 0), 0);
      setMetrics((prev) => {
        const internalLabels = new Set(["Investido em anúncios", "Leads gerados", "ROAS médio", "CTR médio", "Receita no período", "Posts publicados"]);
        return [
          ...prev.filter((m) => !internalLabels.has(m.label)),
          { label: "Investido em anúncios", value: brl(invested) },
          { label: "Leads gerados", value: String(leads) },
          { label: "ROAS médio", value: avgRoas.toFixed(2) + "x" },
          { label: "CTR médio", value: avgCtr.toFixed(2) + "%" },
          { label: "Receita no período", value: brl(income) },
          { label: "Posts publicados", value: String(social.count ?? 0) },
        ];
      });
      toast.success("Dados internos preenchidos — revise e edite à vontade antes de salvar.");
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível puxar os dados");
    } finally {
      setAutoFilling(false);
    }
  };

  const pullFromReportei = async () => {
    if (!form.client_id) return toast.error("Selecione um cliente primeiro");
    if (!currentReporteiProjectId) return toast.error("Vincule este cliente a um projeto do Reportei primeiro");
    setPullingReportei(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const res = await getReporteiIndicatorsFn({
        data: { reporteiProjectId: currentReporteiProjectId, start: form.period_start || monthAgo, end: form.period_end || today },
      });
      const pulled = (res.indicators ?? []).filter((i: any) => !i.error);
      const failed = (res.indicators ?? []).filter((i: any) => i.error);
      const pulledLabels = new Set(pulled.map((i: any) => i.label));
      setMetrics((prev) => [
        ...prev.filter((m) => !pulledLabels.has(m.label)),
        ...pulled.map((i: any) => ({ label: i.label, value: i.value })),
      ]);
      setLastPull({ at: res.fetchedAt ?? new Date().toISOString(), start: res.start ?? "", end: res.end ?? "" });
      if (pulled.length === 0) toast.error("Nenhum indicador retornou dados para esse período.");
      else toast.success(`${pulled.length} indicador(es) puxados do Reportei, ao vivo${failed.length ? ` (${failed.length} falharam)` : ""}.`);
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível puxar do Reportei");
    } finally {
      setPullingReportei(false);
    }
  };

  const downloadPdf = async (report: any) => {
    if (!report) return;
    setDownloadingPdf(true);
    try {
      const { downloadReportPdf } = await loadPdf();
      await downloadReportPdf(
        {
          agencyName: agencySettings?.name || "Elo Marketing",
          clientName: report.clients?.name ?? "Cliente",
          title: report.title,
          periodStart: report.period_start,
          periodEnd: report.period_end,
          status: report.status,
          metrics: Array.isArray(report.metrics) ? report.metrics : [],
          summary: report.summary,
          notes: report.notes,
        },
        `relatorio-${(report.clients?.name ?? "cliente").toLowerCase().replace(/\s+/g, "-")}-${report.id.slice(0, 8)}.pdf`,
      );
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível gerar o PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        ...form,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        metrics: metrics.filter((m) => m.label.trim() || m.value.trim()),
      };
      if (editingId) {
        const { error } = await (supabase as any).from("client_reports").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("client_reports").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_reports"] });
      setOpen(false); setEditingId(null); setForm(emptyReportForm); setMetrics([]);
      toast.success(editingId ? "Relatório atualizado!" : "Relatório criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("client_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_reports"] });
      setDeleteTarget(null);
      toast.success("Relatório excluído!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Pastas ----
  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await (supabase as any).from("report_folders").insert({ name: name.trim(), created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-folders"] });
      setNewFolderName(""); setFolderDialogOpen(false);
      toast.success("Pasta criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("report_folders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["report-folders"] });
      qc.invalidateQueries({ queryKey: ["client_reports"] });
      if (activeFolder === id) setActiveFolder("all");
      setDeleteFolderTarget(null);
      toast.success("Pasta excluída — os relatórios foram mantidos em 'Sem pasta'.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Ações em massa ----
  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await (supabase as any).from("client_reports").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_reports"] });
      setSelectedIds(new Set()); setBulkDeleteOpen(false);
      toast.success("Relatórios excluídos!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveReports = useMutation({
    mutationFn: async ({ ids, folderId }: { ids: string[]; folderId: string | null }) => {
      const { error } = await (supabase as any).from("client_reports").update({ folder_id: folderId }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_reports"] });
      setSelectedIds(new Set());
      toast.success("Relatórios movidos!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Geração automática (semanal / mensal) ----
  const openGenerate = (type: "weekly" | "monthly") => {
    setGenType(type);
    setGenClientIds(new Set((clients ?? []).map((c: any) => c.id)));
    setGenProgress({ done: 0, total: 0 });
    setGenOpen(true);
  };

  // Dados internos (campanhas/financeiro/social) — usados como fallback quando o
  // cliente não está vinculado ao Reportei ou o Reportei não retorna nada.
  const internalMetrics = async (clientId: string, from: string, to: string): Promise<Metric[]> => {
    const [camp, fin, social] = await Promise.all([
      (supabase as any).from("campaigns").select("invested, leads, roas, ctr").eq("client_id", clientId),
      (supabase as any).from("finance_entries").select("amount").eq("client_id", clientId).eq("kind", "income").gte("paid_at", from).lte("paid_at", to),
      (supabase as any).from("social_posts").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "published"),
    ]);
    const campaigns = camp.data ?? [];
    const invested = campaigns.reduce((s: number, c: any) => s + Number(c.invested || 0), 0);
    const leads = campaigns.reduce((s: number, c: any) => s + Number(c.leads || 0), 0);
    const avgRoas = campaigns.length ? campaigns.reduce((s: number, c: any) => s + Number(c.roas || 0), 0) / campaigns.length : 0;
    const avgCtr = campaigns.length ? campaigns.reduce((s: number, c: any) => s + Number(c.ctr || 0), 0) / campaigns.length : 0;
    const income = (fin.data ?? []).reduce((s: number, f: any) => s + Number(f.amount || 0), 0);
    const out: Metric[] = [];
    if (invested) out.push({ label: "Investido em anúncios", value: brl(invested) });
    if (leads) out.push({ label: "Leads gerados", value: String(leads) });
    if (avgRoas) out.push({ label: "ROAS médio", value: avgRoas.toFixed(2) + "x" });
    if (avgCtr) out.push({ label: "CTR médio", value: avgCtr.toFixed(2) + "%" });
    if (income) out.push({ label: "Receita no período", value: brl(income) });
    if (social.count) out.push({ label: "Posts publicados", value: String(social.count) });
    return out;
  };

  const runGeneration = async () => {
    const ids = Array.from(genClientIds);
    if (ids.length === 0) return toast.error("Selecione ao menos um cliente");
    const { downloadReportPdf } = await loadPdf();
    const { start, end } = genType === "weekly" ? lastCompleteWeek() : lastCompleteMonth();
    const agencyName = agencySettings?.name || "Elo Marketing";
    const targetFolder = activeFolder !== "all" && activeFolder !== "none" ? activeFolder : null;
    setGenerating(true);
    setGenProgress({ done: 0, total: ids.length });
    let ok = 0, empty = 0, failed = 0;
    for (const clientId of ids) {
      const client = clients?.find((c: any) => c.id === clientId);
      const name = client?.name ?? "Cliente";
      const projectId = clientsReportei?.find((c: any) => c.id === clientId)?.reportei_project_id ?? null;
      try {
        let m: Metric[] = [];
        if (projectId) {
          // Reportei fora do ar não derruba o cliente — cai nos dados internos abaixo.
          try {
            const res = await getReporteiIndicatorsFn({ data: { reporteiProjectId: projectId, start, end } });
            m = (res.indicators ?? []).filter((i: any) => !i.error).map((i: any) => ({ label: i.label, value: i.value }));
          } catch {
            m = [];
          }
        }
        if (m.length === 0) m = await internalMetrics(clientId, start, end);
        if (m.length === 0) { empty++; setGenProgress((p) => ({ ...p, done: p.done + 1 })); continue; }

        const summary = generateSummaryText(m);
        const notes = generateNotesText(m);
        const title = `Relatório ${genType === "weekly" ? "semanal" : "mensal"} — ${name} · ${periodTitle(genType, start, end)}`;
        const { error } = await (supabase as any).from("client_reports").insert({
          client_id: clientId, title, period_start: start, period_end: end,
          status: "final", summary, notes, metrics: m, created_by: user?.id, folder_id: targetFolder,
        });
        if (error) throw error;

        await downloadReportPdf(
          { agencyName, clientName: name, title, periodStart: start, periodEnd: end, status: "final", metrics: m, summary, notes },
          `relatorio-${genType === "weekly" ? "semanal" : "mensal"}-${name.toLowerCase().replace(/\s+/g, "-")}-${start}.pdf`,
        );
        ok++;
        // Pequena pausa pra o navegador não bloquear os downloads múltiplos em sequência.
        await new Promise((r) => setTimeout(r, 450));
      } catch {
        failed++;
      }
      setGenProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setGenerating(false);
    setGenOpen(false);
    qc.invalidateQueries({ queryKey: ["client_reports"] });
    toast.success(`${ok} relatório(s) gerado(s)${empty ? `, ${empty} sem dados no período` : ""}${failed ? `, ${failed} com erro` : ""}.`);
  };

  const toggleGenClient = (id: string) =>
    setGenClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={() => openGenerate("weekly")}>
          <CalendarRange className="mr-2 h-4 w-4" />Gerar semanal
        </Button>
        <Button variant="outline" onClick={() => openGenerate("monthly")}>
          <CalendarRange className="mr-2 h-4 w-4" />Gerar mensal
        </Button>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyReportForm); setMetrics([]); } }}>
          <DialogTrigger asChild><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo relatório</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Editar relatório" : "Novo relatório"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cliente *</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{(clients ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Rascunho</SelectItem>
                      <SelectItem value="final">Finalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.client_id && (
                <div className="space-y-2 rounded-lg border border-border/60 bg-surface-2/30 p-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                      {currentReporteiProjectId ? (
                        <>Vinculado ao Reportei: <strong className="text-foreground">{reporteiProjects?.find((p: any) => p.id === currentReporteiProjectId)?.name ?? `#${currentReporteiProjectId}`}</strong></>
                      ) : !reporteiProjects ? "Carregando projetos do Reportei…"
                      : "Ainda não vinculado a um projeto do Reportei"}
                    </div>
                    <Select
                      value={currentReporteiProjectId ? String(currentReporteiProjectId) : ""}
                      onValueChange={(v) => linkReportei.mutate(Number(v))}
                    >
                      <SelectTrigger className="w-44 shrink-0"><SelectValue placeholder="Vincular manualmente…" /></SelectTrigger>
                      <SelectContent>{(reporteiProjects ?? []).map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {suggestedProject && (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                      <span>Sugestão: <strong>{suggestedProject.name}</strong> parece ser este cliente no Reportei</span>
                      <Button type="button" size="sm" variant="outline" className="h-7 shrink-0" onClick={() => linkReportei.mutate(suggestedProject.id)}>
                        Vincular
                      </Button>
                    </div>
                  )}
                  {!currentReporteiProjectId && !suggestedProject && reporteiProjects && (
                    <p className="text-[11px] text-muted-foreground">
                      Nenhum projeto com nome parecido foi encontrado no Reportei — ou esse cliente ainda não tem projeto lá, ou o nome é bem diferente. Escolha manualmente na lista acima, se houver.
                    </p>
                  )}
                </div>
              )}

              <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Relatório de julho — Saladas Grill" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Período — início</Label><Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></div>
                <div><Label>Período — fim</Label><Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></div>
              </div>

              {lastPull && (
                <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-300">
                  <Sparkles className="h-3 w-3" />
                  Puxado do Reportei ao vivo às {new Date(lastPull.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  {lastPull.start && lastPull.end ? ` · período ${shortDate(lastPull.start)} → ${shortDate(lastPull.end)}` : ""}
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <Label className="mb-0">Indicadores</Label>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={autofill} disabled={autoFilling}>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />{autoFilling ? "Puxando…" : "Dados internos"}
                  </Button>
                  <Button
                    type="button" size="sm" variant="outline" onClick={pullFromReportei}
                    disabled={pullingReportei || !currentReporteiProjectId}
                    title={!currentReporteiProjectId ? "Vincule este cliente a um projeto do Reportei acima primeiro" : undefined}
                  >
                    {pullingReportei ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                    {pullingReportei ? "Puxando…" : "Puxar do Reportei"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={addMetric}><Plus className="mr-1.5 h-3.5 w-3.5" />Indicador</Button>
                </div>
              </div>
              {metrics.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/50 p-4 text-center text-xs text-muted-foreground">
                  Sem indicadores ainda. Clique em "Preencher automaticamente" ou adicione manualmente.
                </p>
              ) : (
                <div className="space-y-2">
                  {metrics.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input placeholder="Indicador (ex: Leads gerados)" value={m.label} onChange={(e) => updateMetric(i, { label: e.target.value })} className="flex-1" />
                      <Input placeholder="Valor" value={m.value} onChange={(e) => updateMetric(i, { value: e.target.value })} className="w-32" />
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeMetric(i)}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <Label className="mb-0">Resumo</Label>
                  <Button
                    type="button" size="sm" variant="outline" className="h-7"
                    disabled={metrics.length === 0}
                    onClick={() => setForm((f) => ({ ...f, summary: generateSummaryText(metrics) }))}
                  >
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" />Gerar automaticamente
                  </Button>
                </div>
                <Textarea rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Destaques do período, o que funcionou, próximos passos…" className="mt-1" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="mb-0">Observações</Label>
                  <Button
                    type="button" size="sm" variant="outline" className="h-7"
                    disabled={metrics.length === 0}
                    onClick={() => setForm((f) => ({ ...f, notes: generateNotesText(metrics) }))}
                  >
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" />Gerar automaticamente
                  </Button>
                </div>
                <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => save.mutate()} disabled={!form.client_id || !form.title || save.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Barra de pastas */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FolderChip active={activeFolder === "all"} onClick={() => selectFolder("all")} label={`Todos (${reports?.length ?? 0})`} />
        <FolderChip active={activeFolder === "none"} icon={Folder} onClick={() => selectFolder("none")} label={`Sem pasta (${countInFolder("none")})`} />
        {(folders ?? []).map((f: any) => (
          <div key={f.id} className="group/folder relative flex items-center">
            <FolderChip
              active={activeFolder === f.id}
              icon={Folder}
              onClick={() => selectFolder(f.id)}
              label={`${f.name} (${countInFolder(f.id)})`}
            />
            <button
              onClick={() => setDeleteFolderTarget(f)}
              title="Excluir pasta"
              className="ml-1 rounded p-0.5 text-muted-foreground opacity-0 transition hover:text-destructive group-hover/folder:opacity-100"
            >
              <FolderX className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <Button variant="ghost" size="sm" className="h-8" onClick={() => setFolderDialogOpen(true)}>
          <FolderPlus className="mr-1.5 h-4 w-4" />Nova pasta
        </Button>
      </div>

      {/* Barra de seleção em massa */}
      {visibleReports.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button onClick={toggleSelectAllVisible} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            {allVisibleSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
            Selecionar tudo
          </button>
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground">{selectedIds.size} selecionado(s)</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8"><FolderInput className="mr-1.5 h-3.5 w-3.5" />Mover para…</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => moveReports.mutate({ ids: Array.from(selectedIds), folderId: null })}>
                    <Folder className="mr-2 h-3.5 w-3.5" />Sem pasta
                  </DropdownMenuItem>
                  {(folders ?? []).map((f: any) => (
                    <DropdownMenuItem key={f.id} onClick={() => moveReports.mutate({ ids: Array.from(selectedIds), folderId: f.id })}>
                      <Folder className="mr-2 h-3.5 w-3.5" />{f.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="destructive" className="h-8" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir selecionados
              </Button>
            </>
          )}
        </div>
      )}

      {visibleReports.length === 0 ? (
        <EmptyState icon={FileBarChart} title={activeFolder === "all" ? "Nenhum relatório ainda" : "Pasta vazia"} description={activeFolder === "all" ? "Crie o primeiro relatório para um cliente — puxe os dados automaticamente ou gere semanal/mensal." : "Nenhum relatório nesta pasta. Mova relatórios para cá pelo menu de cada card."} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleReports.map((r: any) => {
            const checked = selectedIds.has(r.id);
            return (
            <div key={r.id} className={"surface-card group relative p-5 " + (checked ? "ring-2 ring-primary/50" : "")}>
              <button
                onClick={() => toggleSelect(r.id)}
                className="absolute left-3 top-3 text-muted-foreground hover:text-primary"
                title="Selecionar"
              >
                {checked ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 opacity-0 group-hover:opacity-100" />}
              </button>
              <div className="absolute right-3 top-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setViewTarget(r)}><Eye className="mr-2 h-3.5 w-3.5" />Visualizar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEdit(r)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => downloadPdf(r)}><FileDown className="mr-2 h-3.5 w-3.5" />Baixar PDF</DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger><FolderInput className="mr-2 h-3.5 w-3.5" />Mover para pasta</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => moveReports.mutate({ ids: [r.id], folderId: null })}>
                          <Folder className="mr-2 h-3.5 w-3.5" />Sem pasta
                        </DropdownMenuItem>
                        {(folders ?? []).map((f: any) => (
                          <DropdownMenuItem key={f.id} onClick={() => moveReports.mutate({ ids: [r.id], folderId: f.id })}>
                            <Folder className="mr-2 h-3.5 w-3.5" />{f.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem onClick={() => setDeleteTarget(r)} className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mb-3 flex items-start justify-between gap-3 px-6">
                <div>
                  <h3 className="font-display text-base font-semibold">{r.title}</h3>
                  <div className="mt-1 text-xs text-muted-foreground">{r.clients?.name ?? "Sem cliente"}</div>
                </div>
                <Badge variant={r.status === "final" ? "default" : "outline"}>{statusLabels[r.status] ?? r.status}</Badge>
              </div>
              {(r.period_start || r.period_end) && (
                <div className="mb-2 text-[11px] text-muted-foreground">{shortDate(r.period_start)} → {shortDate(r.period_end)}</div>
              )}
              {Array.isArray(r.metrics) && r.metrics.length > 0 && (
                <div className="grid grid-cols-3 gap-2 border-t border-border/50 pt-3 text-center">
                  {r.metrics.slice(0, 3).map((m: Metric, i: number) => (
                    <div key={i}>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{m.label}</div>
                      <div className="font-display text-sm font-semibold">{m.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* Visualizar relatório */}
      <Dialog open={!!viewTarget} onOpenChange={(v) => !v && setViewTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <div id="report-print-area">
            <DialogHeader>
              <DialogTitle>{viewTarget?.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{viewTarget?.clients?.name}</span>
                {(viewTarget?.period_start || viewTarget?.period_end) && (
                  <span>· {shortDate(viewTarget?.period_start)} → {shortDate(viewTarget?.period_end)}</span>
                )}
                <Badge variant={viewTarget?.status === "final" ? "default" : "outline"}>{statusLabels[viewTarget?.status] ?? viewTarget?.status}</Badge>
              </div>

              {Array.isArray(viewTarget?.metrics) && viewTarget.metrics.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {viewTarget.metrics.map((m: Metric, i: number) => (
                    <div key={i} className="rounded-lg border border-border/60 bg-surface-2/40 p-3 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</div>
                      <div className="mt-1 font-display text-lg font-semibold">{m.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {viewTarget?.summary && (
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resumo</div>
                  <p className="whitespace-pre-wrap text-sm">{viewTarget.summary}</p>
                </div>
              )}
              {viewTarget?.notes && (
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações</div>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{viewTarget.notes}</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
            <Button onClick={() => downloadPdf(viewTarget)} disabled={downloadingPdf}>
              {downloadingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              Baixar PDF
            </Button>
            <Button variant="ghost" onClick={() => setViewTarget(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir relatório?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir "{deleteTarget?.title}" permanentemente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(deleteTarget.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Excluir em massa */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} relatório(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os relatórios selecionados serão excluídos permanentemente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => bulkDelete.mutate(Array.from(selectedIds))}>Excluir tudo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Excluir pasta */}
      <AlertDialog open={!!deleteFolderTarget} onOpenChange={(v) => !v && setDeleteFolderTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a pasta "{deleteFolderTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              A pasta será removida, mas os relatórios dentro dela são mantidos — eles voltam para "Sem pasta".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteFolder.mutate(deleteFolderTarget.id)}>Excluir pasta</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Nova pasta */}
      <Dialog open={folderDialogOpen} onOpenChange={(v) => { setFolderDialogOpen(v); if (!v) setNewFolderName(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova pasta</DialogTitle></DialogHeader>
          <div>
            <Label>Nome da pasta</Label>
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Ex: Clientes ativos, Julho, Fechados…"
              onKeyDown={(e) => { if (e.key === "Enter" && newFolderName.trim()) createFolder.mutate(newFolderName); }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFolderDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createFolder.mutate(newFolderName)} disabled={!newFolderName.trim() || createFolder.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Geração automática semanal / mensal */}
      <Dialog open={genOpen} onOpenChange={(v) => { if (!generating) setGenOpen(v); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerar relatórios — {genType === "weekly" ? "Semanal" : "Mensal"}</DialogTitle>
          </DialogHeader>
          {(() => {
            const { start, end } = genType === "weekly" ? lastCompleteWeek() : lastCompleteMonth();
            return (
              <div className="space-y-3">
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                  Período: <strong>{shortDate(start)} → {shortDate(end)}</strong> · {periodTitle(genType, start, end)}
                  <div className="mt-1 text-muted-foreground">
                    Para cada cliente selecionado: puxa os dados do Reportei (ou dos dados internos, se não estiver vinculado),
                    gera resumo e observações automáticos, salva na base e baixa 1 PDF por cliente.
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="mb-0">Clientes ({genClientIds.size} selecionados)</Label>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setGenClientIds(new Set((clients ?? []).map((c: any) => c.id)))}>Todos</Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setGenClientIds(new Set())}>Nenhum</Button>
                  </div>
                </div>

                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-2">
                  {(clients ?? []).map((c: any) => {
                    const linked = !!clientsReportei?.find((x: any) => x.id === c.id)?.reportei_project_id;
                    return (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50">
                        <Checkbox checked={genClientIds.has(c.id)} onCheckedChange={() => toggleGenClient(c.id)} />
                        <span className="flex-1 truncate text-sm">{c.name}</span>
                        <Badge variant={linked ? "default" : "outline"} className="text-[9px]">
                          {linked ? "Reportei" : "Interno"}
                        </Badge>
                      </label>
                    );
                  })}
                  {(clients ?? []).length === 0 && <p className="p-2 text-xs text-muted-foreground">Nenhum cliente cadastrado.</p>}
                </div>

                {generating && (
                  <div className="rounded-lg border border-border/60 bg-surface-2/40 px-3 py-2 text-xs">
                    Gerando {genProgress.done} de {genProgress.total}… os PDFs vão baixando um a um.
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary transition-all" style={{ width: `${genProgress.total ? (genProgress.done / genProgress.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGenOpen(false)} disabled={generating}>Cancelar</Button>
            <Button onClick={runGeneration} disabled={generating || genClientIds.size === 0}>
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarRange className="mr-2 h-4 w-4" />}
              {generating ? "Gerando…" : `Gerar ${genClientIds.size} relatório(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FolderChip({ active, onClick, label, icon: Icon }: {
  active: boolean; onClick: () => void; label: string; icon?: any;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition " +
        (active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground")
      }
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
