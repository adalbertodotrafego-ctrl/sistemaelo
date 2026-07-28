import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Sparkles, Plus, Megaphone, Wrench, Rocket, Pin, MoreVertical, Trash2, Pencil, FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/news")({
  head: () => ({ meta: [{ title: "Novidades — Elo Marketing OS" }] }),
  component: NewsPage,
});

const KINDS: Record<string, { label: string; icon: any; cls: string }> = {
  update: { label: "Atualização", icon: Rocket, cls: "bg-primary/15 text-primary border-primary/30" },
  notice: { label: "Aviso", icon: Megaphone, cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  fix: { label: "Correção", icon: Wrench, cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  beta: { label: "Beta", icon: FlaskConical, cls: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
};

const emptyForm = { title: "", body: "", kind: "update", is_beta: false, pinned: false };

function NewsPage() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const { isAdmin } = usePermissions();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, error } = useQuery({
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
  const news = data?.rows ?? [];
  const missing = data?.missing || (error && /does not exist/i.test((error as any).message));

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-news"] });
      setOpen(false); setEditingId(null); setForm(emptyForm);
      toast.success(editingId ? "Novidade atualizada!" : "Novidade publicada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("system_news").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["system-news"] }); toast.success("Novidade removida."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (n: any) => {
    setEditingId(n.id);
    setForm({ title: n.title ?? "", body: n.body ?? "", kind: n.kind ?? "update", is_beta: !!n.is_beta, pinned: !!n.pinned });
    setOpen(true);
  };
  const openCreate = () => { setEditingId(null); setForm(emptyForm); setOpen(true); };

  const pinned = news.filter((n: any) => n.pinned);
  const rest = news.filter((n: any) => !n.pinned);

  return (
    <div>
      <PageHeader
        eyebrow="Visão geral"
        title="Novidades"
        description="Atualizações, avisos e o que há de novo no Elo Marketing OS."
        actions={isAdmin ? (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
            <DialogTrigger asChild><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nova novidade</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Editar novidade" : "Nova novidade / aviso"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Nova página de Eventos" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Tipo</Label>
                    <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(KINDS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-4 pb-1">
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                      <input type="checkbox" checked={form.is_beta} onChange={(e) => setForm({ ...form, is_beta: e.target.checked })} className="accent-primary" />
                      Beta
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                      <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} className="accent-primary" />
                      Fixar no topo
                    </label>
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

      {missing && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
          Aplique a migração <strong>20260724160000_news_and_client_labels.sql</strong> no Supabase para ativar as Novidades.
        </div>
      )}

      {news.length === 0 && !missing ? (
        <EmptyState icon={Sparkles} title="Nada por aqui ainda" description={isAdmin ? "Publique a primeira novidade ou aviso." : "Assim que houver novidades, elas aparecem aqui."} />
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <div className="space-y-3">
              {pinned.map((n: any) => <NewsCard key={n.id} n={n} isAdmin={isAdmin} onEdit={openEdit} onRemove={(id) => remove.mutate(id)} />)}
            </div>
          )}
          <div className="relative space-y-4 border-l border-border/60 pl-5">
            {rest.map((n: any) => (
              <div key={n.id} className="relative">
                <span className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                <NewsCard n={n} isAdmin={isAdmin} onEdit={openEdit} onRemove={(id) => remove.mutate(id)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NewsCard({ n, isAdmin, onEdit, onRemove }: { n: any; isAdmin: boolean; onEdit: (n: any) => void; onRemove: (id: string) => void }) {
  const kind = KINDS[n.kind] ?? KINDS.update;
  return (
    <div className={"surface-card group relative p-5 " + (n.pinned ? "border-primary/30" : "")}>
      {isAdmin && (
        <div className="absolute right-3 top-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground group-hover:opacity-100"><MoreVertical className="h-4 w-4" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(n)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRemove(n.id)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" />Excluir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <div className="mb-2 flex flex-wrap items-center gap-2 pr-6">
        <Badge variant="outline" className={"gap-1 " + kind.cls}><kind.icon className="h-3 w-3" />{kind.label}</Badge>
        {n.is_beta && <Badge variant="outline" className="gap-1 border-purple-500/30 bg-purple-500/15 text-purple-300"><FlaskConical className="h-3 w-3" />Beta</Badge>}
        {n.pinned && <Badge variant="outline" className="gap-1 border-primary/30 text-primary"><Pin className="h-3 w-3" />Fixado</Badge>}
        <span className="ml-auto text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span>
      </div>
      <h3 className="font-display text-base font-semibold">{n.title}</h3>
      {n.body && <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</p>}
    </div>
  );
}
