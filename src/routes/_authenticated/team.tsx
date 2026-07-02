import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initials } from "@/lib/format";
import { UserCog, Mail, Phone, Plus, Shield, Pencil, Trash2, ShieldCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { usePermissions, ALL_PAGES } from "@/hooks/use-permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { removeMember } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Equipe — Elo Marketing OS" }] }),
  component: TeamPage,
});

function TeamPage() {
  const qc = useQueryClient();
  const { isAdmin } = usePermissions();
  const { user } = useCurrentUser();
  const removeFn = useServerFn(removeMember);
  const [rolesOpen, setRolesOpen] = useState(false);

  const { data: team } = useQuery({
    queryKey: ["team"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("full_name")).data ?? [],
  });
  const { data: roles } = useQuery({
    queryKey: ["all-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("user_id, role")).data ?? [],
  });
  const { data: jobRoles } = useQuery({
    queryKey: ["job-roles"],
    queryFn: async () => (await supabase.from("job_roles").select("*").order("name")).data ?? [],
  });

  const setJobRole = useMutation({
    mutationFn: async ({ userId, jobRoleId }: { userId: string; jobRoleId: string | null }) => {
      const job = jobRoles?.find((j: any) => j.id === jobRoleId);
      const { error } = await supabase
        .from("profiles")
        .update({ job_role_id: jobRoleId, role_title: job?.name ?? null } as any)
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); toast.success("Cargo atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleOf = (id: string) => roles?.find((r: any) => r.user_id === id)?.role ?? "member";

  const setAdmin = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => {
      if (makeAdmin) {
        const { error } = await supabase.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all-roles"] }); toast.success("Permissão atualizada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const kick = useMutation({
    mutationFn: async (userId: string) => await removeFn({ data: { userId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); qc.invalidateQueries({ queryKey: ["all-roles"] }); toast.success("Membro removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Agência"
        title="Equipe"
        description="Pessoas que fazem a Elo Marketing acontecer."
        actions={
          isAdmin ? (
            <Button onClick={() => setRolesOpen(true)} variant="outline">
              <Shield className="mr-2 h-4 w-4" /> Gerenciar cargos
            </Button>
          ) : undefined
        }
      />

      {!team || team.length === 0 ? (
        <EmptyState icon={UserCog} title="Sem colaboradores ainda" description="Os usuários aparecem aqui assim que se cadastram." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((m: any) => (
            <div key={m.id} className="surface-card p-5">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/15 text-primary">{initials(m.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-base font-semibold">{m.full_name ?? "Sem nome"}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.role_title ?? "Sem cargo"}</div>
                </div>
                <Badge variant="outline" className="capitalize">{roleOf(m.id)}</Badge>
              </div>
              <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                {m.email && <div className="inline-flex items-center gap-1.5"><Mail className="h-3 w-3" />{m.email}</div>}
                {m.phone && <div className="inline-flex items-center gap-1.5"><Phone className="h-3 w-3" />{m.phone}</div>}
              </div>
              {isAdmin && (
                <div className="mt-4 space-y-3">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Cargo</Label>
                    <Select
                      value={m.job_role_id ?? "none"}
                      onValueChange={(v) => setJobRole.mutate({ userId: m.id, jobRoleId: v === "none" ? null : v })}
                    >
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Sem cargo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem cargo</SelectItem>
                        {jobRoles?.map((j: any) => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    {roleOf(m.id) === "admin" ? (
                      <Button size="sm" variant="outline" className="flex-1" disabled={m.id === user?.id} onClick={() => setAdmin.mutate({ userId: m.id, makeAdmin: false })}>
                        <ShieldCheck className="mr-1 h-3 w-3" /> Remover admin
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setAdmin.mutate({ userId: m.id, makeAdmin: true })}>
                        <Shield className="mr-1 h-3 w-3" /> Tornar admin
                      </Button>
                    )}
                    {m.id !== user?.id && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-destructive"><UserX className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Expulsar {m.full_name ?? m.email}?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação remove o membro da agência e revoga o acesso imediatamente. Não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => kick.mutate(m.id)}>Expulsar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ManageRolesDialog open={rolesOpen} onOpenChange={setRolesOpen} jobRoles={jobRoles ?? []} />
    </div>
  );
}

function ManageRolesDialog({ open, onOpenChange, jobRoles }: { open: boolean; onOpenChange: (v: boolean) => void; jobRoles: any[] }) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Cargos & Permissões</DialogTitle></DialogHeader>

        {!editing ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={startNew}><Plus className="mr-2 h-4 w-4" />Novo cargo</Button>
            </div>
            <div className="space-y-2">
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
        ) : (
          <div className="space-y-4">
            <div><Label>Nome do cargo *</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Ex: Designer Gráfico" /></div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} rows={2} /></div>
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
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>Voltar</Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar cargo</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
