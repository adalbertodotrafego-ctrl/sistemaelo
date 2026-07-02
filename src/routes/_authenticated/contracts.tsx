import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatCard } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Download, AlertTriangle, DollarSign, FileSignature, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { brl, shortDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/contracts")({
  head: () => ({ meta: [{ title: "Contratos — Elo Marketing OS" }] }),
  component: ContractsPage,
});

const empty = { title: "", client_id: "", value: "", status: "active", signed_at: "", renewal_at: "", notes: "" };

function ContractsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingFilePath, setExistingFilePath] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: contracts } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => (await supabase.from("contracts").select("*, clients(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });

  const openCreate = () => {
    setEditingId(null);
    setExistingFilePath(null);
    setForm(empty);
    setFile(null);
    setOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setExistingFilePath(c.file_path ?? null);
    setForm({
      title: c.title ?? "", client_id: c.client_id ?? "", value: c.value != null ? String(c.value) : "",
      status: c.status ?? "active", signed_at: c.signed_at ?? "", renewal_at: c.renewal_at ?? "", notes: c.notes ?? "",
    });
    setFile(null);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      let file_path: string | null = existingFilePath;
      if (file) {
        setUploading(true);
        const ext = file.name.split(".").pop();
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("contracts").upload(path, file);
        if (upErr) throw upErr;
        file_path = path;
      }
      const payload: any = { ...form, file_path };
      payload.value = payload.value === "" ? null : Number(payload.value);
      if (!payload.client_id) payload.client_id = null;
      if (!payload.signed_at) payload.signed_at = null;
      if (!payload.renewal_at) payload.renewal_at = null;
      if (editingId) {
        const { error } = await supabase.from("contracts").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contracts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      setOpen(false); setEditingId(null); setExistingFilePath(null); setForm(empty); setFile(null); setUploading(false);
      toast.success(editingId ? "Contrato atualizado!" : "Contrato criado!");
    },
    onError: (e: Error) => { setUploading(false); toast.error(e.message); },
  });

  const remove = useMutation({
    mutationFn: async (c: any) => {
      const { error } = await supabase.from("contracts").delete().eq("id", c.id);
      if (error) throw error;
      if (c.file_path) await supabase.storage.from("contracts").remove([c.file_path]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      setDeleteTarget(null);
      toast.success("Contrato excluído!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("contracts").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const total = (contracts ?? []).reduce((s: number, c: any) => s + Number(c.value ?? 0), 0);
  const active = (contracts ?? []).filter((c: any) => c.status === "active").length;
  const expiringSoon = (contracts ?? []).filter((c: any) => {
    if (!c.renewal_at) return false;
    const d = (new Date(c.renewal_at).getTime() - Date.now()) / 86400000;
    return d > 0 && d <= 30;
  }).length;

  return (
    <div>
      <PageHeader
        eyebrow="Agência"
        title="Contratos"
        description="Upload de PDF, valores e datas de renovação centralizados."
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setExistingFilePath(null); setForm(empty); setFile(null); } }}>
            <DialogTrigger asChild><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo contrato</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Editar contrato" : "Novo contrato"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
                <div><Label>Cliente</Label>
                  <Select value={form.client_id} onValueChange={v => setForm({...form, client_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{(clients ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.value} onChange={e => setForm({...form, value: e.target.value})} /></div>
                  <div><Label>Status</Label>
                    <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="expired">Expirado</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Assinatura</Label><Input type="date" value={form.signed_at} onChange={e => setForm({...form, signed_at: e.target.value})} /></div>
                  <div><Label>Renovação</Label><Input type="date" value={form.renewal_at} onChange={e => setForm({...form, renewal_at: e.target.value})} /></div>
                </div>
                <div>
                  <Label>Arquivo (PDF){existingFilePath ? " — já tem um arquivo enviado" : ""}</Label>
                  <Input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  {existingFilePath && !file && <p className="mt-1 text-[11px] text-muted-foreground">Selecione um novo arquivo para substituir o atual, ou deixe em branco para manter.</p>}
                </div>
                <div><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              </div>
              <DialogFooter className="sm:justify-between">
                {editingId ? (
                  <Button variant="ghost" className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget({ id: editingId, title: form.title, file_path: existingFilePath })}>
                    <Trash2 className="mr-2 h-4 w-4" />Excluir
                  </Button>
                ) : <span />}
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={() => save.mutate()} disabled={!form.title || uploading || save.isPending}>{uploading ? "Enviando..." : "Salvar"}</Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Contratos ativos" value={active} icon={FileSignature} accent="success" />
        <StatCard label="Valor contratado" value={brl(total)} icon={DollarSign} />
        <StatCard label="Vencem em 30d" value={expiringSoon} icon={AlertTriangle} accent="warning" />
      </div>

      {(contracts?.length ?? 0) === 0 ? (
        <EmptyState icon={FileText} title="Nenhum contrato" description="Faça upload do primeiro contrato em PDF." />
      ) : (
        <div className="surface-card divide-y divide-border/50 overflow-hidden">
          {contracts!.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between gap-3 p-4 transition hover:bg-surface-2/50">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary"><FileText className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {c.clients?.name ?? "Sem cliente"} · {brl(c.value ?? 0)} · Renova {shortDate(c.renewal_at)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.status === "active" ? "default" : "secondary"} className="capitalize">{c.status}</Badge>
                {c.file_path && (
                  <Button size="sm" variant="outline" onClick={() => download(c.file_path)}>
                    <Download className="mr-1 h-3 w-3" />PDF
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
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
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir "{deleteTarget?.title}"{deleteTarget?.file_path ? " e o PDF anexado" : ""} permanentemente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { remove.mutate(deleteTarget); setOpen(false); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
