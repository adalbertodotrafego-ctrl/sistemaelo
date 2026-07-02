import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, FolderKanban, ListChecks, DollarSign, Target, Download } from "lucide-react";
import { brl } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Relatórios — Elo Marketing OS" }] }),
  component: ReportsPage,
});

const COLORS = ["#2563EB", "#7C3AED", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"];

function ReportsPage() {
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
      <PageHeader
        eyebrow="Crescimento"
        title="Relatórios"
        description="Visão consolidada de operação, financeiro e marketing."
        actions={<Button onClick={exportCSV} variant="outline"><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>}
      />

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
