import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { brl, shortDate, initials } from "@/lib/format";
import { Wallet, ArrowUpRight, ArrowDownRight, Plus, TrendingUp, MoreVertical, Pencil, Trash2, Users2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Financeiro — Elo Marketing OS" }] }),
  component: FinancePage,
});

function FinancePage() {
  const { isAdmin } = usePermissions();

  return (
    <div>
      <PageHeader
        eyebrow="Agência"
        title="Financeiro"
        description="Acompanhe entradas, saídas e resultado da agência."
      />
      {isAdmin ? (
        <Tabs defaultValue="cashflow">
          <TabsList className="mb-6">
            <TabsTrigger value="cashflow">Fluxo de caixa</TabsTrigger>
            <TabsTrigger value="employees">Funcionários</TabsTrigger>
          </TabsList>
          <TabsContent value="cashflow" className="mt-0"><CashFlow /></TabsContent>
          <TabsContent value="employees" className="mt-0"><Employees /></TabsContent>
        </Tabs>
      ) : (
        <CashFlow />
      )}
    </div>
  );
}

const empty = { kind: "income", category: "", description: "", amount: "", due_date: "", paid_at: "" };

function CashFlow() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: entries } = useQuery({
    queryKey: ["finance"],
    queryFn: async () => (await supabase.from("finance_entries").select("*").order("due_date",{ascending:false})).data ?? [],
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (e: any) => {
    setEditingId(e.id);
    setForm({
      kind: e.kind ?? "income", category: e.category ?? "", description: e.description ?? "",
      amount: e.amount != null ? String(e.amount) : "", due_date: e.due_date ?? "", paid_at: e.paid_at ?? "",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form, amount: Number(form.amount) };
      if (!payload.due_date) payload.due_date = null;
      if (!payload.paid_at) payload.paid_at = null;
      if (editingId) {
        const { error } = await supabase.from("finance_entries").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("finance_entries").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      setEditingId(null);
      setForm(empty);
      toast.success(editingId ? "Lançamento atualizado!" : "Lançamento criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setDeleteTarget(null);
      toast.success("Lançamento excluído!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const income = (entries ?? []).filter((e: any) => e.kind === "income").reduce((s, r: any) => s + Number(r.amount), 0);
  const expense = (entries ?? []).filter((e: any) => e.kind === "expense").reduce((s, r: any) => s + Number(r.amount), 0);
  const profit = income - expense;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(empty); } }}>
          <DialogTrigger asChild><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Lançamento</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Editar lançamento" : "Novo lançamento"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Tipo</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({...form, kind: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Entrada</SelectItem>
                    <SelectItem value="expense">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Categoria</Label><Input value={form.category} onChange={e => setForm({...form, category: e.target.value})} /></div>
                <div><Label>Valor (R$) *</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Vencimento</Label><Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} /></div>
                <div><Label>Pago em</Label><Input type="date" value={form.paid_at} onChange={e => setForm({...form, paid_at: e.target.value})} /></div>
              </div>
            </div>
            <DialogFooter className="sm:justify-between">
              {editingId ? (
                <Button variant="ghost" className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget({ id: editingId, description: form.description })}>
                  <Trash2 className="mr-2 h-4 w-4" />Excluir
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => save.mutate()} disabled={!form.amount || save.isPending}>Salvar</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Entradas" value={brl(income)} icon={ArrowUpRight} accent="success" />
        <StatCard label="Saídas" value={brl(expense)} icon={ArrowDownRight} accent="destructive" />
        <StatCard label="Resultado" value={brl(profit)} icon={TrendingUp} accent={profit >= 0 ? "success" : "destructive"} />
      </div>

      {!entries || entries.length === 0 ? (
        <EmptyState icon={Wallet} title="Nenhum lançamento" description="Comece registrando suas entradas e despesas." />
      ) : (
        <div className="surface-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-surface-2/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Descrição</th>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-left">Vencimento</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e: any) => (
                <tr key={e.id} className="border-b border-border/40 hover:bg-surface-2/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{e.description ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.category ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{shortDate(e.due_date)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={e.paid_at ? "default" : "outline"}>{e.paid_at ? "Pago" : "Pendente"}</Badge>
                  </td>
                  <td className={"px-4 py-3 text-right font-semibold " + (e.kind === "income" ? "text-emerald-400" : "text-red-400")}>
                    {e.kind === "income" ? "+" : "−"} {brl(e.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(e)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteTarget(e)} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir "{deleteTarget?.description || "este lançamento"}" permanentemente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { remove.mutate(deleteTarget.id); setOpen(false); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const emptyEmployee = { full_name: "", role_title: "", salary: "", payment_day: "", benefits: "", notes: "", hired_at: "", status: "active" };

function Employees() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyEmployee);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await (supabase as any).from("employees").select("*").order("full_name")).data ?? [],
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyEmployee);
    setOpen(true);
  };

  const openEdit = (emp: any) => {
    setEditingId(emp.id);
    setForm({
      full_name: emp.full_name ?? "", role_title: emp.role_title ?? "",
      salary: emp.salary != null ? String(emp.salary) : "", payment_day: emp.payment_day != null ? String(emp.payment_day) : "",
      benefits: emp.benefits ?? "", notes: emp.notes ?? "", hired_at: emp.hired_at ?? "", status: emp.status ?? "active",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        ...form,
        salary: form.salary ? Number(form.salary) : null,
        payment_day: form.payment_day ? Number(form.payment_day) : null,
        hired_at: form.hired_at || null,
      };
      if (editingId) {
        const { error } = await (supabase as any).from("employees").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("employees").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setOpen(false); setEditingId(null); setForm(emptyEmployee);
      toast.success(editingId ? "Funcionário atualizado!" : "Funcionário cadastrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setDeleteTarget(null);
      toast.success("Funcionário removido!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalPayroll = (employees ?? []).filter((e: any) => e.status === "active").reduce((s: number, e: any) => s + Number(e.salary ?? 0), 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Visível apenas para administradores.</p>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyEmployee); } }}>
          <DialogTrigger asChild><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Funcionário</Button></DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Editar funcionário" : "Novo funcionário"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome completo *</Label><Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cargo</Label><Input value={form.role_title} onChange={e => setForm({...form, role_title: e.target.value})} /></div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({...form, status: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="on_leave">Afastado</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Salário (R$)</Label><Input type="number" step="0.01" value={form.salary} onChange={e => setForm({...form, salary: e.target.value})} /></div>
                <div><Label>Dia de pagamento</Label><Input type="number" min={1} max={31} value={form.payment_day} onChange={e => setForm({...form, payment_day: e.target.value})} /></div>
              </div>
              <div><Label>Data de admissão</Label><Input type="date" value={form.hired_at} onChange={e => setForm({...form, hired_at: e.target.value})} /></div>
              <div><Label>Benefícios</Label><Textarea rows={2} value={form.benefits} onChange={e => setForm({...form, benefits: e.target.value})} placeholder="Vale-refeição, plano de saúde…" /></div>
              <div><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
            </div>
            <DialogFooter className="sm:justify-between">
              {editingId ? (
                <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ id: editingId, full_name: form.full_name })}>
                  <Trash2 className="mr-2 h-4 w-4" />Excluir
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => save.mutate()} disabled={!form.full_name || save.isPending}>Salvar</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <StatCard label="Folha de pagamento (ativos)" value={brl(totalPayroll)} icon={Users2} />
      </div>

      {(!employees || employees.length === 0) ? (
        <EmptyState icon={Users2} title="Nenhum funcionário cadastrado" description="Cadastre cargo, salário e benefícios da equipe." />
      ) : (
        <div className="surface-card divide-y divide-border/50 overflow-hidden">
          {employees.map((emp: any) => (
            <div key={emp.id} className="flex items-center justify-between gap-3 p-4 transition hover:bg-surface-2/50">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/15 text-primary">{initials(emp.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate font-medium">{emp.full_name}</div>
                  <div className="truncate text-xs text-muted-foreground">{emp.role_title ?? "Sem cargo"} · {brl(emp.salary)}{emp.payment_day ? ` · dia ${emp.payment_day}` : ""}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={emp.status === "active" ? "default" : "secondary"} className="capitalize">{emp.status}</Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(emp)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteTarget(emp)} className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funcionário?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir o cadastro de "{deleteTarget?.full_name}" permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { remove.mutate(deleteTarget.id); setOpen(false); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
