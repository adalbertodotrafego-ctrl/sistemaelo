import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initials } from "@/lib/format";
import { UserCog, Mail, Phone, Shield, ShieldCheck, UserX, Clock, Check, X } from "lucide-react";
import { notifyUsers } from "@/lib/notifications";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { removeMember } from "@/lib/team.functions";
import { ManageRolesDialog } from "@/components/roles-manager";

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

  // Uma pessoa pode ter mais de um papel (é comum ter 'member' E 'admin').
  // Procurar só a primeira linha mostrava "member" para quem também era admin —
  // e o botão oferecia "Tornar admin" para quem já era. O que vale é ter a
  // linha de admin, igual ao has_role() que o banco usa nas policies.
  const isAdminUser = (id: string) => (roles ?? []).some((r: any) => r.user_id === id && r.role === "admin");
  const roleOf = (id: string) => (isAdminUser(id) ? "admin" : "member");

  const setAdmin = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => {
      if (makeAdmin) {
        const { error } = await supabase.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
        if (error) throw error;
      } else {
        // Só admin pode mexer em papéis: tirar o último deixaria o sistema sem
        // ninguém capaz de devolver a permissão.
        const admins = (roles ?? []).filter((r: any) => r.role === "admin");
        if (admins.length <= 1) {
          throw new Error("Este é o último administrador — promova outra pessoa antes de remover.");
        }
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

  // Aprova o acesso de quem está pendente (conta criada mas ainda sem liberação).
  const approve = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("profiles").update({ approved: true } as any).eq("id", userId);
      if (error) throw error;
      await notifyUsers([userId], { kind: "success", title: "Acesso liberado! 🎉", body: "Sua conta na Elo foi aprovada — bem-vindo!", link: "/dashboard" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); toast.success("Acesso aprovado!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Quem já está no sistema (aprovado) vs quem aguarda liberação.
  // Se a coluna approved ainda não existir (migração pendente), trata como aprovado.
  const isApproved = (m: any) => m.approved !== false;
  const pending = (team ?? []).filter((m: any) => !isApproved(m));
  const activeMembers = (team ?? []).filter((m: any) => isApproved(m));

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

      {isAdmin && pending.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <h2 className="font-display text-sm font-semibold">Solicitações de acesso</h2>
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">{pending.length}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {pending.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-amber-500/15 text-amber-300">{initials(m.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.full_name ?? "Sem nome"}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{m.email}</div>
                </div>
                <Button size="sm" className="h-8" onClick={() => approve.mutate(m.id)} disabled={approve.isPending}>
                  <Check className="mr-1 h-3.5 w-3.5" />Aprovar
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => kick.mutate(m.id)} title="Recusar e remover">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!team || activeMembers.length === 0 ? (
        <EmptyState icon={UserCog} title="Sem colaboradores ainda" description="Os usuários aparecem aqui assim que se cadastram e são aprovados." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeMembers.map((m: any) => (
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
