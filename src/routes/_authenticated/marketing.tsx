import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MentionTextarea } from "@/components/ui-extras/mention-textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus, TrendingUp, Target, DollarSign, MousePointerClick, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { brl, shortDate } from "@/lib/format";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-auth";
import { notifyUsers } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/marketing")({
  head: () => ({ meta: [{ title: "Marketing — Elo Marketing OS" }] }),
  component: MarketingPage,
});

const channelColors: Record<string, string> = {
  meta: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  google: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  tiktok: "bg-pink-500/15 text-pink-300 border-pink-500/30",
  linkedin: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  other: "bg-muted text-muted-foreground border-border",
};

const empty = { name: "", client_id: "", channel: "meta", objective: "", status: "active",
  budget: "", invested: "", leads: "", cpa: "", ctr: "", cpc: "", roas: "", roi: "",
  start_date: "", end_date: "", notes: "" };

function MarketingPage() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [notesMentions, setNotesMentions] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => (await supabase.from("campaigns").select("*, clients(name)").order("created_at", { ascending: false })).data ?? [],
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
    setNotesMentions([]);
    setOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      name: c.name ?? "", client_id: c.client_id ?? "", channel: c.channel ?? "meta",
      objective: c.objective ?? "", status: c.status ?? "active",
      budget: c.budget != null ? String(c.budget) : "", invested: c.invested != null ? String(c.invested) : "",
      leads: c.leads != null ? String(c.leads) : "", cpa: c.cpa != null ? String(c.cpa) : "",
      ctr: c.ctr != null ? String(c.ctr) : "", cpc: c.cpc != null ? String(c.cpc) : "",
      roas: c.roas != null ? String(c.roas) : "", roi: c.roi != null ? String(c.roi) : "",
      start_date: c.start_date ?? "", end_date: c.end_date ?? "", notes: c.notes ?? "",
    });
    setNotesMentions([]);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      ["budget","invested","leads","cpa","ctr","cpc","roas","roi"].forEach(k => {
        payload[k] = payload[k] === "" ? null : Number(payload[k]);
      });
      if (!payload.client_id) payload.client_id = null;
      if (!payload.start_date) payload.start_date = null;
      if (!payload.end_date) payload.end_date = null;
      if (editingId) {
        const { error } = await supabase.from("campaigns").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("campaigns").insert(payload);
        if (error) throw error;
      }
      if (notesMentions.length > 0) {
        await notifyUsers(notesMentions, {
          kind: "mention", title: "Você foi mencionado numa campanha", body: form.name, link: "/marketing", excludeUserId: user?.id,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      setOpen(false); setEditingId(null); setForm(empty); setNotesMentions([]);
      toast.success(editingId ? "Campanha atualizada!" : "Campanha criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      setDeleteTarget(null);
      toast.success("Campanha excluída!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = (campaigns ?? []).reduce((acc: any, c: any) => ({
    invested: acc.invested + Number(c.invested ?? 0),
    leads: acc.leads + Number(c.leads ?? 0),
    budget: acc.budget + Number(c.budget ?? 0),
    roas: acc.roas + Number(c.roas ?? 0),
  }), { invested: 0, leads: 0, budget: 0, roas: 0 });
  const avgRoas = (campaigns?.length ?? 0) > 0 ? totals.roas / campaigns!.length : 0;
  const cpaGlobal = totals.leads > 0 ? totals.invested / totals.leads : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Crescimento"
        title="Marketing & Campanhas"
        description="Acompanhe investimento, leads e ROI de Meta, Google, TikTok e LinkedIn Ads."
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(empty); } }}>
            <DialogTrigger asChild><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nova campanha</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? "Editar campanha" : "Nova campanha"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div><Label>Cliente</Label>
                  <Select value={form.client_id} onValueChange={v => setForm({...form, client_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{(clients ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Canal</Label>
                  <Select value={form.channel} onValueChange={v => setForm({...form, channel: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meta">Meta Ads</SelectItem>
                      <SelectItem value="google">Google Ads</SelectItem>
                      <SelectItem value="tiktok">TikTok Ads</SelectItem>
                      <SelectItem value="linkedin">LinkedIn Ads</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Objetivo</Label><Input value={form.objective} onChange={e => setForm({...form, objective: e.target.value})} placeholder="Geração de leads, vendas, tráfego..." /></div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="paused">Pausada</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
                      <SelectItem value="draft">Rascunho</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Orçamento (R$)</Label><Input type="number" step="0.01" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} /></div>
                <div><Label>Investido (R$)</Label><Input type="number" step="0.01" value={form.invested} onChange={e => setForm({...form, invested: e.target.value})} /></div>
                <div><Label>Leads</Label><Input type="number" value={form.leads} onChange={e => setForm({...form, leads: e.target.value})} /></div>
                <div><Label>CPA</Label><Input type="number" step="0.01" value={form.cpa} onChange={e => setForm({...form, cpa: e.target.value})} /></div>
                <div><Label>CTR (%)</Label><Input type="number" step="0.01" value={form.ctr} onChange={e => setForm({...form, ctr: e.target.value})} /></div>
                <div><Label>CPC</Label><Input type="number" step="0.01" value={form.cpc} onChange={e => setForm({...form, cpc: e.target.value})} /></div>
                <div><Label>ROAS</Label><Input type="number" step="0.01" value={form.roas} onChange={e => setForm({...form, roas: e.target.value})} /></div>
                <div><Label>ROI (%)</Label><Input type="number" step="0.01" value={form.roi} onChange={e => setForm({...form, roi: e.target.value})} /></div>
                <div><Label>Início</Label><Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} /></div>
                <div><Label>Fim</Label><Input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} /></div>
                <div className="col-span-2">
                  <Label>Observações</Label>
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
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Investido total" value={brl(totals.invested)} icon={DollarSign} />
        <StatCard label="Leads gerados" value={totals.leads} icon={Target} accent="success" />
        <StatCard label="CPA médio" value={brl(cpaGlobal)} icon={MousePointerClick} accent="warning" />
        <StatCard label="ROAS médio" value={avgRoas.toFixed(2) + "x"} icon={TrendingUp} accent="success" />
      </div>

      {(campaigns?.length ?? 0) === 0 ? (
        <EmptyState icon={Megaphone} title="Nenhuma campanha ainda" description="Cadastre sua primeira campanha para acompanhar performance." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {campaigns!.map((c: any) => (
            <div key={c.id} className="surface-card group relative p-5 transition hover:shadow-elegant">
              <div className="absolute right-3 top-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(c)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteTarget(c)} className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mb-3 flex items-start justify-between gap-3 pr-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base font-semibold">{c.name}</h3>
                    <Badge variant="outline" className={channelColors[c.channel] ?? ""}>{c.channel}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{c.clients?.name ?? "Sem cliente"} · {c.objective || "—"}</div>
                </div>
                <Badge variant="secondary" className="capitalize">{c.status}</Badge>
              </div>
              <div className="grid grid-cols-4 gap-2 border-t border-border/50 pt-3 text-center">
                <Metric label="Investido" value={brl(c.invested ?? 0)} />
                <Metric label="Leads" value={c.leads ?? 0} />
                <Metric label="CPA" value={brl(c.cpa ?? 0)} />
                <Metric label="ROAS" value={(Number(c.roas ?? 0)).toFixed(2) + "x"} />
              </div>
              {(c.start_date || c.end_date) && (
                <div className="mt-3 text-[11px] text-muted-foreground">
                  {shortDate(c.start_date)} → {shortDate(c.end_date)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
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
    </div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-sm font-semibold">{value}</div>
    </div>
  );
}
