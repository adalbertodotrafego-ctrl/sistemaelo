import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MentionTextarea } from "@/components/ui-extras/mention-textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, GripVertical, MoreVertical, Pencil, Trash2, Search, UserPlus,
  DollarSign, Trophy, Target, Percent, Wifi, Tag, AlertTriangle, Clock,
  RotateCcw, X, CalendarClock, Bell,
} from "lucide-react";
import { brl, initials } from "@/lib/format";
import { toast } from "sonner";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, useDraggable, useDroppable,
} from "@dnd-kit/core";
import { useCurrentUser } from "@/hooks/use-auth";
import { notifyUsers } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM — Elo Marketing OS" }] }),
  component: CRMBoard,
});

const STAGES = [
  { id: "lead", label: "Lead", color: "bg-slate-500/15 text-slate-300" },
  { id: "contact", label: "Contato", color: "bg-blue-500/15 text-blue-300" },
  { id: "meeting", label: "Reunião", color: "bg-purple-500/15 text-purple-300" },
  { id: "proposal", label: "Proposta", color: "bg-amber-500/15 text-amber-300" },
  { id: "negotiation", label: "Negociação", color: "bg-orange-500/15 text-orange-300" },
  { id: "won", label: "Ganho", color: "bg-emerald-500/15 text-emerald-300" },
  { id: "lost", label: "Perdido", color: "bg-red-500/15 text-red-300" },
] as const;

const OPEN_STAGES = ["lead", "contact", "meeting", "proposal", "negotiation"];
const STUCK_DAYS = 7; // dias sem movimento para um lead virar "parado"

