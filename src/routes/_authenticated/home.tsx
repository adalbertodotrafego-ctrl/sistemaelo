import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Plus, Megaphone, Wrench, Rocket, Pin, MoreVertical, Trash2, Pencil, FlaskConical,
  Sparkles, ArrowRight, Users as UsersIcon, ListChecks, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { iconByName } from "@/lib/nav-meta";
import { useMyItems } from "@/lib/boards/queries";

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

  // Métricas breves
  const { data: myItems } = useMyItems(user?.id);
  const { data: metrics } = useQuery({
    queryKey: ["home-metrics"],
    queryFn: async () => {
      const [team, clients] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("clients").select("*", { count: "exact", head: true }).eq("status", "active"),
      ]);
      return { team: team.count ?? 0, clients: clients.count ?? 0 };
    },
  });

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

  const SHORTCUTS = [
    { path: "/clients", label: "Clientes", icon: "Users", key: "clients" },
    { path: "/crm", label: "CRM", icon: "Kanban", key: "crm" },
    { path: "/tasks", label: "Tarefas", icon: "LayoutGrid", key: "tasks" },
    { path: "/events", label: "Eventos", icon: "CalendarClock", key: "events" },
    { path: "/marketing", label: "Meta Ads", icon: "Megaphone", key: "marketing" },
    { path: "/reports", label: "Relatórios", icon: "BarChart3", key: "reports" },
    { path: "/goals", label: "Metas", icon: "Target", key: "goals" },
    { path: "/finance", label: "Financeiro", icon: "Wallet", key: "finance" },
    { path: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", key: "dashboard" },
    { path: "/social", label: "Planejamento", icon: "CalendarHeart", key: "social" },
  ].filter((s) => isAdmin || can(s.key));

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          eyebrow="Início"
          title={`${greet()}, ${firstName} 👋`}
          description="Bem-vindo ao Elo Marketing OS — o sistema que reúne clientes, CRM, tarefas, campanhas, relatórios e eventos da agência num só lugar. Comece pelos atalhos abaixo."
          actions={isAdmin ? (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
              <DialogTrigger asChild><Button variant="outline" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nova novidade</Button></DialogTrigger>
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

      {/* Métricas breves */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MiniMetric icon={ListChecks} label="Minhas demandas" value={myItems?.length ?? "—"} to="/tasks" accent="text-primary" />
        <MiniMetric icon={UsersIcon} label="Pessoas no sistema" value={metrics?.team ?? "—"} to="/team" accent="text-blue-300" />
        <MiniMetric icon={Building2} label="Clientes ativos" value={metrics?.clients ?? "—"} to="/clients" accent="text-emerald-300" />
      </div>

      {/* Atalhos */}
      <div>
        <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Atalhos</div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {SHORTCUTS.map((s) => {
            const Icon = iconByName(s.icon);
            return (
              <Link key={s.path} to={s.path} className="surface-card group flex flex-col items-center justify-center gap-2 p-4 text-center transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elegant">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary/20"><Icon className="h-5 w-5" /></span>
                <span className="text-xs font-medium">{s.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

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

function MiniMetric({ icon: Icon, label, value, to, accent }: { icon: any; label: string; value: any; to: string; accent: string }) {
  return (
    <Link to={to} className="surface-card group flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elegant">
      <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface/60 " + accent}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-display text-xl font-semibold">{value}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
    </Link>
  );
}
