import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-extras/page";
import { MentionTextarea } from "@/components/ui-extras/mention-textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Calendar, MoreVertical, Pencil, Trash2, Link2, X } from "lucide-react";
import { shortDate, initials } from "@/lib/format";
import { notifyUsers } from "@/lib/notifications";
import { toast } from "sonner";
import {
  DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useCurrentUser } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tarefas — Elo Marketing OS" }] }),
  component: TasksPage,
});

const COLUMNS = [
  { id: "todo", label: "A fazer", tone: "text-slate-300" },
  { id: "in_progress", label: "Em andamento", tone: "text-blue-300" },
  { id: "review", label: "Revisão", tone: "text-amber-300" },
  { id: "done", label: "Concluído", tone: "text-emerald-300" },
] as const;

type LinkItem = { label: string; url: string };
const emptyForm = { title: "", description: "", priority: "medium", due_date: "", status: "todo" };

function TasksPage() {
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const { user } = useCurrentUser();
  const { isAdmin } = usePermissions();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  // For admins/managers: filter by member. Default = my own tasks.
  const [viewUserId, setViewUserId] = useState<string>("me");

  const { data: profiles } = useQuery({
    queryKey: ["team-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, avatar_url").order("full_name")).data ?? [],
  });

  const myProfile = profiles?.find((p: any) => p.id === user?.id);
  const effectiveUserId = viewUserId === "me" ? user?.id : viewUserId;
  const viewProfile = profiles?.find((p: any) => p.id === effectiveUserId);
  const viewName = viewProfile?.full_name?.split(" ")[0] ?? "mim";

  const { data: tasks } = useQuery({
    queryKey: ["tasks", effectiveUserId],
    enabled: !!user,
    queryFn: async () => {
      if (!effectiveUserId) {
        const { data } = await (supabase as any).from("tasks").select("*, task_assignees(user_id)").order("created_at", { ascending: false });
        return data ?? [];
      }
      // !inner turns the embed into a join filter, so only tasks with this assignee come back.
      const { data } = await (supabase as any)
        .from("tasks")
        .select("*, task_assignees!inner(user_id)")
        .eq("task_assignees.user_id", effectiveUserId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const task = tasks?.find((t: any) => t.id === id);
      const { error } = await supabase.from("tasks").update({ status } as any).eq("id", id);
      if (error) throw error;
      if (status === "done" && task && task.status !== "done" && task.created_by && task.created_by !== user?.id) {
        await notifyUsers([task.created_by], {
          kind: "task", title: "Tarefa concluída", body: `"${task.title}" foi marcada como concluída.`, link: "/tasks",
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setMentionedIds(user?.id ? [user.id] : []);
    setLinks([]);
    setLinkLabel(""); setLinkUrl("");
    setOpen(true);
  };

  const openEdit = (task: any) => {
    setEditingId(task.id);
    setForm({
      title: task.title ?? "", description: task.description ?? "", priority: task.priority ?? "medium",
      due_date: task.due_date ?? "", status: task.status ?? "todo",
    });
    setMentionedIds((task.task_assignees ?? []).map((a: any) => a.user_id));
    setLinks(Array.isArray(task.links) ? task.links : []);
    setLinkLabel(""); setLinkUrl("");
    setOpen(true);
  };

  const addLink = () => {
    if (!linkUrl.trim()) return;
    const url = /^https?:\/\//i.test(linkUrl) ? linkUrl : `https://${linkUrl}`;
    setLinks([...links, { label: linkLabel.trim() || url, url }]);
    setLinkLabel(""); setLinkUrl("");
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form, links };
      if (!payload.due_date) payload.due_date = null;
      const wasStatus = editingId ? tasks?.find((t: any) => t.id === editingId)?.status : null;
      let taskId = editingId;
      if (editingId) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { data, error } = await supabase.from("tasks").insert(payload).select().single();
        if (error) throw error;
        taskId = data.id;
      }

      const prevAssignees: string[] = editingId
        ? ((tasks?.find((t: any) => t.id === editingId)?.task_assignees ?? []).map((a: any) => a.user_id))
        : [];
      await (supabase as any).from("task_assignees").delete().eq("task_id", taskId);
      if (mentionedIds.length > 0) {
        await (supabase as any).from("task_assignees").insert(mentionedIds.map((user_id) => ({ task_id: taskId, user_id })));
      }
      const newlyMentioned = mentionedIds.filter((id) => !prevAssignees.includes(id));
      if (newlyMentioned.length > 0) {
        await notifyUsers(newlyMentioned, {
          kind: "mention", title: "Você foi adicionado a uma tarefa", body: form.title, link: "/tasks", excludeUserId: user?.id,
        });
      }
      if (editingId && form.status === "done" && wasStatus !== "done" && payload.created_by !== user?.id) {
        // handled via move() for drag-and-drop; here covers status changed through the edit dialog
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setMentionedIds([]);
      setLinks([]);
      toast.success(editingId ? "Tarefa atualizada!" : "Tarefa criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setDeleteTarget(null);
      toast.success("Tarefa excluída!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped: Record<string, any[]> = {};
  COLUMNS.forEach(c => grouped[c.id] = []);
  (tasks ?? []).forEach((t: any) => { (grouped[t.status] ??= []).push(t); });

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const status = String(e.over.id);
    const t = tasks?.find((x: any) => x.id === e.active.id);
    if (t && t.status !== status) move.mutate({ id: String(e.active.id), status });
  };

  const title = viewUserId === "me"
    ? `Tarefas de ${myProfile?.full_name?.split(" ")[0] ?? "mim"}`
    : `Tarefas de ${viewName}`;

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title={title}
        description="Quadro Kanban com drag and drop. Mencione colegas com @ para atribuir a tarefa a eles."
        actions={
          <div className="flex gap-2">
            {isAdmin && (
              <Select value={viewUserId} onValueChange={setViewUserId}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Minhas tarefas</SelectItem>
                  {profiles?.filter((p: any) => p.id !== user?.id).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); setMentionedIds([]); setLinks([]); } }}>
              <DialogTrigger asChild><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nova tarefa</Button></DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingId ? "Editar tarefa" : "Nova tarefa"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
                  <div>
                    <Label>Descrição</Label>
                    <MentionTextarea
                      value={form.description}
                      onChange={(v) => setForm({ ...form, description: v })}
                      mentionedIds={mentionedIds}
                      onMentionedIdsChange={setMentionedIds}
                      profiles={profiles ?? []}
                      rows={3}
                      placeholder="Detalhes da tarefa… use @ para mencionar quem vai executar"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">A tarefa aparece no quadro de todas as pessoas mencionadas.</p>
                  </div>
                  <div>
                    <Label>Links</Label>
                    <div className="flex gap-2">
                      <Input placeholder="Nome (ex: Drive)" value={linkLabel} onChange={e => setLinkLabel(e.target.value)} className="w-1/3" />
                      <Input placeholder="https://…" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addLink())} />
                      <Button type="button" variant="outline" onClick={addLink}><Plus className="h-4 w-4" /></Button>
                    </div>
                    {links.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {links.map((l, i) => (
                          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2 pr-1 text-xs text-primary">
                            <Link2 className="h-3 w-3" />{l.label}
                            <button type="button" onClick={() => setLinks(links.filter((_, idx) => idx !== i))} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
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
                    <div><Label>Prazo</Label><Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} /></div>
                  </div>
                  {editingId && (
                    <div><Label>Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({...form, status: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COLUMNS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => (
            <Column key={col.id} col={col} tasks={grouped[col.id]} profiles={profiles ?? []}
              onEdit={openEdit} onDelete={setDeleteTarget} />
          ))}
        </div>
      </DndContext>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
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

function Column({ col, tasks, profiles, onEdit, onDelete }: {
  col: typeof COLUMNS[number]; tasks: any[]; profiles: any[];
  onEdit: (task: any) => void; onDelete: (task: any) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: col.id });
  return (
    <div ref={setNodeRef} className={"rounded-xl border border-border/60 bg-surface/40 p-3 " + (isOver ? "ring-2 ring-primary/50" : "")}>
      <div className="mb-3 flex items-center justify-between">
        <div className={"font-display text-sm font-semibold " + col.tone}>{col.label}</div>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => <TaskCard key={t.id} task={t} profiles={profiles} onEdit={onEdit} onDelete={onDelete} />)}
      </div>
    </div>
  );
}

function TaskCard({ task, profiles, onEdit, onDelete }: {
  task: any; profiles: any[]; onEdit: (task: any) => void; onDelete: (task: any) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const prio: Record<string, string> = {
    urgent: "bg-red-500/15 text-red-300",
    high: "bg-amber-500/15 text-amber-300",
    medium: "bg-blue-500/15 text-blue-300",
    low: "bg-slate-500/15 text-slate-300",
  };
  const assignees = (task.task_assignees ?? [])
    .map((a: any) => profiles.find((p) => p.id === a.user_id))
    .filter(Boolean);
  const links: LinkItem[] = Array.isArray(task.links) ? task.links : [];
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={"surface-card group relative cursor-grab p-3 active:cursor-grabbing " + (isDragging ? "opacity-40" : "")}>
      <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onPointerDown={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onEdit(task)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(task)} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="pr-5 text-sm font-medium">{task.title}</div>
      {task.description && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</div>}
      {links.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {links.map((l, i) => (
            <a key={i} href={l.url} target="_blank" rel="noreferrer"
              onPointerDown={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary hover:bg-primary/20">
              <Link2 className="h-2.5 w-2.5" />{l.label}
            </a>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className={"rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider " + prio[task.priority]}>{task.priority}</span>
        <div className="flex items-center gap-2">
          {task.due_date && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />{shortDate(task.due_date)}
            </span>
          )}
          <div className="flex -space-x-1.5">
            {assignees.slice(0, 3).map((a: any) => (
              <Avatar key={a.id} className="h-5 w-5 border border-background">
                <AvatarImage src={a.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/15 text-[9px] text-primary">{initials(a.full_name)}</AvatarFallback>
              </Avatar>
            ))}
            {assignees.length > 3 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-background bg-muted text-[8px]">+{assignees.length - 3}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
