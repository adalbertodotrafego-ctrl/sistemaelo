import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-extras/page";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { initials } from "@/lib/format";
import { useCurrentUser } from "@/hooks/use-auth";
import { LogOut, Upload, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Meu perfil — Sistema Elo Marketing" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });

  const [form, setForm] = useState({ full_name: "", role_title: "", phone: "", avatar_url: "" });
  useEffect(() => {
    if (profile) setForm({
      full_name: profile.full_name ?? "",
      role_title: profile.role_title ?? "",
      phone: profile.phone ?? "",
      avatar_url: profile.avatar_url ?? "",
    });
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Perfil atualizado!"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      setUploading(true);
      const url = await uploadImage("avatars", file, user.id);
      setForm(f => ({ ...f, avatar_url: url }));
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Foto atualizada!");
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div>
      <PageHeader eyebrow="Conta" title="Meu perfil" description="Suas informações pessoais." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="surface-card p-6 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={form.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/15 text-2xl text-primary">{initials(form.full_name || user?.email)}</AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
                aria-label="Trocar foto"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
            </div>
            <div className="mt-4 font-display text-lg font-semibold">{form.full_name || "Sem nome"}</div>
            <div className="text-sm text-muted-foreground">{user?.email}</div>
          </div>
          <Button variant="destructive" className="mt-6 w-full" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair da conta
          </Button>
        </div>

        <div className="surface-card space-y-4 p-6 lg:col-span-2">
          <div><Label>Nome completo</Label><Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} /></div>
          <div><Label>Cargo</Label><Input value={form.role_title} onChange={e => setForm({...form, role_title: e.target.value})} /></div>
          <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar alterações</Button>
        </div>
      </div>

      <div className="mt-6">
        <TeamsSection />
      </div>
    </div>
  );
}

const emptyTeam = { name: "", description: "", color: "#2563EB" };

function TeamsSection() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyTeam);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await (supabase as any).from("teams").select("*, team_members(user_id)").order("name")).data ?? [],
  });
  const { data: profiles } = useQuery({
    queryKey: ["team-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, avatar_url").order("full_name")).data ?? [],
  });

  const openCreate = () => { setEditingId(null); setForm(emptyTeam); setMemberIds([]); setOpen(true); };
  const openEdit = (t: any) => {
    setEditingId(t.id);
    setForm({ name: t.name ?? "", description: t.description ?? "", color: t.color ?? "#2563EB" });
    setMemberIds((t.team_members ?? []).map((m: any) => m.user_id));
    setOpen(true);
  };
  const toggleMember = (id: string) => setMemberIds((m) => m.includes(id) ? m.filter((x) => x !== id) : [...m, id]);

  const save = useMutation({
    mutationFn: async () => {
      let teamId = editingId;
      if (editingId) {
        const { error } = await (supabase as any).from("teams").update(form).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from("teams").insert(form).select().single();
        if (error) throw error;
        teamId = data.id;
      }
      await (supabase as any).from("team_members").delete().eq("team_id", teamId);
      if (memberIds.length > 0) {
        await (supabase as any).from("team_members").insert(memberIds.map((user_id) => ({ team_id: teamId, user_id })));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      setOpen(false); setEditingId(null); setForm(emptyTeam); setMemberIds([]);
      toast.success(editingId ? "Equipe atualizada!" : "Equipe criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      setDeleteTarget(null);
      toast.success("Equipe removida!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="surface-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-display text-lg font-semibold">Equipes</div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyTeam); setMemberIds([]); } }}>
          <DialogTrigger asChild><Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nova equipe</Button></DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Editar equipe" : "Nova equipe"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><Label>Descrição</Label><Textarea rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
              <div className="flex items-center gap-3">
                <Label>Cor</Label>
                <input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="h-9 w-14 cursor-pointer rounded border border-border/60 bg-transparent" />
              </div>
              <div>
                <Label>Membros</Label>
                <div className="mt-1 max-h-52 space-y-0.5 overflow-y-auto rounded-md border border-border/60 p-2">
                  {(profiles ?? []).map((p: any) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                      <Checkbox checked={memberIds.includes(p.id)} onCheckedChange={() => toggleMember(p.id)} />
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={p.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[9px]">{initials(p.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{p.full_name ?? p.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="sm:justify-between">
              {editingId ? (
                <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ id: editingId, name: form.name })}>
                  <Trash2 className="mr-2 h-4 w-4" />Excluir
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>Salvar</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {(!teams || teams.length === 0) ? (
        <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          Nenhuma equipe criada ainda.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t: any) => {
            const members = (t.team_members ?? []).map((m: any) => (profiles ?? []).find((p: any) => p.id === m.user_id)).filter(Boolean);
            return (
              <button key={t.id} onClick={() => openEdit(t)} className="rounded-lg border border-border/60 bg-surface-2/40 p-4 text-left transition hover:border-primary/40 hover:shadow-elegant">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="truncate font-medium">{t.name}</span>
                </div>
                {t.description && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{t.description}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex -space-x-1.5">
                    {members.slice(0, 5).map((m: any) => (
                      <Avatar key={m.id} className="h-6 w-6 border border-background">
                        <AvatarImage src={m.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[9px]">{initials(m.full_name)}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{members.length} membro{members.length !== 1 ? "s" : ""}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir equipe?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir a equipe "{deleteTarget?.name}" permanentemente. Essa ação não pode ser desfeita.
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
