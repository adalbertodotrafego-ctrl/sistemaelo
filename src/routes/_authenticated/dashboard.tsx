import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/ui-extras/page";
import { brl, shortDate } from "@/lib/format";
import { useCurrentUser } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Users, FolderKanban, ListChecks, Wallet, Video, Megaphone,
  UserCog, Sparkles, ArrowUpRight, Calendar as CalendarIcon,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Elo Marketing OS" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useCurrentUser();
  const { isAdmin, can } = usePermissions();
  const showFinance = isAdmin || can("finance");
  const showClients = isAdmin || can("clients");
  const showProjects = isAdmin || can("projects");
  const showCrm = isAdmin || can("crm");
  const showMarketing = isAdmin || can("marketing");

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", isAdmin, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const tasksQuery = isAdmin
        ? supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "done")
        : (supabase as any).from("tasks").select("*, task_assignees!inner(user_id)", { count: "exact", head: true })
            .eq("task_assignees.user_id", user!.id).neq("status", "done");

      const meetingsQueryBase = supabase.from("events").select("*", { count: "exact", head: true })
        .eq("type", "meeting").gte("start_at", today.toISOString()).lt("start_at", tomorrow.toISOString());
      const meetingsQuery = isAdmin ? meetingsQueryBase : meetingsQueryBase.eq("created_by", user!.id);

      const [clientsActive, projectsActive, projectsDone, tasksPending,
             meetingsToday, leads, campaigns, team, monthIncome] = await Promise.all([
        showClients ? supabase.from("clients").select("*", { count: "exact", head: true }).eq("status", "active") : null,
        showProjects ? supabase.from("projects").select("*", { count: "exact", head: true }).in("status", ["planning","in_progress","review"]) : null,
        showProjects ? supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "done") : null,
        tasksQuery,
        meetingsQuery,
        showCrm ? supabase.from("crm_leads").select("*", { count: "exact", head: true }).not("stage","in","(won,lost)") : null,
        showMarketing ? supabase.from("campaigns").select("*", { count: "exact", head: true }) : null,
        isAdmin ? supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "active") : null,
        showFinance ? supabase.from("finance_entries").select("amount").eq("kind","income").gte("paid_at", monthStart.toISOString().slice(0,10)) : null,
      ]);
      const income = (monthIncome?.data ?? []).reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
      return {
        clientsActive: clientsActive?.count ?? 0,
        projectsActive: projectsActive?.count ?? 0,
        projectsDone: projectsDone?.count ?? 0,
        tasksPending: tasksPending.count ?? 0,
        meetingsToday: meetingsToday.count ?? 0,
        leads: leads?.count ?? 0,
        campaigns: campaigns?.count ?? 0,
        team: team?.count ?? 0,
        income,
      };
    },
  });

  const { data: upcoming } = useQuery({
    queryKey: ["dashboard-upcoming", isAdmin, user?.id],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("events").select("*, event_participants(user_id)")
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(20);
      const { data } = await q;
      const rows = data ?? [];
      const scoped = isAdmin ? rows : rows.filter((e: any) =>
        e.created_by === user!.id || (e.event_participants ?? []).some((p: any) => p.user_id === user!.id));
      return scoped.slice(0, 5);
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["dashboard-tasks", isAdmin, user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (isAdmin) {
        const { data } = await supabase
          .from("tasks").select("id,title,status,priority,due_date")
          .neq("status","done").order("due_date",{ ascending: true, nullsFirst: false }).limit(6);
        return data ?? [];
      }
      const { data } = await (supabase as any)
        .from("tasks").select("id,title,status,priority,due_date, task_assignees!inner(user_id)")
        .eq("task_assignees.user_id", user!.id)
        .neq("status","done").order("due_date",{ ascending: true, nullsFirst: false }).limit(6);
      return data ?? [];
    },
  });

  const { data: trend } = useQuery({
    queryKey: ["dashboard-trend"],
    enabled: showFinance,
    queryFn: async () => {
      const out: { month: string; receita: number }[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const { data } = await supabase.from("finance_entries").select("amount")
          .eq("kind","income")
          .gte("paid_at", d.toISOString().slice(0,10))
          .lt("paid_at", next.toISOString().slice(0,10));
        const sum = (data ?? []).reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
        out.push({ month: d.toLocaleDateString("pt-BR",{month:"short"}), receita: sum });
      }
      return out;
    },
  });

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          eyebrow="Visão geral"
          title={`${greet()}, ${user?.user_metadata?.full_name?.split(" ")[0] ?? "time"} 👋`}
          description={isAdmin
            ? "Um panorama em tempo real da operação da Elo Marketing."
            : "Suas tarefas e compromissos de hoje."}
        />
      </motion.div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {showClients && <StatCard label="Clientes ativos" value={stats?.clientsActive ?? "—"} icon={Users} accent="primary" />}
        {showProjects && <StatCard label="Projetos ativos" value={stats?.projectsActive ?? "—"} icon={FolderKanban} accent="primary" />}
        {showProjects && <StatCard label="Projetos concluídos" value={stats?.projectsDone ?? "—"} icon={Sparkles} accent="success" />}
        {showFinance && <StatCard label="Receita do mês" value={brl(stats?.income ?? 0)} icon={Wallet} accent="success" />}
        <StatCard label={isAdmin ? "Tarefas pendentes" : "Minhas tarefas pendentes"} value={stats?.tasksPending ?? "—"} icon={ListChecks} accent="warning" />
        <StatCard label={isAdmin ? "Reuniões hoje" : "Minhas reuniões hoje"} value={stats?.meetingsToday ?? "—"} icon={Video} accent="primary" />
        {showCrm && <StatCard label="Leads em andamento" value={stats?.leads ?? "—"} icon={ArrowUpRight} accent="primary" />}
        {showMarketing && <StatCard label="Campanhas" value={stats?.campaigns ?? "—"} icon={Megaphone} accent="primary" />}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {showFinance && (
          <div className="surface-card p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Receita — últimos 6 meses</div>
                <div className="font-display text-xl font-semibold">{brl(stats?.income ?? 0)} <span className="text-sm font-normal text-muted-foreground">este mês</span></div>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend ?? []}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.58 0.21 264)" stopOpacity={0.5}/>
                      <stop offset="100%" stopColor="oklch(0.58 0.21 264)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "#0f0f12", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                    formatter={(v: number) => brl(v)} />
                  <Area type="monotone" dataKey="receita" stroke="oklch(0.7 0.22 260)" strokeWidth={2} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className={"surface-card p-6 " + (showFinance ? "" : "lg:col-span-3")}>
          <div className="mb-4 flex items-center justify-between">
            <div className="font-display text-lg font-semibold">{isAdmin ? "Próximos eventos" : "Meus próximos eventos"}</div>
            <Link to="/calendar" className="text-xs text-primary hover:underline">Ver tudo</Link>
          </div>
          <div className="space-y-3">
            {(upcoming ?? []).length === 0 && (
              <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                Nenhum evento próximo.
              </div>
            )}
            {(upcoming ?? []).map((e) => (
              <div key={e.id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface-2/40 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <CalendarIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {shortDate(e.start_at)} · {new Date(e.start_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-display text-lg font-semibold">{isAdmin ? "Tarefas em aberto" : "Minhas tarefas em aberto"}</div>
            <Link to="/tasks" className="text-xs text-primary hover:underline">Abrir Kanban</Link>
          </div>
          <div className="divide-y divide-border/60">
            {(tasks ?? []).length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">Tudo em dia! 🎉</div>
            )}
            {(tasks ?? []).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.due_date ? `Vence em ${shortDate(t.due_date)}` : "Sem prazo"}
                  </div>
                </div>
                <span className={
                  "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
                  (t.priority === "urgent" ? "bg-red-500/15 text-red-400" :
                   t.priority === "high" ? "bg-amber-500/15 text-amber-400" :
                   "bg-primary/15 text-primary")
                }>{t.priority}</span>
              </div>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="surface-card p-6">
            <div className="mb-4 font-display text-lg font-semibold">Equipe e produção</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border/60 bg-surface-2/40 p-4">
                <UserCog className="h-5 w-5 text-primary" />
                <div className="mt-2 text-2xl font-semibold">{stats?.team ?? "—"}</div>
                <div className="text-xs text-muted-foreground">Funcionários ativos</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-surface-2/40 p-4">
                <Megaphone className="h-5 w-5 text-primary" />
                <div className="mt-2 text-2xl font-semibold">{stats?.campaigns ?? "—"}</div>
                <div className="text-xs text-muted-foreground">Campanhas ativas</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-surface-2/40 p-4">
                <ArrowUpRight className="h-5 w-5 text-primary" />
                <div className="mt-2 text-2xl font-semibold">{stats?.leads ?? "—"}</div>
                <div className="text-xs text-muted-foreground">Leads no pipeline</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-surface-2/40 p-4">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                <div className="mt-2 text-2xl font-semibold">{stats?.projectsDone ?? "—"}</div>
                <div className="text-xs text-muted-foreground">Projetos entregues</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
