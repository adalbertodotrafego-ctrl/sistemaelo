import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon, Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/social")({
  head: () => ({ meta: [{ title: "Social Media — Elo Marketing OS" }] }),
  component: SocialPage,
});

const formatColors: Record<string, string> = {
  post: "bg-blue-500/15 text-blue-300",
  story: "bg-pink-500/15 text-pink-300",
  reel: "bg-purple-500/15 text-purple-300",
  carousel: "bg-emerald-500/15 text-emerald-300",
  video: "bg-amber-500/15 text-amber-300",
};

const statusColumns = [
  { key: "idea", label: "Ideia" },
  { key: "in_production", label: "Em produção" },
  { key: "scheduled", label: "Agendado" },
  { key: "published", label: "Publicado" },
];

const empty = { title: "", caption: "", format: "post", scheduled_at: "", status: "idea", client_id: "" };

function SocialPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: posts } = useQuery({
    queryKey: ["social_posts"],
    queryFn: async () => (await supabase.from("social_posts").select("*, clients(name)").order("scheduled_at", { ascending: true, nullsFirst: false })).data ?? [],
  });
  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      title: p.title ?? "", caption: p.caption ?? "", format: p.format ?? "post",
      scheduled_at: p.scheduled_at ? p.scheduled_at.slice(0, 16) : "",
      status: p.status ?? "idea", client_id: p.client_id ?? "",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (!payload.scheduled_at) payload.scheduled_at = null;
      if (!payload.client_id) payload.client_id = null;
      if (editingId) {
        const { error } = await supabase.from("social_posts").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("social_posts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social_posts"] });
      setOpen(false); setEditingId(null); setForm(empty);
      toast.success(editingId ? "Post atualizado!" : "Post criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("social_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social_posts"] });
      setDeleteTarget(null);
      toast.success("Post excluído!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Crescimento"
        title="Social Media"
        description="Planejamento editorial: ideias, produção, agendamento e publicação."
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(empty); } }}>
            <DialogTrigger asChild><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo post</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Editar post" : "Novo post"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Formato</Label>
                    <Select value={form.format} onValueChange={v => setForm({...form, format: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="post">Post</SelectItem>
                        <SelectItem value="story">Story</SelectItem>
                        <SelectItem value="reel">Reel</SelectItem>
                        <SelectItem value="carousel">Carrossel</SelectItem>
                        <SelectItem value="video">Vídeo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Status</Label>
                    <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statusColumns.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Cliente</Label>
                  <Select value={form.client_id} onValueChange={v => setForm({...form, client_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{(clients ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Agendado para</Label><Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({...form, scheduled_at: e.target.value})} /></div>
                <div><Label>Legenda</Label><Textarea rows={3} value={form.caption} onChange={e => setForm({...form, caption: e.target.value})} /></div>
              </div>
              <DialogFooter className="sm:justify-between">
                {editingId ? (
                  <Button variant="ghost" className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget({ id: editingId, title: form.title })}>
                    <Trash2 className="mr-2 h-4 w-4" />Excluir
                  </Button>
                ) : <span />}
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending}>Salvar</Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {(posts?.length ?? 0) === 0 ? (
        <EmptyState icon={ImageIcon} title="Nenhum post planejado" description="Comece criando posts no calendário editorial." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {statusColumns.map(col => {
            const items = (posts ?? []).filter((p: any) => p.status === col.key);
            return (
              <div key={col.key} className="surface-card flex flex-col gap-2 p-3">
                <div className="flex items-center justify-between px-1 pb-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{col.label}</h3>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((p: any) => (
                    <div key={p.id} className="group relative rounded-lg border border-border/60 bg-surface-2 p-3 transition hover:border-primary/40">
                      <div className="absolute right-1.5 top-1.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(p)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteTarget(p)} className="text-destructive focus:text-destructive">
                              <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mb-1.5 flex items-center gap-2 pr-5">
                        <Badge variant="outline" className={formatColors[p.format] ?? ""}>{p.format}</Badge>
                        {p.clients?.name && <span className="truncate text-[10px] text-muted-foreground">{p.clients.name}</span>}
                      </div>
                      <div className="text-sm font-medium leading-tight">{p.title}</div>
                      {p.caption && <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{p.caption}</p>}
                      {p.scheduled_at && (
                        <div className="mt-2 text-[10px] text-primary">
                          {new Date(p.scheduled_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && <div className="rounded border border-dashed border-border/40 p-4 text-center text-[11px] text-muted-foreground">Vazio</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir post?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir "{deleteTarget?.title}" permanentemente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { remove.mutate(deleteTarget.id); setOpen(false); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
