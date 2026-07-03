import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MentionTextarea } from "@/components/ui-extras/mention-textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Video, Plus, ExternalLink, MapPin, Calendar, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-auth";
import { notifyUsers } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/meetings")({
  head: () => ({ meta: [{ title: "Reuniões — Elo Marketing OS" }] }),
  component: MeetingsPage,
});

function toLocalInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MeetingsPage() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const empty = { title: "", client_id: "", start_at: "", end_at: "", meet_link: "", location: "", agenda: "" };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [agendaMentions, setAgendaMentions] = useState<string[]>([]);
  const [active, setActive] = useState<any>(null);
  const [summary, setSummary] = useState("");
  const [summaryMentions, setSummaryMentions] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: meetings } = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => (await supabase.from("meetings").select("*, events(*), clients(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });
  const { data: profiles } = useQuery({
    queryKey: ["team-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, avatar_url").order("full_name")).data ?? [],
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(empty);
    setAgendaMentions([]);
    setOpen(true);
  };

  const openEdit = (m: any) => {
    setEditingId(m.id);
    setForm({
      title: m.events?.title ?? "", client_id: m.client_id ?? "",
      start_at: toLocalInputValue(m.events?.start_at), end_at: toLocalInputValue(m.events?.end_at),
      meet_link: m.events?.meet_link ?? "", location: m.events?.location ?? "", agenda: m.agenda ?? "",
    });
    setAgendaMentions([]);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.start_at) throw new Error("Defina o início");
      const evPayload: any = { title: form.title, type: "meeting", start_at: form.start_at,
        location: form.location || null, meet_link: form.meet_link || null,
        client_id: form.client_id || null };
      evPayload.end_at = form.end_at || null;

      if (editingId) {
        const current = meetings?.find((m: any) => m.id === editingId);
        if (current?.event_id) {
          const { error: eErr } = await supabase.from("events").update(evPayload).eq("id", current.event_id);
          if (eErr) throw eErr;
        }
        const { error: mErr } = await supabase.from("meetings")
          .update({ client_id: form.client_id || null, agenda: form.agenda || null })
          .eq("id", editingId);
        if (mErr) throw mErr;
      } else {
        const { data: ev, error: e1 } = await supabase.from("events").insert(evPayload).select().single();
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("meetings").insert({
          event_id: ev.id, client_id: form.client_id || null, agenda: form.agenda || null, status: "scheduled",
        });
        if (e2) throw e2;
      }
      if (agendaMentions.length > 0) {
        await notifyUsers(agendaMentions, {
          kind: "mention", title: "Você foi mencionado numa reunião", body: form.title, link: "/meetings", excludeUserId: user?.id,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      setOpen(false); setEditingId(null); setForm(empty); setAgendaMentions([]);
      toast.success(editingId ? "Reunião atualizada!" : "Reunião criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveSummary = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meetings").update({ summary, status: "completed" }).eq("id", active.id);
      if (error) throw error;
      if (summaryMentions.length > 0) {
        await notifyUsers(summaryMentions, {
          kind: "mention", title: "Você foi mencionado numa ata de reunião",
          body: active?.events?.title, link: "/meetings", excludeUserId: user?.id,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setActive(null); setSummary(""); setSummaryMentions([]);
      toast.success("Ata salva!");
    },
  });

  const remove = useMutation({
    mutationFn: async (m: any) => {
      if (m.event_id) {
        const { error } = await supabase.from("events").delete().eq("id", m.event_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("meetings").delete().eq("id", m.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      setDeleteTarget(null);
      setActive(null);
      toast.success("Reunião excluída!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="Reuniões"
        description="Agenda, atas, links de Google Meet e participantes."
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(empty); } }}>
            <DialogTrigger asChild><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nova reunião</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Editar reunião" : "Nova reunião"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
                <div><Label>Cliente</Label>
                  <Select value={form.client_id} onValueChange={v => setForm({...form, client_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{(clients ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Início *</Label><Input type="datetime-local" value={form.start_at} onChange={e => setForm({...form, start_at: e.target.value})} /></div>
                  <div><Label>Fim</Label><Input type="datetime-local" value={form.end_at} onChange={e => setForm({...form, end_at: e.target.value})} /></div>
                </div>
                <div><Label>Link Meet/Zoom</Label><Input value={form.meet_link} onChange={e => setForm({...form, meet_link: e.target.value})} placeholder="https://..." /></div>
                <div><Label>Local</Label><Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></div>
                <div>
                  <Label>Pauta / objetivo</Label>
                  <MentionTextarea
                    rows={3}
                    value={form.agenda}
                    onChange={(v) => setForm({...form, agenda: v})}
                    mentionedIds={agendaMentions}
                    onMentionedIdsChange={setAgendaMentions}
                    profiles={profiles ?? []}
                    placeholder="Pauta, objetivo… use @ para mencionar quem precisa saber"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => save.mutate()} disabled={!form.title || !form.start_at || save.isPending}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {(meetings?.length ?? 0) === 0 ? (
        <EmptyState icon={Video} title="Sem reuniões" description="Crie sua primeira reunião e mantenha as atas centralizadas." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {meetings!.map((m: any) => (
            <div key={m.id} className="surface-card group relative p-5 transition hover:border-primary/40 hover:shadow-elegant">
              <div className="absolute right-3 top-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(m)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteTarget(m)} className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <button onClick={() => { setActive(m); setSummary(m.summary ?? ""); }} className="w-full pr-6 text-left">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-semibold">{m.events?.title ?? "Reunião"}</h3>
                    <div className="mt-1 text-xs text-muted-foreground">{m.clients?.name ?? "Interno"}</div>
                  </div>
                  <Badge variant={m.status === "completed" ? "default" : "secondary"} className="capitalize">{m.status}</Badge>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {m.events?.start_at && (
                    <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />
                      {new Date(m.events.start_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </div>
                  )}
                  {m.events?.location && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{m.events.location}</div>}
                  {m.events?.meet_link && (
                    <a href={m.events.meet_link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1.5 text-primary hover:underline"><ExternalLink className="h-3 w-3" />Entrar na chamada</a>
                  )}
                </div>
                {m.agenda && <p className="mt-3 line-clamp-2 border-t border-border/40 pt-2 text-xs text-muted-foreground">{m.agenda}</p>}
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={v => !v && setActive(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{active?.events?.title}</DialogTitle></DialogHeader>
          {active?.agenda && (
            <div>
              <Label className="text-xs uppercase tracking-wider">Pauta</Label>
              <p className="mt-1 whitespace-pre-wrap rounded-md border border-border/50 bg-surface-2 p-3 text-sm">{active.agenda}</p>
            </div>
          )}
          <div>
            <Label>Ata da reunião</Label>
            <MentionTextarea
              rows={8}
              value={summary}
              onChange={setSummary}
              mentionedIds={summaryMentions}
              onMentionedIdsChange={setSummaryMentions}
              profiles={profiles ?? []}
              placeholder="Decisões, próximos passos, responsáveis… use @ para mencionar alguém"
            />
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(active)}>
              <Trash2 className="mr-2 h-4 w-4" />Excluir reunião
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setActive(null)}>Fechar</Button>
              <Button onClick={() => saveSummary.mutate()}>Salvar ata</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir reunião?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir "{deleteTarget?.events?.title ?? "esta reunião"}" permanentemente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(deleteTarget)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
