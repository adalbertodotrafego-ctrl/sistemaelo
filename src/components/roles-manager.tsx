import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ALL_PAGES } from "@/hooks/use-permissions";

// Núcleo do gerenciador de Cargos & Permissões — usado tanto em Equipe (dentro
// de um diálogo) quanto em Configurações (embutido direto na página).
export function RolesManager({ jobRoles }: { jobRoles: any[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", description: "", allowed_pages: [] as string[] });

  const startNew = () => { setEditing({}); setForm({ name: "", description: "", allowed_pages: [] }); };
  const startEdit = (r: any) => { setEditing(r); setForm({ name: r.name, description: r.description ?? "", allowed_pages: r.allowed_pages ?? [] }); };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome do cargo é obrigatório");
      if (editing?.id) {
        const { error } = await supabase.from("job_roles").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("job_roles").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-roles"] });
      setEditing(null);
      toast.success("Cargo salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("job_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["job-roles"] }); toast.success("Cargo removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePage = (key: string) => {
    setForm((f) => ({
      ...f,
      allowed_pages: f.allowed_pages.includes(key) ? f.allowed_pages.filter((k) => k !== key) : [...f.allowed_pages, key],
    }));
  };

  if (!editing) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button size="sm" onClick={startNew}><Plus className="mr-2 h-4 w-4" />Novo cargo</Button>
        </div>
        <div className="space-y-2">
          {jobRoles.length === 0 && (
            <p className="rounded-lg border border-dashed border-border/50 p-4 text-center text-xs text-muted-foreground">
              Nenhum cargo cadastrado ainda.
            </p>
          )}
          {jobRoles.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="min-w-0">
                <div className="font-medium">{r.name} {r.is_system && <Badge variant="outline" className="ml-2 text-[10px]">sistema</Badge>}</div>
                <div className="truncate text-xs text-muted-foreground">{r.allowed_pages?.length ?? 0} páginas permitidas</div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => startEdit(r)}><Pencil className="h-4 w-4" /></Button>
                {!r.is_system && (
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div><Label>Nome do cargo *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Designer Gráfico" /></div>
      <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
      <div>
        <Label>Páginas que este cargo pode acessar</Label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ALL_PAGES.map((p) => (
            <label key={p.key} className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-surface/50">
              <Checkbox checked={form.allowed_pages.includes(p.key)} onCheckedChange={() => togglePage(p.key)} />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setEditing(null)}>Voltar</Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar cargo</Button>
      </div>
    </div>
  );
}

export function ManageRolesDialog({ open, onOpenChange, jobRoles }: { open: boolean; onOpenChange: (v: boolean) => void; jobRoles: any[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Cargos & Permissões</DialogTitle></DialogHeader>
        <RolesManager jobRoles={jobRoles} />
      </DialogContent>
    </Dialog>
  );
}
