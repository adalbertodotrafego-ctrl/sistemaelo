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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, Plus, Calendar, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { shortDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({ meta: [{ title: "Projetos — Elo Marketing OS" }] }),
  component: ProjectsPage,
});

const emptyForm = {
  name: "", client_id: "", category: "", description: "",
  start_date: "", deadline: "", priority: "medium", status: "planning", progress: "0",
};

const STATUS_OPTIONS = [
  { value: "planning", label: "Planejamento" },
  { value: "in_progress", label: "Em andamento" },
  { value: "review", label: "Revisão" },
  { value: "done", label: "Concluído" },
  { value: "on_hold", label: "Em espera" },
  { value: "canceled", label: "Cancelado" },
];

function ProjectsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data } = await supabase.from("projects")
        .select("*, clients(name,company)").order("created_at",{ascending:false});
      return data ?? [];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => (await supabase.from("clients").select("id,name,company")).data ?? [],
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      name: p.name ?? "", client_id: p.client_id ?? "", category: p.category ?? "",
      description: p.description ?? "", start_date: p.start_date ?? "", deadline: p.deadline ?? "",
      priority: p.priority ?? "medium", status: p.status ?? "planning",
      progress: p.progress != null ? String(p.progress) : "0",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form, progress: form.progress ? Number(form.progress) : 0 };
      if (!payload.client_id) payload.client_id = null;
      if (!payload.start_date) payload.start_date = null;
      if (!payload.deadline) payload.deadline = null;
      if (editingId) {
        const { error } = await supabase.from("projects").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        delete payload.progress;
        const { error } = await supabase.from("projects").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(editingId ? "Projeto atualizado!" : "Projeto criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setDeleteTarget(null);
      toast.success("Projeto excluído!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusColor: Record<string, string> = {
    planning: "bg-slate-500/15 text-slate-300",
    in_progress: "bg-blue-500/15 text-blue-300",
    review: "bg-amber-500/15 text-amber-300",
    done: "bg-emerald-500/15 text-emerald-300",
    on_hold: "bg-orange-500/15 text-orange-300",
    canceled: "bg-red-500/15 text-red-300",
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="Projetos"
        description="Acompanhe entregas e prazos em andamento."
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
            <DialogTrigger asChild><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo projeto</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>{editingId ? "Editar projeto" : "Novo projeto"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div className="col-span-2"><Label>Cliente</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({...form, client_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>{(clients ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.company ?? c.name}</SelectItem>
                    ))}</SelectContent>
                  </Select>
                </div>
                <div><Label>Categoria</Label><Input value={form.category} onChange={e => setForm({...form, category: e.target.value})} /></div>
                <div><Label>Prioridade</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({...form, priority: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Início</Label><Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} /></div>
                <div><Label>Prazo</Label><Input type="date" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} /></div>
                {editingId && (
                  <>
                    <div><Label>Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({...form, status: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Progresso (%)</Label><Input type="number" min={0} max={100} value={form.progress} onChange={e => setForm({...form, progress: e.target.value})} /></div>
                  </>
                )}
                <div className="col-span-2"><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {(projects ?? []).length === 0 ? (
        <EmptyState icon={FolderKanban} title="Sem projetos cadastrados" description="Crie seu primeiro projeto para começar a acompanhar entregas." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(projects ?? []).map((p: any) => (
            <div key={p.id} className="surface-card group relative p-5 transition hover:-translate-y-0.5 hover:shadow-elegant">
              <div className="absolute right-3 top-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100">
                      <MoreVertical className="h-4 w-4" />
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
              <div className="flex items-start justify-between pr-6">
                <div className="min-w-0">
                  <div className="truncate font-display text-base font-semibold">{p.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.clients?.company ?? p.clients?.name ?? "Interno"}</div>
                </div>
                <Badge className={statusColor[p.status]}>{p.status}</Badge>
              </div>
              {p.description && <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Progresso</span><span>{p.progress}%</span>
                </div>
                <Progress value={p.progress} className="h-1.5" />
              </div>
              <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{shortDate(p.deadline)}</span>
                <span className="capitalize">· {p.priority}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir "{deleteTarget?.name}" e todas as tarefas vinculadas a ele. Essa ação não pode ser desfeita.
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
