import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { initials, brl } from "@/lib/format";
import { Users, Plus, Search, Building2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({ meta: [{ title: "Clientes — Elo Marketing OS" }] }),
  component: ClientsPage,
});

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo", paused: "Pausado", churned: "Cancelado", prospect: "Prospect",
};

const emptyForm = {
  name: "", company: "", segment: "", email: "", phone: "",
  whatsapp: "", city: "", state: "", plan: "", monthly_value: "", status: "active",
};

function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      name: c.name ?? "", company: c.company ?? "", segment: c.segment ?? "",
      email: c.email ?? "", phone: c.phone ?? "", whatsapp: c.whatsapp ?? "",
      city: c.city ?? "", state: c.state ?? "", plan: c.plan ?? "",
      monthly_value: c.monthly_value != null ? String(c.monthly_value) : "",
      status: c.status ?? "active",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        monthly_value: form.monthly_value ? Number(form.monthly_value) : 0,
      } as any;
      if (editingId) {
        const { error } = await supabase.from("clients").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Cliente atualizado!" : "Cliente cadastrado!");
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
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

  const filtered = (clients ?? []).filter((c: any) =>
    [c.name, c.company, c.email, c.segment].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase()),
  );

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
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Novo cliente</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>{editingId ? "Editar cliente" : "Cadastrar novo cliente"}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    ["name","Nome do contato *"],["company","Empresa"],["segment","Segmento"],
                    ["email","Email"],["phone","Telefone"],["whatsapp","WhatsApp"],
                    ["city","Cidade"],["state","Estado"],["plan","Plano contratado"],
                    ["monthly_value","Valor mensal (R$)"],
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

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c: any) => (
            <div key={c.id} className="surface-card group relative p-5 transition-all hover:-translate-y-0.5 hover:shadow-elegant">
              <div className="absolute right-3 top-3 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                    <DropdownMenuItem onClick={() => openEdit(c)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteTarget(c)} className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Link to="/clients/$id" params={{ id: c.id }} className="block">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/15 text-primary">{initials(c.company ?? c.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 pr-6">
                    <div className="truncate font-display text-base font-semibold">{c.company ?? c.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.name}</div>
                  </div>
                  <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-[10px]">{STATUS_LABELS[c.status]}</Badge>
                </div>
                <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  {c.segment && <div className="flex items-center gap-1.5"><Building2 className="h-3 w-3" />{c.segment}</div>}
                  {c.email && <div className="truncate">{c.email}</div>}
                </div>
                <div className="mt-4 flex items-end justify-between border-t border-border/60 pt-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Mensalidade</div>
                    <div className="font-display text-lg font-semibold">{brl(c.monthly_value)}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{c.plan ?? "—"}</div>
                </div>
              </Link>
            </div>
          ))}
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
    </div>
  );
}
