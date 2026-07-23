import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CalendarClock, Plus, MoreVertical, Pencil, Trash2, MapPin, Link2, ExternalLink,
  Building2, AlertTriangle, Clock, CheckCircle2, CalendarDays,
} from "lucide-react";
import { initials } from "@/lib/format";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-auth";
import { notifyUsers } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/events")({
  head: () => ({ meta: [{ title: "Eventos — Elo Marketing OS" }] }),
  component: EventsPage,
});

const KINDS = [
  { value: "evento", label: "Evento", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  { value: "feira", label: "Feira", color: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  { value: "palestra", label: "Palestra", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  { value: "gravacao", label: "Gravação", color: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
  { value: "reuniao", label: "Reunião", color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  { value: "ativacao", label: "Ativação", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  { value: "viagem", label: "Viagem", color: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
];
const kindMeta = (v: string) => KINDS.find((k) => k.value === v) ?? KINDS[0];

const STATUSES = [
  { value: "planned", label: "Planejado" },
  { value: "confirmed", label: "Confirmado" },
  { value: "done", label: "Concluído" },
  { value: "canceled", label: "Cancelado" },
];
const statusLabel = (v: string) => STATUSES.find((s) => s.value === v)?.label ?? v;

const emptyForm = {
  title: "", description: "", kind: "evento", location: "", link: "",
  responsible_id: "", client_id: "", starts_at: "", ends_at: "", status: "confirmed",
};

const fmtDateTime = (iso: string, allDay: boolean) =>
  new Date(iso).toLocaleString("pt-BR", allDay
    ? { day: "2-digit", month: "long", weekday: "short" }
    : { day: "2-digit", month: "long", weekday: "short", hour: "2-digit", minute: "2-digit" });

// Contagem regressiva amigável até o evento.
function countdown(startsAt: string): { text: string; soon: boolean; now: boolean; past: boolean } {
  const diff = new Date(startsAt).getTime() - Date.now();
  const past = diff < -3 * 3600_000; // já passou (com 3h de folga)
  const now = diff <= 0 && !past;
  const h = diff / 3600_000;
  const d = Math.floor(h / 24);
  let text: string;
  if (past) text = "Encerrado";
  else if (now) text = "Acontecendo agora";
  else if (h < 1) text = `Em ${Math.max(1, Math.round(diff / 60000))} min`;
  else if (h < 24) text = `Em ${Math.round(h)}h`;
  else if (d === 1) text = "Amanhã";
  else text = `Em ${d} dias`;
  return { text, soon: !past && !now && h <= 48, now, past };
}

function EventsPage() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [allDay, setAllDay] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: eventsData } = useQuery({
    queryKey: ["elo-events"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("elo_events").select("*").order("starts_at", { ascending: true });
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) return { rows: [] as any[], missing: true };
        throw error;
      }
      return { rows: (data ?? []) as any[], missing: false };
    },
  });
  const events = useMemo(() => eventsData?.rows ?? [], [eventsData]);
  const missing = eventsData?.missing ?? false;

  const { data: profiles } = useQuery({
    queryKey: ["team-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, avatar_url").order("full_name")).data ?? [],
  });
  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, name, company").order("name")).data ?? [],
  });
  const profileById = (id?: string | null) => profiles?.find((p: any) => p.id === id);
  const clientById = (id?: string | null) => clients?.find((c: any) => c.id === id);

  useEffect(() => {
    const channel = supabase
      .channel("elo-events-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "elo_events" }, () => qc.invalidateQueries({ queryKey: ["elo-events"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const upcoming = useMemo(
    () => events.filter((e: any) => e.status !== "canceled" && !countdown(e.starts_at).past),
    [events],
  );
  const past = useMemo(
    () => events.filter((e: any) => e.status !== "canceled" && countdown(e.starts_at).past),
    [events],
  );
  const soonest = upcoming[0];

  // Avisa uma vez por dia se há evento nas próximas 48h.
  useEffect(() => {
    if (!user || !eventsData || missing) return;
    const soon = upcoming.filter((e: any) => countdown(e.starts_at).soon);
    if (soon.length === 0) return;
    const key = `elo-events-alert-${new Date().toISOString().slice(0, 10)}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    notifyUsers([user.id], {
      kind: "meeting",
      title: soon.length === 1 ? "Evento chegando!" : `${soon.length} eventos chegando`,
      body: soon.length === 1 ? `${soon[0].title} — ${countdown(soon[0].starts_at).text.toLowerCase()}` : "Confira a agenda de eventos da Elo.",
      link: "/events",
    });
  }, [user, eventsData, missing, upcoming]);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setAllDay(false); setOpen(true); };
  const openEdit = (e: any) => {
    setEditingId(e.id);
    setForm({
      title: e.title ?? "", description: e.description ?? "", kind: e.kind ?? "evento",
      location: e.location ?? "", link: e.link ?? "", responsible_id: e.responsible_id ?? "",
      client_id: e.client_id ?? "", starts_at: e.starts_at ? e.starts_at.slice(0, 16) : "",
      ends_at: e.ends_at ? e.ends_at.slice(0, 16) : "", status: e.status ?? "confirmed",
    });
    setAllDay(Boolean(e.all_day));
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Dê um nome ao evento");
      if (!form.starts_at) throw new Error("Defina a data de início");
      const payload: any = {
        title: form.title.trim(),
        description: form.description || null,
        kind: form.kind,
        location: form.location || null,
        link: form.link || null,
        responsible_id: form.responsible_id || null,
        client_id: form.client_id || null,
        starts_at: form.starts_at,
        ends_at: form.ends_at || null,
        all_day: allDay,
        status: form.status,
      };
      if (editingId) {
        const { error } = await (supabase as any).from("elo_events").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("elo_events").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
      // Avisa o responsável (se não for você mesmo).
      if (form.responsible_id && form.responsible_id !== user?.id) {
        await notifyUsers([form.responsible_id], {
          kind: "meeting", title: "Você é responsável por um evento", body: form.title, link: "/events", excludeUserId: user?.id,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elo-events"] });
      setOpen(false); setEditingId(null); setForm(emptyForm);
      toast.success(editingId ? "Evento atualizado!" : "Evento criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("elo_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["elo-events"] }); setDeleteTarget(null); toast.success("Evento excluído!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Agência"
        title="Eventos"
        description="A agenda de eventos da Elo — feiras, gravações, palestras e tudo que o time vai participar."
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
            <DialogTrigger asChild><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo evento</Button></DialogTrigger>
            <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? "Editar evento" : "Novo evento"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome do evento *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Feira do Empreendedor 2026" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Tipo</Label>
                    <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Início *</Label><Input type={allDay ? "date" : "datetime-local"} value={allDay ? form.starts_at.slice(0, 10) : form.starts_at} onChange={(e) => setForm({ ...form, starts_at: allDay ? `${e.target.value}T00:00` : e.target.value })} /></div>
                  <div><Label>Fim</Label><Input type={allDay ? "date" : "datetime-local"} value={allDay ? form.ends_at.slice(0, 10) : form.ends_at} onChange={(e) => setForm({ ...form, ends_at: allDay ? `${e.target.value}T23:59` : e.target.value })} /></div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4" />
                  Dia inteiro (sem horário)
                </label>
                <div><Label>Local</Label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Centro de Eventos, online, endereço…" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Responsável</Label>
                    <Select value={form.responsible_id || "none"} onValueChange={(v) => setForm({ ...form, responsible_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Ninguém" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ninguém</SelectItem>
                        {(profiles ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Cliente</Label>
                    <Select value={form.client_id || "none"} onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {(clients ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Link (inscrição, mapa, briefing…)</Label>
                  <div className="relative">
                    <Link2 className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://…" />
                  </div>
                </div>
                <div><Label>Descrição</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhes, agenda, o que levar…" /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {missing && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Para usar Eventos, aplique a migração <strong>20260723120000_elo_events.sql</strong> no Supabase. A página abre normalmente enquanto isso.
        </div>
      )}

      {/* Destaque do próximo evento */}
      {soonest && (() => {
        const cd = countdown(soonest.starts_at);
        const km = kindMeta(soonest.kind);
        const owner = profileById(soonest.responsible_id);
        return (
          <div className={"surface-card mb-5 overflow-hidden p-0"}>
            <div className={"flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3 " + (cd.soon || cd.now ? "bg-amber-500/10" : "bg-primary/5")}>
              <div className="flex items-center gap-2 text-sm font-medium">
                {cd.now ? <Clock className="h-4 w-4 text-amber-400" /> : <CalendarClock className="h-4 w-4 text-primary" />}
                Próximo evento
              </div>
              <Badge variant="outline" className={"gap-1 " + (cd.soon || cd.now ? "border-amber-500/40 bg-amber-500/15 text-amber-300" : "")}>
                {cd.text}
              </Badge>
            </div>
            <button onClick={() => openEdit(soonest)} className="block w-full p-5 text-left transition hover:bg-accent/30">
              <div className="mb-1.5 flex items-center gap-2">
                <Badge variant="outline" className={km.color}>{km.label}</Badge>
                <span className="text-[11px] text-muted-foreground">{statusLabel(soonest.status)}</span>
              </div>
              <div className="font-display text-xl font-semibold">{soonest.title}</div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{fmtDateTime(soonest.starts_at, soonest.all_day)}</span>
                {soonest.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{soonest.location}</span>}
                {clientById(soonest.client_id) && <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{clientById(soonest.client_id)?.company || clientById(soonest.client_id)?.name}</span>}
                {owner && (
                  <span className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5">
                      {owner.avatar_url && <AvatarImage src={owner.avatar_url} alt="" />}
                      <AvatarFallback className="bg-primary/15 text-[8px] text-primary">{initials(owner.full_name ?? owner.email)}</AvatarFallback>
                    </Avatar>
                    {owner.full_name ?? owner.email}
                  </span>
                )}
              </div>
            </button>
          </div>
        );
      })()}

      {events.length === 0 && !missing ? (
        <EmptyState icon={CalendarClock} title="Nenhum evento ainda" description="Crie o primeiro evento que a Elo vai participar — feira, gravação, palestra…" />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <Section title="Próximos" count={upcoming.length}>
              {upcoming.map((e: any) => (
                <EventCard key={e.id} event={e} owner={profileById(e.responsible_id)} client={clientById(e.client_id)} onEdit={openEdit} onDelete={setDeleteTarget} />
              ))}
            </Section>
          )}
          {past.length > 0 && (
            <Section title="Já aconteceram" count={past.length}>
              {past.map((e: any) => (
                <EventCard key={e.id} event={e} owner={profileById(e.responsible_id)} client={clientById(e.client_id)} onEdit={openEdit} onDelete={setDeleteTarget} dim />
              ))}
            </Section>
          )}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
            <AlertDialogDescription>Isso vai excluir "{deleteTarget?.title}" permanentemente. Essa ação não pode ser desfeita.</AlertDialogDescription>
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

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{count}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  );
}

function EventCard({ event, owner, client, onEdit, onDelete, dim }: {
  event: any; owner: any; client: any; onEdit: (e: any) => void; onDelete: (e: any) => void; dim?: boolean;
}) {
  const cd = countdown(event.starts_at);
  const km = kindMeta(event.kind);
  return (
    <div className={"surface-card group relative p-4 transition hover:-translate-y-0.5 hover:shadow-elegant " + (dim ? "opacity-70" : "")}>
      <div className="absolute right-2.5 top-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100"><MoreVertical className="h-4 w-4" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(event)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(event)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" />Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <button onClick={() => onEdit(event)} className="block w-full pr-5 text-left">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Badge variant="outline" className={"text-[10px] " + km.color}>{km.label}</Badge>
          {event.status === "done" ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle2 className="h-3 w-3" />Concluído</span>
          ) : (
            <Badge variant="outline" className={"gap-1 text-[10px] " + (cd.soon || cd.now ? "border-amber-500/40 bg-amber-500/15 text-amber-300" : "")}>
              {cd.text}
            </Badge>
          )}
        </div>
        <div className="font-display text-base font-semibold leading-tight">{event.title}</div>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5"><CalendarDays className="h-3 w-3 shrink-0" />{fmtDateTime(event.starts_at, event.all_day)}</div>
          {event.location && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{event.location}</span></div>}
          {client && <div className="flex items-center gap-1.5"><Building2 className="h-3 w-3 shrink-0" /><span className="truncate">{client.company || client.name}</span></div>}
        </div>
      </button>

      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
        {owner ? (
          <div className="flex items-center gap-1.5" title={owner.full_name ?? owner.email}>
            <Avatar className="h-5 w-5">
              {owner.avatar_url && <AvatarImage src={owner.avatar_url} alt="" />}
              <AvatarFallback className="bg-primary/15 text-[8px] text-primary">{initials(owner.full_name ?? owner.email)}</AvatarFallback>
            </Avatar>
            <span className="max-w-[110px] truncate text-[10px] text-muted-foreground">{owner.full_name ?? owner.email}</span>
          </div>
        ) : <span className="text-[10px] text-muted-foreground">Sem responsável</span>}
        {event.link && (
          <a href={event.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-[10px] text-primary hover:underline">
            Abrir link <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
