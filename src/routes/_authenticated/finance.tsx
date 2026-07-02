import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { brl, shortDate } from "@/lib/format";
import { Wallet, ArrowUpRight, ArrowDownRight, Plus, TrendingUp, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Financeiro — Elo Marketing OS" }] }),
  component: FinancePage,
});

const empty = { kind: "income", category: "", description: "", amount: "", due_date: "", paid_at: "" };

function FinancePage() {
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
      <PageHeader
        eyebrow="Agência"
        title="Financeiro"
        description="Acompanhe entradas, saídas e resultado da agência."
        actions={
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
        }
      />

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
