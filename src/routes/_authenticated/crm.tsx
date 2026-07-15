import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MentionTextarea } from "@/components/ui-extras/mention-textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, GripVertical, MoreVertical, Pencil, Trash2, Search, UserPlus,
  DollarSign, Trophy, Target, Percent, Wifi,
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

const emptyForm = { name: "", company: "", source: "", value_expected: "", contact: "", stage: "lead", notes: "" };

function daysSince(iso?: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function CRMBoard() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [notesMentions, setNotesMentions] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [convertTarget, setConvertTarget] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(false);

  const { data: leads } = useQuery({
    queryKey: ["crm-leads"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_leads").select("*").order("created_at",{ascending:false});
      return data ?? [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["team-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, avatar_url").order("full_name")).data ?? [],
  });

  // Tempo real: qualquer inclusão/edição/movimentação de lead (por você ou por outra
  // pessoa da equipe) atualiza o quadro na hora, sem precisar recarregar a página.
  useEffect(() => {
    const channel = supabase
      .channel("crm-leads-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_leads" }, () => {
        qc.invalidateQueries({ queryKey: ["crm-leads"] });
      })
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
    setNotesMentions([]);
    setOpen(true);
  };

  const openEdit = (lead: any) => {
    setEditingId(lead.id);
    setForm({
      name: lead.name ?? "", company: lead.company ?? "", source: lead.source ?? "",
      value_expected: lead.value_expected != null ? String(lead.value_expected) : "",
      contact: lead.contact ?? "", stage: lead.stage ?? "lead", notes: lead.notes ?? "",
    });
    setNotesMentions([]);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        value_expected: form.value_expected ? Number(form.value_expected) : 0,
      } as any;
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
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setNotesMentions([]);
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

  // Transforma um lead ganho em cliente de verdade na aba Clientes, sem redigitar nada.
  const convert = useMutation({
    mutationFn: async (lead: any) => {
      const { data: existing } = await supabase
        .from("clients").select("id").eq("name", lead.name).limit(1).maybeSingle();
      if (existing) throw new Error("Já existe um cliente com esse nome.");
      const { error } = await supabase.from("clients").insert({
        name: lead.name,
        company: lead.company || null,
        email: lead.email || null,
        phone: lead.contact || lead.phone || null,
        monthly_value: lead.value_expected ? Number(lead.value_expected) : 0,
        status: "active",
        notes: lead.notes || null,
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

  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    if (!e.over) return;
    const newStage = String(e.over.id);
    const lead = leads?.find((l: any) => l.id === e.active.id);
    if (lead && lead.stage !== newStage) move.mutate({ id: String(e.active.id), stage: newStage });
  };

  const term = search.trim().toLowerCase();
  const filtered = useMemo(
    () => (leads ?? []).filter((l: any) =>
      !term || [l.name, l.company, l.source, l.contact].filter(Boolean).join(" ").toLowerCase().includes(term)),
    [leads, term],
  );

  // Indicadores do funil, recalculados ao vivo conforme os leads mudam.
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
  STAGES.forEach(s => grouped[s.id] = []);
  filtered.forEach((l: any) => { (grouped[l.stage] ??= []).push(l); });

  const activeLead = leads?.find((l: any) => l.id === dragId);
  const profileById = (id?: string | null) => profiles?.find((p: any) => p.id === id);

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="CRM · Pipeline de vendas"
        description="Arraste os cartões entre as etapas para acompanhar o ciclo comercial — tudo em tempo real."
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 sm:w-56" placeholder="Buscar lead…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
              <DialogTrigger asChild><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo lead</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingId ? "Editar lead" : "Novo lead"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} /></div>
                  <div><Label>Empresa</Label><Input value={form.company} onChange={(e) => setForm({...form, company: e.target.value})} /></div>
                  <div><Label>Origem</Label><Input value={form.source} onChange={(e) => setForm({...form, source: e.target.value})} placeholder="Instagram, indicação…" /></div>
                  <div><Label>Contato</Label><Input value={form.contact} onChange={(e) => setForm({...form, contact: e.target.value})} /></div>
                  <div><Label>Valor esperado (R$)</Label><Input type="number" value={form.value_expected} onChange={(e) => setForm({...form, value_expected: e.target.value})} /></div>
                  <div>
                    <Label>Notas</Label>
                    <MentionTextarea
                      rows={2}
                      value={form.notes}
                      onChange={(v) => setForm({...form, notes: v})}
                      mentionedIds={notesMentions}
                      onMentionedIdsChange={setNotesMentions}
                      profiles={profiles ?? []}
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

      {/* Resumo do funil, ao vivo */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={Target} label="Leads em aberto" value={String(metrics.openCount)} accent="text-blue-300" />
        <MetricCard icon={DollarSign} label="Valor em aberto" value={brl(metrics.openValue)} accent="text-amber-300" />
        <MetricCard icon={Trophy} label="Ganhos" value={`${metrics.wonCount} · ${brl(metrics.wonValue)}`} accent="text-emerald-300" />
        <MetricCard icon={Percent} label="Conversão" value={`${metrics.conversion.toFixed(0)}%`} accent="text-primary" />
      </div>

      <div className="mb-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Wifi className={"h-3.5 w-3.5 " + (live ? "text-emerald-400" : "text-muted-foreground/50")} />
        {live ? "Atualizando em tempo real" : "Conectando ao tempo real…"}
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <Column
              key={stage.id} stage={stage} leads={grouped[stage.id]}
              onEdit={openEdit} onDelete={setDeleteTarget} onConvert={setConvertTarget} profileById={profileById}
            />
          ))}
        </div>
        <DragOverlay>{activeLead && <Card lead={activeLead} dragging profileById={profileById} />}</DragOverlay>
      </DndContext>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir "{deleteTarget?.name}" permanentemente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
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
              Vamos criar um novo cliente na aba Clientes a partir de "{convertTarget?.name}", já com empresa, contato e valor
              esperado como mensalidade. O lead continua aqui no funil como Ganho.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => convert.mutate(convertTarget)} disabled={convert.isPending}>
              Criar cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, accent }: {
  icon: any; label: string; value: string; accent: string;
}) {
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

function Column({ stage, leads, onEdit, onDelete, onConvert, profileById }: {
  stage: typeof STAGES[number]; leads: any[];
  onEdit: (lead: any) => void; onDelete: (lead: any) => void; onConvert: (lead: any) => void;
  profileById: (id?: string | null) => any;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id });
  const total = leads.reduce((s, l) => s + Number(l.value_expected ?? 0), 0);
  return (
    <div ref={setNodeRef} className={"flex w-72 shrink-0 flex-col rounded-xl border border-border/60 bg-surface/40 p-3 transition " + (isOver ? "ring-2 ring-primary/60" : "")}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " + stage.color}>{stage.label}</span>
          <span className="text-xs text-muted-foreground">{leads.length}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{brl(total)}</span>
      </div>
      <div className="flex flex-col gap-2">
        {leads.map((l) => (
          <Card key={l.id} lead={l} onEdit={onEdit} onDelete={onDelete} onConvert={onConvert} profileById={profileById} />
        ))}
      </div>
    </div>
  );
}

