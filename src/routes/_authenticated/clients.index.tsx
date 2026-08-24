import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/storage";
import { getClientsAdBudgets, type ClientAdBudget } from "@/lib/ads-budget.functions";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { initials, brl } from "@/lib/format";
import {
  Users, Plus, Search, Building2, MoreVertical, Pencil, Trash2, Upload, Loader2, X,
  AlertTriangle, TrendingUp, CheckCircle2, Tag, PlayCircle, PauseCircle, XCircle,
} from "lucide-react";
import { toast } from "sonner";

// Paleta das etiquetas de cliente (mesma linguagem visual do CRM).
const LABEL_PALETTE = [
  { key: "red", dot: "bg-red-500", chip: "bg-red-500/15 text-red-300 border-red-500/30" },
  { key: "amber", dot: "bg-amber-500", chip: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  { key: "green", dot: "bg-emerald-500", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  { key: "blue", dot: "bg-blue-500", chip: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  { key: "purple", dot: "bg-purple-500", chip: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  { key: "pink", dot: "bg-pink-500", chip: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
  { key: "cyan", dot: "bg-cyan-500", chip: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  { key: "slate", dot: "bg-slate-500", chip: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
];
const paletteByKey = (k?: string) => LABEL_PALETTE.find((p) => p.key === k) ?? LABEL_PALETTE[3];

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({ meta: [{ title: "Clientes — Elo Marketing OS" }] }),
  component: ClientsPage,
});

const STATUS_LABELS: Record<string, string> = { active: "Ativo", paused: "Pausado", churned: "Cancelado" };

const STATUS_GROUPS = [
  { value: "active", title: "Ativos", icon: PlayCircle, accent: "text-emerald-400" },
  { value: "paused", title: "Pausados", icon: PauseCircle, accent: "text-amber-400" },
  { value: "churned", title: "Cancelados", icon: XCircle, accent: "text-red-400" },
] as const;

// Clientes "prospect" (status legado, tirado do formulário) continuam
// existindo no banco — para não sumirem da tela, entram na tabela de Ativos.
const groupOf = (status: string) => (status === "paused" || status === "churned" ? status : "active");

const emptyForm = {
  name: "", company: "", segment: "", email: "", phone: "",
  whatsapp: "", city: "", state: "", plan: "", monthly_value: "", status: "active",
  logo_url: "",
};

const money = (v: number, ccy = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: ccy }).format(Number(v || 0));

// Selo de verba do cliente: sem orçamento configurado é um alerta; gastando bem abaixo
// do orçamento diário sobra espaço pra investir mais; senão está tudo em dia.
function budgetStatus(budget: ClientAdBudget | undefined) {
  if (!budget || budget.budgetDaily <= 0) {
    return { label: "Sem verba", cls: "bg-red-500/15 text-red-400 border-red-500/30", Icon: AlertTriangle };
  }
  if (budget.spendToday < budget.budgetDaily * 0.7) {
    return { label: "Pode gastar mais", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", Icon: TrendingUp };
  }
  return { label: "Verba em dia", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", Icon: CheckCircle2 };
}

function ClientsPage() {
  const qc = useQueryClient();
  const { isAdmin } = usePermissions();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [formLabels, setFormLabels] = useState<string[]>([]);
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [newLabel, setNewLabel] = useState({ name: "", color: "blue" });
  const logoRef = useRef<HTMLInputElement>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Etiquetas — tabela pode não existir ainda (migração): degrada sem quebrar.
  const { data: labelsData } = useQuery({
    queryKey: ["client-labels"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("client_labels").select("*").order("created_at");
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

  // Verba (Meta + Google Ads) por cliente, atualizada sozinha em segundo plano —
  // sem precisar de F5 ou botão de atualizar.
  const adBudgetsFn = useServerFn(getClientsAdBudgets);
  const { data: adBudgets } = useQuery({
    queryKey: ["clients-ad-budgets"],
    queryFn: () => adBudgetsFn(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormLabels([]);
    setOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      name: c.name ?? "", company: c.company ?? "", segment: c.segment ?? "",
      email: c.email ?? "", phone: c.phone ?? "", whatsapp: c.whatsapp ?? "",
      city: c.city ?? "", state: c.state ?? "", plan: c.plan ?? "",
      monthly_value: c.monthly_value != null ? String(c.monthly_value) : "",
      status: groupOf(c.status ?? "active"),
      logo_url: c.logo_url ?? "",
    });
    setFormLabels(Array.isArray(c.label_ids) ? c.label_ids : []);
    setOpen(true);
  };
  const toggleFormLabel = (id: string) =>
    setFormLabels((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const onPickLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const url = await uploadImage("logos", file, "client");
      setForm((f) => ({ ...f, logo_url: url }));
      toast.success("Imagem carregada! Clique em Salvar para confirmar.");
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao enviar a imagem");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        monthly_value: form.monthly_value ? Number(form.monthly_value) : 0,
      } as any;
      if (labelsReady) payload.label_ids = formLabels;
      const run = async (p: any) =>
        editingId
          ? (await supabase.from("clients").update(p).eq("id", editingId)).error
          : (await supabase.from("clients").insert(p)).error;
      let error = await run(payload);
      // Banco ainda sem a migração da coluna logo_url — salva o resto do cadastro
      // mesmo assim em vez de travar o cliente inteiro por causa da imagem.
      if (error && /logo_url/.test(error.message)) {
        const { logo_url: _omit, ...rest } = payload;
        error = await run(rest);
      }
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editingId ? "Cliente atualizado!" : "Cliente cadastrado!");
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setFormLabels([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Etiquetas ----
  const createLabel = useMutation({
    mutationFn: async () => {
      if (!newLabel.name.trim()) throw new Error("Dê um nome à etiqueta");
      const { error } = await (supabase as any).from("client_labels").insert({ name: newLabel.name.trim(), color: newLabel.color });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client-labels"] }); setNewLabel({ name: "", color: "blue" }); toast.success("Etiqueta criada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteLabel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("client_labels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client-labels"] }); qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Etiqueta excluída."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setDeleteTarget(null);
      toast.success("Cliente excluído!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const term = search.trim().toLowerCase();
  const filtered = (clients ?? []).filter((c: any) =>
    (!term || [c.name, c.company, c.email, c.segment].filter(Boolean).join(" ").toLowerCase().includes(term)) &&
    (!labelFilter || (c.label_ids ?? []).includes(labelFilter)),
  );

  // Enquanto a migração da coluna logo_url não estiver aplicada no banco, o upload
  // de logo fica oculto — evita o usuário subir uma imagem que não seria salva.
  const logoColumnExists = !clients || clients.length === 0 || "logo_url" in (clients[0] as any);

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="Clientes"
        description="Gerencie todas as contas que a agência atende."
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 sm:w-64" placeholder="Buscar cliente…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => setLabelsOpen(true)}><Tag className="mr-2 h-4 w-4" />Etiquetas</Button>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); setFormLabels([]); } }}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Novo cliente</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>{editingId ? "Editar cliente" : "Cadastrar novo cliente"}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {logoColumnExists && (
                  <div className="flex items-center gap-4 sm:col-span-2">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-surface/40">
                      {form.logo_url ? (
                        <img src={form.logo_url} alt="Logo do cliente" className="h-full w-full object-contain" />
                      ) : (
                        <span className="px-1 text-center text-[10px] text-muted-foreground">Sem imagem</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Logo / imagem do cliente</Label>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => logoRef.current?.click()} disabled={uploading}>
                          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                          {form.logo_url ? "Trocar imagem" : "Enviar imagem"}
                        </Button>
                        {form.logo_url && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, logo_url: "" })}>
                            <X className="mr-1 h-3.5 w-3.5" />Remover
                          </Button>
                        )}
                      </div>
                    </div>
                    <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={onPickLogo} />
                  </div>
                  )}
                  {[
                    ["name","Nome do contato *"],["company","Empresa"],["segment","Segmento"],
                    ["email","Email"],["phone","Telefone"],["whatsapp","WhatsApp"],
                    ["city","Cidade"],["state","Estado"],["plan","Plano contratado"],
                    ["monthly_value","Verba (R$)"],
                  ].map(([k,label]) => (
                    <div key={k}>
                      <Label>{label}</Label>
                      <Input
                        type={k === "monthly_value" ? "number" : "text"}
                        value={(form as any)[k]}
                        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                      />
                    </div>
                  ))}
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {labelsReady && (
                    <div className="sm:col-span-2">
                      <div className="mb-1.5 flex items-center justify-between">
                        <Label className="mb-0">Etiquetas</Label>
                        <button type="button" onClick={() => setLabelsOpen(true)} className="text-[11px] text-primary hover:underline">Gerenciar</button>
                      </div>
                      {labels.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">Nenhuma etiqueta — clique em "Gerenciar" para criar.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {labels.map((l: any) => {
                            const p = paletteByKey(l.color);
                            const on = formLabels.includes(l.id);
                            return (
                              <button key={l.id} type="button" onClick={() => toggleFormLabel(l.id)}
                                className={"flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition " + (on ? p.chip : "border-border/60 text-muted-foreground hover:text-foreground")}>
                                <span className={"h-2 w-2 rounded-full " + p.dot} />{l.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {(adBudgets as any)?.metaError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Verba de mídia indisponível no momento — o Meta respondeu: "{(adBudgets as any).metaError}". Gere um novo token de acesso e atualize a variável META_ACCESS_TOKEN no servidor.
        </div>
      )}

      {labels.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {labels.map((l: any) => {
            const p = paletteByKey(l.color);
            const on = labelFilter === l.id;
            return (
              <button key={l.id} onClick={() => setLabelFilter(on ? null : l.id)}
                className={"flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition " + (on ? p.chip : "border-border/60 text-muted-foreground hover:text-foreground")}>
                <span className={"h-2 w-2 rounded-full " + p.dot} />{l.name}
              </button>
            );
          })}
          {labelFilter && (
            <button onClick={() => setLabelFilter(null)} className="flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />Limpar
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="surface-card h-40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum cliente ainda"
          description="Comece cadastrando seu primeiro cliente para acompanhar projetos, campanhas e financeiro."
          action={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Cadastrar cliente</Button>}
        />
      ) : (
        <div className="space-y-8">
          {STATUS_GROUPS.map((group) => {
            const rows = filtered.filter((c: any) => groupOf(c.status ?? "active") === group.value);
            return (
              <div key={group.value}>
                <div className="mb-2 flex items-center gap-2">
                  <group.icon className={"h-4 w-4 " + group.accent} />
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</h2>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{rows.length}</span>
                </div>
                {rows.length === 0 ? (
                  <div className="surface-card p-6 text-center text-xs text-muted-foreground">Nenhum cliente {group.title.toLowerCase()}.</div>
                ) : (
                  <div className="surface-card overflow-hidden p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Cliente</TableHead>
                          <TableHead className="hidden md:table-cell">Segmento</TableHead>
                          <TableHead className="hidden lg:table-cell">Etiquetas</TableHead>
                          <TableHead>Verba</TableHead>
                          {adBudgets && <TableHead className="hidden sm:table-cell">Verba de mídia</TableHead>}
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((c: any) => (
                          <ClientRow
                            key={c.id} c={c} adBudgets={adBudgets}
                            labels={(c.label_ids ?? []).map((id: string) => labelById(id)).filter(Boolean)}
                            onEdit={() => openEdit(c)}
                            onDelete={isAdmin ? () => setDeleteTarget(c) : undefined}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir "{deleteTarget?.company ?? deleteTarget?.name}" e todos os projetos, campanhas e anotações vinculados a ele. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(deleteTarget.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Gerenciar etiquetas */}
      <Dialog open={labelsOpen} onOpenChange={setLabelsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Etiquetas de clientes</DialogTitle></DialogHeader>
          {!labelsReady ? (
            <p className="text-sm text-muted-foreground">Aplique a migração <strong>20260724160000_news_and_client_labels.sql</strong> no Supabase para usar etiquetas.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {labels.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma etiqueta ainda.</p>}
                {labels.map((l: any) => {
                  const p = paletteByKey(l.color);
                  return (
                    <span key={l.id} className={"flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs " + p.chip}>
                      <span className={"h-2 w-2 rounded-full " + p.dot} />{l.name}
                      <button onClick={() => deleteLabel.mutate(l.id)} className="ml-0.5 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                    </span>
                  );
                })}
              </div>
              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <Label>Nova etiqueta</Label>
                <div className="flex gap-2">
                  <Input value={newLabel.name} onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })} placeholder="Ex: VIP, Mensal, Recorrente…" onKeyDown={(e) => { if (e.key === "Enter") createLabel.mutate(); }} />
                  <Button onClick={() => createLabel.mutate()} disabled={!newLabel.name.trim() || createLabel.isPending}>Criar</Button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {LABEL_PALETTE.map((p) => (
                    <button key={p.key} onClick={() => setNewLabel({ ...newLabel, color: p.key })} title={p.key}
                      className={"h-6 w-6 rounded-full " + p.dot + " transition " + (newLabel.color === p.key ? "ring-2 ring-offset-2 ring-offset-background ring-white/70" : "opacity-70 hover:opacity-100")} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => setLabelsOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientRow({ c, adBudgets, labels, onEdit, onDelete }: {
  c: any; adBudgets: any; labels: any[]; onEdit: () => void; onDelete?: () => void;
}) {
  const budget = adBudgets?.byClient?.[c.id] as ClientAdBudget | undefined;

  return (
    <TableRow>
      <TableCell>
        <Link to="/clients/$id" params={{ id: c.id }} className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            {c.logo_url && <AvatarImage src={c.logo_url} alt={c.company ?? c.name} className="object-cover" />}
            <AvatarFallback className="bg-primary/15 text-primary">{initials(c.company ?? c.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate font-medium">{c.company ?? c.name}</div>
            <div className="truncate text-xs text-muted-foreground">{c.name}</div>
          </div>
        </Link>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {c.segment ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{c.segment}</span>
        ) : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        {labels.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {labels.map((l: any) => {
              const p = paletteByKey(l.color);
              return <span key={l.id} className={"rounded-full border px-1.5 py-0 text-[9px] " + p.chip}>{l.name}</span>;
            })}
          </div>
        ) : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="font-medium">{brl(c.monthly_value)}</TableCell>
      {adBudgets && (
        <TableCell className="hidden sm:table-cell">
          {!budget ? (
            <span className="text-xs text-muted-foreground">{adBudgets.metaError ? "Integração indisponível" : "Sem conta de anúncios"}</span>
          ) : (() => {
            const s = budgetStatus(budget);
            return (
              <Badge variant="outline" className={`gap-1 text-[10px] ${s.cls}`}>
                <s.Icon className="h-3 w-3" />{s.label}
              </Badge>
            );
          })()}
        </TableCell>
      )}
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
            {onDelete && (
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" />Excluir</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
