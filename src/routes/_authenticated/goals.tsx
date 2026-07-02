import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Target, Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Metas — Elo Marketing OS" }] }),
  component: GoalsPage,
});

const empty = { title: "", metric: "", target: "", progress: "0" };

function GoalsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: goals } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => (await supabase.from("goals").select("*").order("created_at",{ascending:false})).data ?? [],
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (g: any) => {
    setEditingId(g.id);
    setForm({
      title: g.title ?? "", metric: g.metric ?? "",
      target: g.target != null ? String(g.target) : "", progress: g.progress != null ? String(g.progress) : "0",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { title: form.title, metric: form.metric, target: Number(form.target), progress: Number(form.progress) };
      if (editingId) {
        const { error } = await supabase.from("goals").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("goals").insert({ ...payload, scope: "agency" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      setOpen(false);
      setEditingId(null);
      setForm(empty);
      toast.success(editingId ? "Meta atualizada!" : "Meta criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      setDeleteTarget(null);
      toast.success("Meta excluída!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Crescimento"
        title="Metas"
        description="Acompanhe o progresso da agência."
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(empty); } }}>
            <DialogTrigger asChild><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nova meta</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Editar meta" : "Nova meta"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
                <div><Label>Métrica</Label><Input value={form.metric} onChange={e => setForm({...form, metric: e.target.value})} placeholder="R$, clientes, vendas…" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Meta (alvo) *</Label><Input type="number" value={form.target} onChange={e => setForm({...form, target: e.target.value})} /></div>
                  <div><Label>Atual</Label><Input type="number" value={form.progress} onChange={e => setForm({...form, progress: e.target.value})} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => save.mutate()} disabled={!form.title || !form.target || save.isPending}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {!goals || goals.length === 0 ? (
        <EmptyState icon={Target} title="Defina suas primeiras metas" description="Crie metas claras para a agência e acompanhe o progresso." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g: any) => {
            const pct = g.target > 0 ? Math.min(100, Math.round((Number(g.progress) / Number(g.target)) * 100)) : 0;
            return (
              <div key={g.id} className="surface-card group relative p-6">
                <div className="absolute right-3 top-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(g)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteTarget(g)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-start justify-between pr-6">
                  <div>
                    <div className="font-display text-lg font-semibold">{g.title}</div>
                    <div className="text-xs text-muted-foreground">{g.metric}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold text-primary">{pct}%</div>
                  </div>
                </div>
                <Progress value={pct} className="mt-4 h-2" />
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>{Number(g.progress).toLocaleString("pt-BR")}</span>
                  <span>Meta: {Number(g.target).toLocaleString("pt-BR")}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir meta?</AlertDialogTitle>
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
