import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/ui-extras/page";
import { brl, shortDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Users, FolderKanban, Wallet, Video, Megaphone, UserCog, Sparkles, ArrowUpRight,
  Calendar as CalendarIcon, Rocket, Wrench, Pin, MoreVertical, Trash2, Pencil, FlaskConical,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — Elo Marketing OS" }] }),
  component: HomePage,
});

const KINDS: Record<string, { label: string; icon: any; color: string; bar: string }> = {
  update: { label: "Atualização", icon: Rocket, color: "text-primary", bar: "bg-primary" },
  notice: { label: "Aviso", icon: Megaphone, color: "text-amber-400", bar: "bg-amber-500" },
  fix: { label: "Correção", icon: Wrench, color: "text-emerald-400", bar: "bg-emerald-500" },
  beta: { label: "Beta", icon: FlaskConical, color: "text-purple-400", bar: "bg-purple-500" },
};

const emptyForm = { title: "", body: "", kind: "update", is_beta: false, pinned: false };

function HomePage() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const { isAdmin, can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const showFinance = isAdmin || can("finance");
  const showClients = isAdmin || can("clients");
  const showProjects = isAdmin || can("projects");
  const showCrm = isAdmin || can("crm");
  const showMarketing = isAdmin || can("marketing");

  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0]
    ?? user?.email?.split("@")[0] ?? "time";
  const greet = () => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; };

  // Notícias
  const { data: newsData } = useQuery({
    queryKey: ["system-news"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("system_news").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false });
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) return { rows: [] as any[], missing: true };
        throw error;
      }
      return { rows: (data ?? []) as any[], missing: false };
    },
  });
  const news = newsData?.rows ?? [];
  const newsMissing = newsData?.missing;

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      if (editingId) {
        const { error } = await (supabase as any).from("system_news").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("system_news").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["system-news"] }); setOpen(false); setEditingId(null); setForm(emptyForm); toast.success(editingId ? "Novidade atualizada!" : "Novidade publicada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("system_news").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["system-news"] }); toast.success("Novidade removida."); },
    onError: (e: Error) => toast.error(e.message),
  });
  const openEdit = (n: any) => { setEditingId(n.id); setForm({ title: n.title ?? "", body: n.body ?? "", kind: n.kind ?? "update", is_beta: !!n.is_beta, pinned: !!n.pinned }); setOpen(true); };
  const openCreate = () => { setEditingId(null); setForm(emptyForm); setOpen(true); };

  // ---- Painel (ex-Dashboard) ----
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", isAdmin, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const meetingsQueryBase = supabase.from("events").select("*", { count: "exact", head: true })
        .eq("type", "meeting").gte("start_at", today.toISOString()).lt("start_at", tomorrow.toISOString());
      const meetingsQuery = isAdmin ? meetingsQueryBase : meetingsQueryBase.eq("created_by", user!.id);

      const [clientsActive, projectsActive, projectsDone,
             meetingsToday, leads, campaigns, team, monthIncome] = await Promise.all([
        showClients ? supabase.from("clients").select("*", { count: "exact", head: true }).eq("status", "active") : null,
        showProjects ? supabase.from("projects").select("*", { count: "exact", head: true }).in("status", ["planning","in_progress","review"]) : null,
        showProjects ? supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "done") : null,
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

  const { data: trend } = useQuery({
    queryKey: ["dashboard-trend"],
    enabled: showFinance,
    queryFn: async () => {
      const now = new Date();
      const windowStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const { data } = await supabase.from("finance_entries").select("amount, paid_at")
        .eq("kind","income")
        .gte("paid_at", windowStart.toISOString().slice(0,10))
        .not("paid_at", "is", null);
      const buckets = new Map<string, number>();
      for (const r of data ?? []) {
        const key = String(r.paid_at).slice(0, 7);
        buckets.set(key, (buckets.get(key) ?? 0) + Number(r.amount ?? 0));
      }
      const out: { month: string; receita: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        out.push({ month: d.toLocaleDateString("pt-BR",{month:"short"}), receita: buckets.get(key) ?? 0 });
      }
      return out;
    },
  });

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          eyebrow="Início"
          title={`${greet()}, ${firstName} 👋`}
          description={isAdmin
            ? "Bem-vindo ao Elo Marketing OS — um panorama em tempo real da operação da agência."
            : "Bem-vindo ao Elo Marketing OS — seus compromissos e o panorama do dia."}
          actions={isAdmin ? (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
              <DialogTrigger asChild><Button variant="outline" onClick={openCreate}><Sparkles className="mr-2 h-4 w-4" />Nova novidade</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingId ? "Editar novidade" : "Nova novidade / aviso"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Nova Home do sistema" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Tipo</Label>
                      <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(KINDS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-4 pb-1">
                      <label className="flex cursor-pointer items-center gap-1.5 text-sm"><input type="checkbox" checked={form.is_beta} onChange={(e) => setForm({ ...form, is_beta: e.target.checked })} className="accent-primary" />Beta</label>
                      <label className="flex cursor-pointer items-center gap-1.5 text-sm"><input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} className="accent-primary" />Fixar</label>
                    </div>
                  </div>
                  <div><Label>Descrição</Label><Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="O que mudou, como usar…" /></div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending}>Publicar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : undefined}
        />
      </motion.div>

      {/* Painel */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {showClients && <StatCard label="Clientes ativos" value={stats?.clientsActive ?? "—"} icon={Users} accent="primary" />}
        {showProjects && <StatCard label="Projetos ativos" value={stats?.projectsActive ?? "—"} icon={FolderKanban} accent="primary" />}
        {showProjects && <StatCard label="Projetos concluídos" value={stats?.projectsDone ?? "—"} icon={Sparkles} accent="success" />}
        {showFinance && <StatCard label="Receita do mês" value={brl(stats?.income ?? 0)} icon={Wallet} accent="success" />}
        <StatCard label={isAdmin ? "Reuniões hoje" : "Minhas reuniões hoje"} value={stats?.meetingsToday ?? "—"} icon={Video} accent="primary" />
        {showCrm && <StatCard label="Leads em andamento" value={stats?.leads ?? "—"} icon={ArrowUpRight} accent="primary" />}
        {showMarketing && <StatCard label="Campanhas" value={stats?.campaigns ?? "—"} icon={Megaphone} accent="primary" />}
        {isAdmin && <StatCard label="Equipe" value={stats?.team ?? "—"} icon={UserCog} accent="primary" />}
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
            <Link to="/social" className="text-xs text-primary hover:underline">Ver tudo</Link>
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

      {isAdmin && (
        <div className="surface-card p-6">
          <div className="mb-4 font-display text-lg font-semibold">Equipe e produção</div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      {/* Novidades */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">Novidades do sistema</h2>
        </div>
        {newsMissing ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
            Aplique a migração <strong>20260724160000_news_and_client_labels.sql</strong> no Supabase para ativar as Novidades.
          </div>
        ) : news.length === 0 ? (
          <div className="surface-card p-8 text-center text-sm text-muted-foreground">
            <Sparkles className="mx-auto mb-2 h-6 w-6 opacity-40" />
            {isAdmin ? "Publique a primeira novidade para o time." : "Assim que houver novidades, elas aparecem aqui."}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {news.map((n: any) => {
              const kind = KINDS[n.kind] ?? KINDS.update;
              return (
                <div key={n.id} className="surface-card group relative overflow-hidden pl-5 pr-5 py-4">
                  <span className={"absolute left-0 top-0 h-full w-1 " + kind.bar} />
                  {isAdmin && (
                    <div className="absolute right-2 top-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground group-hover:opacity-100"><MoreVertical className="h-4 w-4" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(n)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => remove.mutate(n.id)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" />Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 pr-6">
                    <span className={"flex items-center gap-1 text-xs font-medium " + kind.color}><kind.icon className="h-3.5 w-3.5" />{kind.label}</span>
                    {n.is_beta && <Badge variant="outline" className="gap-1 border-purple-500/30 bg-purple-500/15 text-[10px] text-purple-300"><FlaskConical className="h-2.5 w-2.5" />Beta</Badge>}
                    {n.pinned && <Badge variant="outline" className="gap-1 border-primary/30 text-[10px] text-primary"><Pin className="h-2.5 w-2.5" />Fixado</Badge>}
                    <span className="ml-auto text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                  </div>
                  <h3 className="font-display text-sm font-semibold">{n.title}</h3>
                  {n.body && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{n.body}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
