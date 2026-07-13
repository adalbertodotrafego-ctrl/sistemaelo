import { createFileRoute } from "@tanstack/react-router";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BarChart3, Users, FolderKanban, ListChecks, DollarSign, Target, Download,
  FileBarChart, Plus, Sparkles, Pencil, Trash2, MoreVertical, Eye, Printer, X,
} from "lucide-react";
import { brl, shortDate } from "@/lib/format";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-auth";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

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

function ClientReportsTab() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyReportForm);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [autoFilling, setAutoFilling] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [viewTarget, setViewTarget] = useState<any>(null);

  const { data: reports } = useQuery({
    queryKey: ["client_reports"],
    queryFn: async () =>
      (await (supabase as any).from("client_reports").select("*, clients(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyReportForm);
    setMetrics([]);
    setOpen(true);
  };

  const openEdit = (r: any) => {
    setEditingId(r.id);
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
      setMetrics([
        { label: "Investido em anúncios", value: brl(invested) },
        { label: "Leads gerados", value: String(leads) },
        { label: "ROAS médio", value: avgRoas.toFixed(2) + "x" },
        { label: "CTR médio", value: avgCtr.toFixed(2) + "%" },
        { label: "Receita no período", value: brl(income) },
        { label: "Posts publicados", value: String(social.count ?? 0) },
      ]);
      toast.success("Dados preenchidos — revise e edite à vontade antes de salvar.");
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível puxar os dados");
    } finally {
      setAutoFilling(false);
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

  return (
    <div>
      <div className="mb-4 flex justify-end">
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
              <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Relatório de julho — Saladas Grill" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Período — início</Label><Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></div>
                <div><Label>Período — fim</Label><Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Label className="mb-0">Indicadores</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={autofill} disabled={autoFilling}>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />{autoFilling ? "Puxando…" : "Preencher automaticamente"}
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

              <div><Label>Resumo</Label><Textarea rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Destaques do período, o que funcionou, próximos passos…" /></div>
              <div><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => save.mutate()} disabled={!form.client_id || !form.title || save.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {(reports?.length ?? 0) === 0 ? (
        <EmptyState icon={FileBarChart} title="Nenhum relatório ainda" description="Crie o primeiro relatório para um cliente — puxe os dados automaticamente ou preencha na mão." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {reports!.map((r: any) => (
            <div key={r.id} className="surface-card group relative p-5">
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
                    <DropdownMenuItem onClick={() => setDeleteTarget(r)} className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mb-3 flex items-start justify-between gap-3 pr-6">
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
          ))}
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
            <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir / PDF</Button>
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
    </div>
  );
}