// Paleta fixa das etiquetas — cada cor tem o chip (fundo/texto) e o hex da barra do card.
const LABEL_PALETTE = [
  { key: "red", label: "Vermelho", dot: "bg-red-500", chip: "bg-red-500/15 text-red-300 border-red-500/30", hex: "#ef4444" },
  { key: "amber", label: "Âmbar", dot: "bg-amber-500", chip: "bg-amber-500/15 text-amber-300 border-amber-500/30", hex: "#f59e0b" },
  { key: "green", label: "Verde", dot: "bg-emerald-500", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", hex: "#10b981" },
  { key: "blue", label: "Azul", dot: "bg-blue-500", chip: "bg-blue-500/15 text-blue-300 border-blue-500/30", hex: "#3b82f6" },
  { key: "purple", label: "Roxo", dot: "bg-purple-500", chip: "bg-purple-500/15 text-purple-300 border-purple-500/30", hex: "#a855f7" },
  { key: "pink", label: "Rosa", dot: "bg-pink-500", chip: "bg-pink-500/15 text-pink-300 border-pink-500/30", hex: "#ec4899" },
  { key: "cyan", label: "Ciano", dot: "bg-cyan-500", chip: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30", hex: "#06b6d4" },
  { key: "slate", label: "Cinza", dot: "bg-slate-500", chip: "bg-slate-500/15 text-slate-300 border-slate-500/30", hex: "#64748b" },
];
const paletteByKey = (k?: string) => LABEL_PALETTE.find((p) => p.key === k) ?? LABEL_PALETTE[3];

const emptyForm = {
  name: "", company: "", source: "", value_expected: "", contact: "", email: "", phone: "",
  stage: "lead", notes: "", next_action_at: "",
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function daysSince(iso?: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
const fmtDay = (d?: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "");

function CRMBoard() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formLabels, setFormLabels] = useState<string[]>([]);
  const [notesMentions, setNotesMentions] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [convertTarget, setConvertTarget] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(false);
  const [alertFilter, setAlertFilter] = useState<"stuck" | "followup" | "lost" | null>(null);
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [newLabel, setNewLabel] = useState({ name: "", color: "blue" });

  const { data: leads } = useQuery({
    queryKey: ["crm-leads"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_leads").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["team-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, avatar_url").order("full_name")).data ?? [],
  });

  // Etiquetas — tabela pode não existir ainda (migração não aplicada): degrada sem quebrar.
  const { data: labelsData } = useQuery({
    queryKey: ["crm-labels"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("crm_labels").select("*").order("created_at");
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) return { rows: [] as any[], missing: true };
        throw error;
      }
      return { rows: (data ?? []) as any[], missing: false };
    },
  });
  const labels = labelsData?.rows ?? [];
  const labelsReady = !(labelsData?.missing ?? false);
  const labelById = (id: string) => labels.find((l: any) => l.id === id);

  useEffect(() => {
    const channel = supabase
      .channel("crm-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_leads" }, () => qc.invalidateQueries({ queryKey: ["crm-leads"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_labels" }, () => qc.invalidateQueries({ queryKey: ["crm-labels"] }))
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const move = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from("crm_leads").update({ stage } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-leads"] }),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormLabels([]);
    setNotesMentions([]);
    setOpen(true);
  };

  const openEdit = (lead: any) => {
    setEditingId(lead.id);
    setForm({
      name: lead.name ?? "", company: lead.company ?? "", source: lead.source ?? "",
      value_expected: lead.value_expected != null ? String(lead.value_expected) : "",
      contact: lead.contact ?? "", email: lead.email ?? "", phone: lead.phone ?? "",
      stage: lead.stage ?? "lead", notes: lead.notes ?? "",
      next_action_at: lead.next_action_at ?? "",
    });
    setFormLabels(Array.isArray(lead.label_ids) ? lead.label_ids : []);
    setNotesMentions([]);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name, company: form.company, source: form.source, contact: form.contact,
        email: form.email || null, phone: form.phone || null, stage: form.stage, notes: form.notes,
        value_expected: form.value_expected ? Number(form.value_expected) : 0,
      };
      if (labelsReady) {
        payload.label_ids = formLabels;
        payload.next_action_at = form.next_action_at || null;
      }
      if (editingId) {
        const { error } = await supabase.from("crm_leads").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("crm_leads").insert(payload);
        if (error) throw error;
      }
      if (notesMentions.length > 0) {
        await notifyUsers(notesMentions, {
          kind: "mention", title: "Você foi mencionado num lead do CRM", body: form.name, link: "/crm", excludeUserId: user?.id,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      setOpen(false); setEditingId(null); setForm(emptyForm); setFormLabels([]); setNotesMentions([]);
      toast.success(editingId ? "Lead atualizado!" : "Lead adicionado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      setDeleteTarget(null);
      toast.success("Lead excluído!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convert = useMutation({
    mutationFn: async (lead: any) => {
      const { data: existing } = await supabase.from("clients").select("id").eq("name", lead.name).limit(1).maybeSingle();
      if (existing) throw new Error("Já existe um cliente com esse nome.");
      const { error } = await supabase.from("clients").insert({
        name: lead.name, company: lead.company || null, email: lead.email || null,
        phone: lead.contact || lead.phone || null,
        monthly_value: lead.value_expected ? Number(lead.value_expected) : 0,
        status: "active", notes: lead.notes || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setConvertTarget(null);
      toast.success("Lead convertido em cliente! Veja na aba Clientes.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Etiquetas ----
  const createLabel = useMutation({
    mutationFn: async () => {
      if (!newLabel.name.trim()) throw new Error("Dê um nome à etiqueta");
      const { error } = await (supabase as any).from("crm_labels").insert({ name: newLabel.name.trim(), color: newLabel.color, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-labels"] }); setNewLabel({ name: "", color: "blue" }); toast.success("Etiqueta criada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteLabel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("crm_labels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-labels"] }); qc.invalidateQueries({ queryKey: ["crm-leads"] }); toast.success("Etiqueta excluída."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    if (!e.over) return;
    const newStage = String(e.over.id);
    const lead = leads?.find((l: any) => l.id === e.active.id);
    if (lead && lead.stage !== newStage) move.mutate({ id: String(e.active.id), stage: newStage });
  };

  // ---- Avisos ----
  const tk = todayKey();
  const isStuck = useCallback((l: any) => OPEN_STAGES.includes(l.stage) && (daysSince(l.updated_at) ?? 0) >= STUCK_DAYS, []);
  const isFollowup = useCallback((l: any) => OPEN_STAGES.includes(l.stage) && l.next_action_at && l.next_action_at <= tk, [tk]);
  const isLost = useCallback((l: any) => l.stage === "lost", []);
  const alerts = useMemo(() => {
    const all = leads ?? [];
    return {
      stuck: all.filter(isStuck).length,
      followup: all.filter(isFollowup).length,
      lost: all.filter(isLost).length,
    };
  }, [leads, isStuck, isFollowup, isLost]);

  // Notificação uma vez por dia quando há leads parados ou follow-up pendente.
  useEffect(() => {
    if (!user || !leads) return;
    const key = `crm-alert-${tk}`;
    if ((alerts.stuck > 0 || alerts.followup > 0) && !localStorage.getItem(key)) {
      localStorage.setItem(key, "1");
      const parts = [];
      if (alerts.followup > 0) parts.push(`${alerts.followup} follow-up(s) para hoje`);
      if (alerts.stuck > 0) parts.push(`${alerts.stuck} lead(s) parado(s)`);
      notifyUsers([user.id], { kind: "warning", title: "CRM · acompanhamento", body: parts.join(" e ") + ". Hora de retomar o contato!", link: "/crm" });
    }
  }, [user, leads, alerts.stuck, alerts.followup, tk]);

  const term = search.trim().toLowerCase();
  const visible = useMemo(() => {
    let list = (leads ?? []).filter((l: any) =>
      !term || [l.name, l.company, l.source, l.contact, l.email].filter(Boolean).join(" ").toLowerCase().includes(term));
    if (labelFilter) list = list.filter((l: any) => (l.label_ids ?? []).includes(labelFilter));
    if (alertFilter === "stuck") list = list.filter(isStuck);
    else if (alertFilter === "followup") list = list.filter(isFollowup);
    else if (alertFilter === "lost") list = list.filter(isLost);
    return list;
  }, [leads, term, labelFilter, alertFilter, isStuck, isFollowup, isLost]);

  const metrics = useMemo(() => {
    const all = leads ?? [];
    const openLeads = all.filter((l: any) => OPEN_STAGES.includes(l.stage));
    const won = all.filter((l: any) => l.stage === "won");
    const lost = all.filter((l: any) => l.stage === "lost");
    const openValue = openLeads.reduce((s: number, l: any) => s + Number(l.value_expected ?? 0), 0);
    const wonValue = won.reduce((s: number, l: any) => s + Number(l.value_expected ?? 0), 0);
    const closed = won.length + lost.length;
    const conversion = closed > 0 ? (won.length / closed) * 100 : 0;
    return { openCount: openLeads.length, openValue, wonCount: won.length, wonValue, conversion };
  }, [leads]);

  const grouped: Record<string, any[]> = {};
  STAGES.forEach((s) => (grouped[s.id] = []));
  visible.forEach((l: any) => { (grouped[l.stage] ??= []).push(l); });

  const activeLead = leads?.find((l: any) => l.id === dragId);
  const profileById = (id?: string | null) => profiles?.find((p: any) => p.id === id);
  const toggleFormLabel = (id: string) =>
    setFormLabels((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const filterActive = !!alertFilter || !!labelFilter;

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="CRM · Pipeline de vendas"
        description="Arraste os cartões entre as etapas, etiquete por prioridade e acompanhe os alertas — tudo em tempo real."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 sm:w-52" placeholder="Buscar lead…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => setLabelsOpen(true)}><Tag className="mr-2 h-4 w-4" />Etiquetas</Button>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); setFormLabels([]); } }}>
              <DialogTrigger asChild><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo lead</Button></DialogTrigger>
              <DialogContent className="max-h-[88vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingId ? "Editar lead" : "Novo lead"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                    <div><Label>Empresa</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Origem</Label><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Instagram, indicação…" /></div>
                    <div><Label>Etapa</Label>
                      <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Contato (telefone/@)</Label><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
                    <div><Label>Valor esperado (R$)</Label><Input type="number" value={form.value_expected} onChange={(e) => setForm({ ...form, value_expected: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  </div>

                  {labelsReady && (
                    <>
                      <div>
                        <Label>Próximo follow-up</Label>
                        <Input type="date" value={form.next_action_at} onChange={(e) => setForm({ ...form, next_action_at: e.target.value })} />
                      </div>
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <Label className="mb-0">Etiquetas</Label>
                          <button type="button" onClick={() => setLabelsOpen(true)} className="text-[11px] text-primary hover:underline">Gerenciar</button>
                        </div>
                        {labels.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground">Nenhuma etiqueta ainda — clique em "Gerenciar" para criar.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {labels.map((l: any) => {
                              const p = paletteByKey(l.color);
                              const on = formLabels.includes(l.id);
                              return (
                                <button
                                  key={l.id} type="button" onClick={() => toggleFormLabel(l.id)}
                                  className={"flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition " + (on ? p.chip : "border-border/60 text-muted-foreground hover:text-foreground")}
                                >
                                  <span className={"h-2 w-2 rounded-full " + p.dot} />{l.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div>
                    <Label>Notas</Label>
                    <MentionTextarea
                      rows={2} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })}
                      mentionedIds={notesMentions} onMentionedIdsChange={setNotesMentions} profiles={profiles ?? []}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Resumo do funil */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={Target} label="Leads em aberto" value={String(metrics.openCount)} accent="text-blue-300" />
        <MetricCard icon={DollarSign} label="Valor em aberto" value={brl(metrics.openValue)} accent="text-amber-300" />
        <MetricCard icon={Trophy} label="Ganhos" value={`${metrics.wonCount} · ${brl(metrics.wonValue)}`} accent="text-emerald-300" />
        <MetricCard icon={Percent} label="Conversão" value={`${metrics.conversion.toFixed(0)}%`} accent="text-primary" />
      </div>

      {/* Avisos de acompanhamento */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AlertBox
          active={alertFilter === "stuck"} icon={Clock} tone="amber"
          count={alerts.stuck} title="Parados há tempo" subtitle={`Sem movimento há ${STUCK_DAYS}+ dias`}
          onClick={() => setAlertFilter(alertFilter === "stuck" ? null : "stuck")}
        />
        <AlertBox
          active={alertFilter === "followup"} icon={CalendarClock} tone="blue"
          count={alerts.followup} title="Follow-up para hoje" subtitle="Com data de retorno vencida"
          onClick={() => setAlertFilter(alertFilter === "followup" ? null : "followup")}
        />
        <AlertBox
          active={alertFilter === "lost"} icon={RotateCcw} tone="red"
          count={alerts.lost} title="Perdidos" subtitle="Recapte com uma nova abordagem"
          onClick={() => setAlertFilter(alertFilter === "lost" ? null : "lost")}
        />
      </div>

      {/* Barra de filtros ativos + etiquetas + status ao vivo */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Wifi className={"h-3.5 w-3.5 " + (live ? "text-emerald-400" : "text-muted-foreground/50")} />
          {live ? "Ao vivo" : "Conectando…"}
        </div>
        {labels.length > 0 && <span className="mx-1 text-border">·</span>}
        {labels.map((l: any) => {
          const p = paletteByKey(l.color);
          const on = labelFilter === l.id;
          return (
            <button
              key={l.id} onClick={() => setLabelFilter(on ? null : l.id)}
              className={"flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition " + (on ? p.chip : "border-border/60 text-muted-foreground hover:text-foreground")}
            >
              <span className={"h-2 w-2 rounded-full " + p.dot} />{l.name}
            </button>
          );
        })}
        {filterActive && (
          <button onClick={() => { setAlertFilter(null); setLabelFilter(null); }} className="flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />Limpar filtro
          </button>
        )}
      </div>

      {!labelsReady && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>Para usar etiquetas coloridas e a data de follow-up, aplique a migração <strong>20260716140000_crm_labels.sql</strong> no Supabase. O quadro funciona normalmente enquanto isso.</div>
        </div>
      )}

      {/* Board — grid responsivo, sem scroll horizontal */}
      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))} onDragEnd={onDragEnd}>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {STAGES.map((stage) => (
            <Column
              key={stage.id} stage={stage} leads={grouped[stage.id]}
              onEdit={openEdit} onDelete={setDeleteTarget} onConvert={setConvertTarget}
              profileById={profileById} labelById={labelById}
            />
          ))}
        </div>
        <DragOverlay>{activeLead && <Card lead={activeLead} dragging profileById={profileById} labelById={labelById} />}</DragOverlay>
      </DndContext>

      {/* Gerenciar etiquetas */}
      <Dialog open={labelsOpen} onOpenChange={setLabelsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Etiquetas do CRM</DialogTitle></DialogHeader>
          {!labelsReady ? (
            <p className="text-sm text-muted-foreground">Aplique a migração <strong>20260716140000_crm_labels.sql</strong> no Supabase para começar a criar etiquetas.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {labels.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma etiqueta ainda.</p>}
                {labels.map((l: any) => {
                  const p = paletteByKey(l.color);
                  return (
                    <span key={l.id} className={"group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs " + p.chip}>
                      <span className={"h-2 w-2 rounded-full " + p.dot} />{l.name}
                      <button onClick={() => deleteLabel.mutate(l.id)} className="ml-0.5 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                    </span>
                  );
                })}
              </div>
              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <Label>Nova etiqueta</Label>
                <div className="flex gap-2">
                  <Input value={newLabel.name} onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })} placeholder="Ex: Quente, VIP, Aguardando…" onKeyDown={(e) => { if (e.key === "Enter") createLabel.mutate(); }} />
                  <Button onClick={() => createLabel.mutate()} disabled={!newLabel.name.trim() || createLabel.isPending}>Criar</Button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {LABEL_PALETTE.map((p) => (
                    <button
                      key={p.key} onClick={() => setNewLabel({ ...newLabel, color: p.key })}
                      title={p.label}
                      className={"h-6 w-6 rounded-full " + p.dot + " transition " + (newLabel.color === p.key ? "ring-2 ring-offset-2 ring-offset-background ring-white/70" : "opacity-70 hover:opacity-100")}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => setLabelsOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>Isso vai excluir "{deleteTarget?.name}" permanentemente. Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(deleteTarget.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!convertTarget} onOpenChange={(v) => !v && setConvertTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Converter em cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Vamos criar um novo cliente na aba Clientes a partir de "{convertTarget?.name}", já com empresa, contato e valor esperado como mensalidade. O lead continua aqui no funil como Ganho.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => convert.mutate(convertTarget)} disabled={convert.isPending}>Criar cliente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent: string }) {
  return (
    <div className="surface-card flex items-center gap-3 p-4">
      <div className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface/60 " + accent}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate font-display text-base font-semibold">{value}</div>
      </div>
    </div>
  );
}

const TONES: Record<string, { border: string; icon: string }> = {
  amber: { border: "border-amber-500/40", icon: "text-amber-400 bg-amber-500/10 border-amber-500/40" },
  blue: { border: "border-blue-500/40", icon: "text-blue-400 bg-blue-500/10 border-blue-500/40" },
  red: { border: "border-red-500/40", icon: "text-red-400 bg-red-500/10 border-red-500/40" },
};
function AlertBox({ icon: Icon, tone, count, title, subtitle, active, onClick }: {
  icon: any; tone: keyof typeof TONES; count: number; title: string; subtitle: string; active: boolean; onClick: () => void;
}) {
  const t = TONES[tone];
  const on = count > 0;
  return (
    <button onClick={onClick} className={"surface-card flex items-center gap-3 p-4 text-left transition hover:border-primary/40 " + (active ? "ring-2 ring-primary/50 " : "") + (on ? t.border : "")}>
      <div className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border " + (on ? t.icon : "border-border/60 bg-surface/60 text-muted-foreground")}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg font-semibold">{count}</span>
          <span className="truncate text-sm font-medium">{title}</span>
        </div>
        <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
      </div>
      {active && <Bell className="h-3.5 w-3.5 text-primary" />}
    </button>
  );
}

function Column({ stage, leads, onEdit, onDelete, onConvert, profileById, labelById }: {
  stage: typeof STAGES[number]; leads: any[];
  onEdit: (lead: any) => void; onDelete: (lead: any) => void; onConvert: (lead: any) => void;
  profileById: (id?: string | null) => any; labelById: (id: string) => any;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id });
  const total = leads.reduce((s, l) => s + Number(l.value_expected ?? 0), 0);
  return (
    <div ref={setNodeRef} className={"flex min-h-24 flex-col rounded-xl border border-border/60 bg-surface/40 p-2.5 transition " + (isOver ? "ring-2 ring-primary/60" : "")}>
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " + stage.color}>{stage.label}</span>
          <span className="text-xs text-muted-foreground">{leads.length}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{brl(total)}</span>
      </div>
      <div className="flex flex-col gap-2">
        {leads.map((l) => (
          <Card key={l.id} lead={l} onEdit={onEdit} onDelete={onDelete} onConvert={onConvert} profileById={profileById} labelById={labelById} />
        ))}
        {leads.length === 0 && <div className="rounded border border-dashed border-border/40 p-3 text-center text-[10px] text-muted-foreground">—</div>}
      </div>
    </div>
  );
}

function Card({ lead, dragging, onEdit, onDelete, onConvert, profileById, labelById }: {
  lead: any; dragging?: boolean;
  onEdit?: (lead: any) => void; onDelete?: (lead: any) => void; onConvert?: (lead: any) => void;
  profileById?: (id?: string | null) => any; labelById?: (id: string) => any;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style: React.CSSProperties = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {};
  const owner = profileById?.(lead.owner_id);
  const age = daysSince(lead.created_at);
  const leadLabels = (lead.label_ids ?? []).map((id: string) => labelById?.(id)).filter(Boolean);
  const accent = leadLabels[0] ? paletteByKey(leadLabels[0].color).hex : null;
  if (accent) style.borderLeftColor = accent;

  const open = OPEN_STAGES.includes(lead.stage);
  const stuckDays = open ? daysSince(lead.updated_at) : null;
  const stuck = stuckDays != null && stuckDays >= STUCK_DAYS;
  const followOverdue = open && lead.next_action_at && lead.next_action_at <= todayKey();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={"surface-card group relative cursor-grab border-l-4 p-3 active:cursor-grabbing " + (accent ? "" : "border-l-transparent ") + (isDragging ? "opacity-30 " : "") + (dragging ? "shadow-elegant" : "")}
    >
      {onEdit && onDelete && (
        <div className="absolute right-1.5 top-1.5 opacity-0 transition group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button onPointerDown={(e) => e.stopPropagation()} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onPointerDown={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onEdit(lead)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
              {lead.stage === "won" && onConvert && (
                <DropdownMenuItem onClick={() => onConvert(lead)}><UserPlus className="mr-2 h-3.5 w-3.5" />Virar cliente</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onDelete(lead)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
        <div className="min-w-0 flex-1 pr-4">
          <div className="truncate text-sm font-medium">{lead.name}</div>
          {lead.company && <div className="truncate text-xs text-muted-foreground">{lead.company}</div>}

          {leadLabels.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {leadLabels.slice(0, 3).map((l: any) => {
                const p = paletteByKey(l.color);
                return <span key={l.id} className={"rounded-full border px-1.5 py-0 text-[9px] " + p.chip}>{l.name}</span>;
              })}
            </div>
          )}

          {(stuck || followOverdue) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {followOverdue && <span className="flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0 text-[9px] text-blue-300"><CalendarClock className="h-2.5 w-2.5" />Follow-up {fmtDay(lead.next_action_at)}</span>}
              {stuck && <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[9px] text-amber-300"><Clock className="h-2.5 w-2.5" />Parado {stuckDays}d</span>}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between">
            <span className="truncate text-[10px] text-muted-foreground">{lead.source ?? "Sem origem"}</span>
            <span className="text-xs font-semibold text-primary">{brl(lead.value_expected)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2">
            {owner ? (
              <div className="flex items-center gap-1.5" title={owner.full_name ?? owner.email}>
                <Avatar className="h-5 w-5">
                  {owner.avatar_url && <AvatarImage src={owner.avatar_url} alt={owner.full_name ?? ""} />}
                  <AvatarFallback className="bg-primary/15 text-[8px] text-primary">{initials(owner.full_name ?? owner.email)}</AvatarFallback>
                </Avatar>
                <span className="max-w-[80px] truncate text-[10px] text-muted-foreground">{owner.full_name ?? owner.email}</span>
              </div>
            ) : <span />}
            {age != null && <span className="text-[10px] text-muted-foreground">{age === 0 ? "hoje" : `${age}d`}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