function Card({ lead, dragging, onEdit, onDelete, onConvert, profileById }: {
  lead: any; dragging?: boolean;
  onEdit?: (lead: any) => void; onDelete?: (lead: any) => void; onConvert?: (lead: any) => void;
  profileById?: (id?: string | null) => any;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const owner = profileById?.(lead.owner_id);
  const age = daysSince(lead.created_at);
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={"surface-card group relative cursor-grab p-3 active:cursor-grabbing " + (isDragging ? "opacity-30" : "") + (dragging ? " shadow-elegant" : "")}
    >
      {onEdit && onDelete && (
        <div className="absolute right-1.5 top-1.5 opacity-0 transition group-hover:opacity-100">
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
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-3 w-3 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
        <div className="min-w-0 flex-1 pr-4">
          <div className="truncate text-sm font-medium">{lead.name}</div>
          {lead.company && <div className="truncate text-xs text-muted-foreground">{lead.company}</div>}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{lead.source ?? "Sem origem"}</span>
            <span className="text-xs font-semibold text-primary">{brl(lead.value_expected)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2">
            {owner ? (
              <div className="flex items-center gap-1.5" title={owner.full_name ?? owner.email}>
                <Avatar className="h-5 w-5">
                  {owner.avatar_url && <AvatarImage src={owner.avatar_url} alt={owner.full_name ?? ""} />}
                  <AvatarFallback className="bg-primary/15 text-[8px] text-primary">{initials(owner.full_name ?? owner.email)}</AvatarFallback>
                </Avatar>
                <span className="max-w-[90px] truncate text-[10px] text-muted-foreground">{owner.full_name ?? owner.email}</span>
              </div>
            ) : <span />}
            {age != null && (
              <span className="text-[10px] text-muted-foreground">{age === 0 ? "hoje" : `${age}d`}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
