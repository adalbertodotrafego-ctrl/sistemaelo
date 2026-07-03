import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MentionTextarea } from "@/components/ui-extras/mention-textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2, Tag as TagIcon, Pencil, CalendarRange, Link2, Unlink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  beginGoogleCalendarConnect, disconnectGoogleCalendar, getGoogleCalendarStatus,
  syncGoogleCalendarNow, deleteCalendarEvent,
} from "@/lib/google-calendar.functions";
import { useCurrentUser } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { notifyUsers } from "@/lib/notifications";
import { initials } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendário — Elo Marketing OS" }] }),
  component: CalendarPage,
});

const emptyEventForm = { title: "", type: "event", start_at: "", end_at: "", location: "", notes: "", completed: false };

function toLocalInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function fmtISO(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

const emptyWeekForm = { title: "", description: "", day_of_week: 1, start_time: "", end_time: "", tag_id: "" };

function CalendarPage() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [view, setView] = useState<"month" | "week">("month");

  // ---- Google Calendar connection ----
  const getStatus = useServerFn(getGoogleCalendarStatus);
  const beginConnect = useServerFn(beginGoogleCalendarConnect);
  const disconnect = useServerFn(disconnectGoogleCalendar);
  const runSync = useServerFn(syncGoogleCalendarNow);
  const deleteEventEverywhere = useServerFn(deleteCalendarEvent);

  const { data: googleStatus } = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: () => getStatus(),
  });

  const connectGoogle = useMutation({
    mutationFn: async () => beginConnect({ data: { redirectUri: `${window.location.origin}/google-calendar-callback` } }),
    onSuccess: (r) => { window.location.href = r.authUrl; },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectGoogle = useMutation({
    mutationFn: async () => disconnect(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["google-calendar-status"] }); toast.success("Google Calendar desconectado."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const manualSync = useMutation({
    mutationFn: async () => runSync(),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success(`Sincronizado: ${r.pushed} enviado(s), ${r.pulled} recebido(s).`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const backgroundSync = async () => {
    if (!googleStatus?.connected) return;
    try {
      await runSync();
      qc.invalidateQueries({ queryKey: ["events"] });
    } catch {
      // silent — the manual "Sincronizar" button surfaces real errors
    }
  };

  // Keeps the month view close to real-time with Google without needing webhooks.
  useEffect(() => {
    if (!googleStatus?.connected || view !== "month") return;
    const id = setInterval(() => { backgroundSync(); }, 3 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleStatus?.connected, view]);

  // ---- Month view state ----
  const { isAdmin } = usePermissions();
  const [cursor, setCursor] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyEventForm);
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [viewUserId, setViewUserId] = useState<string>("me");

  const { data: profiles } = useQuery({
    queryKey: ["team-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, avatar_url").order("full_name")).data ?? [],
  });

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const startWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  const { data: rawEvents } = useQuery({
    queryKey: ["events", cursor.getFullYear(), cursor.getMonth()],
    queryFn: async () => {
      const { data } = await (supabase as any).from("events").select("*, event_participants(user_id)")
        .gte("start_at", monthStart.toISOString())
        .lte("start_at", new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate(), 23,59).toISOString());
      return data ?? [];
    },
  });

  const effectiveViewerId = viewUserId === "me" ? user?.id : viewUserId;
  const events = (rawEvents ?? []).filter((e: any) => {
    if (!effectiveViewerId) return true;
    const participantIds = (e.event_participants ?? []).map((p: any) => p.user_id);
    return e.created_by === effectiveViewerId || participantIds.includes(effectiveViewerId);
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyEventForm);
    setMentionedIds(user?.id ? [user.id] : []);
    setOpen(true);
  };

  const openEdit = (ev: any) => {
    setEditingId(ev.id);
    setForm({
      title: ev.title ?? "", type: ev.type ?? "event",
      start_at: toLocalInputValue(ev.start_at), end_at: toLocalInputValue(ev.end_at),
      location: ev.location ?? "", notes: ev.notes ?? "", completed: !!ev.completed,
    });
    setMentionedIds((ev.event_participants ?? []).map((p: any) => p.user_id));
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.start_at) throw new Error("Defina o início");
      const payload: any = { ...form };
      // datetime-local gives a naive "YYYY-MM-DDTHH:mm" string; new Date() parses that
      // as local time, so converting to ISO here stores the instant you actually picked.
      payload.start_at = new Date(payload.start_at).toISOString();
      payload.end_at = payload.end_at ? new Date(payload.end_at).toISOString() : null;
      const prevEvent = editingId ? rawEvents?.find((e: any) => e.id === editingId) : null;
      const prevCompleted = !!prevEvent?.completed;
      const prevParticipants: string[] = (prevEvent?.event_participants ?? []).map((p: any) => p.user_id);
      let eventId = editingId;
      if (editingId) {
        const { error } = await supabase.from("events").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { data, error } = await supabase.from("events").insert(payload).select().single();
        if (error) throw error;
        eventId = data.id;
      }

      await (supabase as any).from("event_participants").delete().eq("event_id", eventId);
      if (mentionedIds.length > 0) {
        await (supabase as any).from("event_participants").insert(mentionedIds.map((user_id) => ({ event_id: eventId, user_id })));
      }
      const newlyMentioned = mentionedIds.filter((id) => !prevParticipants.includes(id));
      if (newlyMentioned.length > 0) {
        await notifyUsers(newlyMentioned, {
          kind: "mention", title: "Você foi adicionado a um evento", body: form.title, link: "/calendar", excludeUserId: user?.id,
        });
      }
      if (editingId && form.completed !== prevCompleted) {
        await notifyUsers([...mentionedIds, prevEvent?.created_by].filter(Boolean), {
          kind: form.completed ? "success" : "info",
          title: form.completed ? "Evento concluído" : "Evento reaberto",
          body: `"${form.title}" foi marcado como ${form.completed ? "concluído" : "não concluído"}.`,
          link: "/calendar",
          excludeUserId: user?.id,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      setOpen(false);
      setEditingId(null);
      setForm(emptyEventForm);
      setMentionedIds([]);
      toast.success(editingId ? "Evento atualizado!" : "Evento criado!");
      backgroundSync();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteEventEverywhere({ data: { id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setDeleteTarget(null);
      setOpen(false);
      toast.success("Evento excluído!");
      backgroundSync();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cells: { day: number | null; date?: Date }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, date: new Date(cursor.getFullYear(), cursor.getMonth(), d) });
  while (cells.length % 7 !== 0) cells.push({ day: null });

  const eventsByDay = new Map<number, any[]>();
  (events ?? []).forEach((e: any) => {
    const d = new Date(e.start_at).getDate();
    eventsByDay.set(d, [...(eventsByDay.get(d) ?? []), e]);
  });

  const typeColor: Record<string, string> = {
    meeting: "bg-purple-500/20 text-purple-300",
    delivery: "bg-emerald-500/20 text-emerald-300",
    campaign: "bg-blue-500/20 text-blue-300",
    reminder: "bg-amber-500/20 text-amber-300",
    event: "bg-primary/20 text-primary",
  };

  // ---- Week view state ----
  const [weekCursor, setWeekCursor] = useState(startOfWeek(new Date()));
  const weekStart = fmtISO(weekCursor);
  const [weekOpen, setWeekOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [weekEditing, setWeekEditing] = useState<any | null>(null);
  const [weekForm, setWeekForm] = useState<any>(emptyWeekForm);

  const { data: tags } = useQuery({
    queryKey: ["schedule-tags"],
    queryFn: async () => (await supabase.from("schedule_tags").select("*").order("name")).data ?? [],
  });

  const { data: weekItems } = useQuery({
    queryKey: ["week-items", weekStart],
    queryFn: async () => (await supabase.from("week_items").select("*").eq("week_start", weekStart).order("start_time")).data ?? [],
  });

  const saveWeekItem = useMutation({
    mutationFn: async () => {
      const payload: any = {
        ...weekForm,
        week_start: weekStart,
        day_of_week: Number(weekForm.day_of_week),
        tag_id: weekForm.tag_id || null,
        start_time: weekForm.start_time || null,
        end_time: weekForm.end_time || null,
        created_by: user?.id,
      };
      if (weekEditing?.id) {
        const { error } = await supabase.from("week_items").update(payload).eq("id", weekEditing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("week_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["week-items"] });
      setWeekOpen(false); setWeekEditing(null); setWeekForm(emptyWeekForm);
      toast.success("Cronograma salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeWeekItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("week_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["week-items"] }); toast.success("Removido"); },
  });

  const startEditWeekItem = (it: any) => {
    setWeekEditing(it);
    setWeekForm({
      title: it.title, description: it.description ?? "",
      day_of_week: it.day_of_week, start_time: it.start_time ?? "",
      end_time: it.end_time ?? "", tag_id: it.tag_id ?? "",
    });
    setWeekOpen(true);
  };

  const byDay: Record<number, any[]> = {};
  DAYS.forEach((_, i) => byDay[i] = []);
  (weekItems ?? []).forEach((it: any) => { byDay[it.day_of_week].push(it); });

  return (
    <Tabs value={view} onValueChange={(v) => setView(v as "month" | "week")}>
      <PageHeader
        eyebrow="Operação"
        title="Calendário"
        description={view === "month"
          ? "Reuniões, entregas, campanhas e lembretes em um só lugar."
          : "Organize a semana toda com blocos, tags coloridas e descrição por atividade."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <TabsList>
              <TabsTrigger value="month">Mês</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
            </TabsList>

            {view === "month" ? (
              <>
                {isAdmin && (
                  <Select value={viewUserId} onValueChange={setViewUserId}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="me">Meu calendário</SelectItem>
                      {profiles?.filter((p: any) => p.id !== user?.id).map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {googleStatus?.connected ? (
                  <div className="surface-card flex items-center gap-1.5 p-1 pl-3 text-xs text-muted-foreground">
                    <span className="max-w-[140px] truncate">{googleStatus.email}</span>
                    <Button size="sm" variant="ghost" onClick={() => manualSync.mutate()} disabled={manualSync.isPending} className="h-7 px-2">
                      <RefreshCw className={"h-3.5 w-3.5 " + (manualSync.isPending ? "animate-spin" : "")} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => disconnectGoogle.mutate()} disabled={disconnectGoogle.isPending} className="h-7 px-2 text-destructive hover:text-destructive">
                      <Unlink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => connectGoogle.mutate()} disabled={connectGoogle.isPending}>
                    <Link2 className="mr-2 h-4 w-4" />
                    {connectGoogle.isPending ? "Conectando..." : "Conectar Google Calendar"}
                  </Button>
                )}
                <div className="surface-card flex items-center gap-1 p-1">
                  <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded p-1.5 hover:bg-accent">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-[140px] px-2 text-center text-sm font-medium capitalize">
                    {cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                  </div>
                  <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded p-1.5 hover:bg-accent">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyEventForm); setMentionedIds([]); } }}>
                  <DialogTrigger asChild><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo evento</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{editingId ? "Editar evento" : "Novo evento"}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Tipo</Label>
                          <Select value={form.type} onValueChange={(v) => setForm({...form, type: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="meeting">Reunião</SelectItem>
                              <SelectItem value="delivery">Entrega</SelectItem>
                              <SelectItem value="campaign">Campanha</SelectItem>
                              <SelectItem value="reminder">Lembrete</SelectItem>
                              <SelectItem value="event">Evento</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div><Label>Local</Label><Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Início *</Label><Input type="datetime-local" value={form.start_at} onChange={e => setForm({...form, start_at: e.target.value})} /></div>
                        <div><Label>Fim</Label><Input type="datetime-local" value={form.end_at} onChange={e => setForm({...form, end_at: e.target.value})} /></div>
                      </div>
                      <div>
                        <Label>Descrição</Label>
                        <MentionTextarea
                          value={form.notes}
                          onChange={(v) => setForm({ ...form, notes: v })}
                          mentionedIds={mentionedIds}
                          onMentionedIdsChange={setMentionedIds}
                          profiles={profiles ?? []}
                          rows={3}
                          placeholder="Detalhes do evento… use @ para mencionar participantes"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={form.completed} onCheckedChange={(v) => setForm({ ...form, completed: !!v })} />
                        Marcar como concluído
                      </label>
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
                        <Button onClick={() => save.mutate()} disabled={!form.title || !form.start_at || save.isPending}>Salvar</Button>
                      </div>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <>
                <div className="surface-card flex items-center gap-1 p-1">
                  <button onClick={() => setWeekCursor(addDays(weekCursor, -7))} className="rounded p-1.5 hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
                  <div className="min-w-[180px] px-2 text-center text-sm font-medium">
                    {weekCursor.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – {addDays(weekCursor, 6).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </div>
                  <button onClick={() => setWeekCursor(addDays(weekCursor, 7))} className="rounded p-1.5 hover:bg-accent"><ChevronRight className="h-4 w-4" /></button>
                </div>
                <Button variant="outline" onClick={() => setTagsOpen(true)}><TagIcon className="mr-2 h-4 w-4" />Tags</Button>
                <Button onClick={() => { setWeekEditing(null); setWeekForm(emptyWeekForm); setWeekOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" />Adicionar
                </Button>
              </>
            )}
          </div>
        }
      />

      <TabsContent value="month" className="mt-0">
        <div className="surface-card overflow-hidden p-4">
          <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d => <div key={d} className="px-2 py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              const today = c.date && c.date.toDateString() === new Date().toDateString();
              const evs = c.day ? (eventsByDay.get(c.day) ?? []) : [];
              return (
                <div key={i} className={"min-h-[100px] rounded-md border border-border/40 p-1.5 " + (c.day ? "bg-surface/30" : "opacity-30")}>
                  {c.day && (
                    <>
                      <div className={"mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs " + (today ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground")}>
                        {c.day}
                      </div>
                      <div className="space-y-1">
                        {evs.slice(0,3).map((e: any) => (
                          <button key={e.id} onClick={() => openEdit(e)}
                            className={"flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[10px] hover:opacity-80 " + typeColor[e.type] + (e.completed ? " opacity-50 line-through" : "")}>
                            {e.completed && <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />}
                            <span className="truncate">{e.title}</span>
                          </button>
                        ))}
                        {evs.length > 3 && <div className="text-[10px] text-muted-foreground">+{evs.length - 3} mais</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
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
      </TabsContent>

      <TabsContent value="week" className="mt-0">
        {(!weekItems || weekItems.length === 0) ? (
          <EmptyState icon={CalendarRange} title="Nenhum bloco esta semana" description="Comece adicionando compromissos, entregas ou rituais." />
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-7">
          {DAYS.map((label, idx) => (
            <div key={idx} className="surface-card p-3">
              <div className="mb-3 flex items-baseline justify-between">
                <div className="font-display text-sm font-semibold">{label}</div>
                <div className="text-[10px] text-muted-foreground">{addDays(weekCursor, idx).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</div>
              </div>
              <div className="space-y-2">
                {byDay[idx].map((it: any) => {
                  const tag = tags?.find((t: any) => t.id === it.tag_id);
                  return (
                    <div key={it.id} className="group rounded-lg border border-border/60 bg-surface/40 p-2.5">
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          {tag && (
                            <span className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: tag.color + "33", color: tag.color }}>
                              {tag.name}
                            </span>
                          )}
                          <div className="truncate text-sm font-medium">{it.title}</div>
                          {(it.start_time || it.end_time) && (
                            <div className="text-[11px] text-muted-foreground">{it.start_time?.slice(0,5) ?? ""}{it.end_time ? ` – ${it.end_time.slice(0,5)}` : ""}</div>
                          )}
                          {it.description && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{it.description}</div>}
                        </div>
                        <div className="flex opacity-0 transition group-hover:opacity-100">
                          <button onClick={() => startEditWeekItem(it)} className="rounded p-1 hover:bg-accent"><Pencil className="h-3 w-3" /></button>
                          <button onClick={() => removeWeekItem.mutate(it.id)} className="rounded p-1 hover:bg-accent"><Trash2 className="h-3 w-3 text-destructive" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <Dialog open={weekOpen} onOpenChange={(v) => { setWeekOpen(v); if (!v) { setWeekEditing(null); setWeekForm(emptyWeekForm); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{weekEditing ? "Editar bloco" : "Novo bloco"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Título *</Label><Input value={weekForm.title} onChange={e => setWeekForm({...weekForm, title: e.target.value})} /></div>
              <div><Label>Descrição</Label><Textarea value={weekForm.description} rows={3} onChange={e => setWeekForm({...weekForm, description: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Dia</Label>
                  <Select value={String(weekForm.day_of_week)} onValueChange={(v) => setWeekForm({...weekForm, day_of_week: Number(v)})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tag</Label>
                  <Select value={weekForm.tag_id || "none"} onValueChange={(v) => setWeekForm({...weekForm, tag_id: v === "none" ? "" : v})}>
                    <SelectTrigger><SelectValue placeholder="Sem tag" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem tag</SelectItem>
                      {tags?.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ backgroundColor: t.color }} />{t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Início</Label><Input type="time" value={weekForm.start_time} onChange={e => setWeekForm({...weekForm, start_time: e.target.value})} /></div>
                <div><Label>Fim</Label><Input type="time" value={weekForm.end_time} onChange={e => setWeekForm({...weekForm, end_time: e.target.value})} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setWeekOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveWeekItem.mutate()} disabled={!weekForm.title || saveWeekItem.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TagsDialog open={tagsOpen} onOpenChange={setTagsOpen} tags={tags ?? []} />
      </TabsContent>
    </Tabs>
  );
}

function TagsDialog({ open, onOpenChange, tags }: { open: boolean; onOpenChange: (v: boolean) => void; tags: any[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2563EB");

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nome obrigatório");
      const { error } = await supabase.from("schedule_tags").insert({ name, color });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule-tags"] }); setName(""); toast.success("Tag criada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, name, color }: any) => {
      const { error } = await supabase.from("schedule_tags").update({ name, color }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule-tags"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule-tags"] }); qc.invalidateQueries({ queryKey: ["week-items"] }); toast.success("Tag removida"); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Gerenciar tags</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {tags.map((t: any) => (
            <TagRow key={t.id} tag={t} onSave={(name, color) => update.mutate({ id: t.id, name, color })} onDelete={() => remove.mutate(t.id)} />
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-border/60 p-3">
          <Label className="text-xs">Nova tag</Label>
          <div className="mt-2 flex gap-2">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Estratégia" />
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-border/60 bg-transparent" />
            <Button onClick={() => add.mutate()}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TagRow({ tag, onSave, onDelete }: { tag: any; onSave: (name: string, color: string) => void; onDelete: () => void }) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const dirty = name !== tag.name || color !== tag.color;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 p-2">
      <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-border/60 bg-transparent" />
      <Input value={name} onChange={e => setName(e.target.value)} className="h-8 flex-1" />
      {dirty && <Button size="sm" onClick={() => onSave(name, color)}>Salvar</Button>}
      <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
    </div>
  );
}
