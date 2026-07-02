import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-extras/page";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initials } from "@/lib/format";
import { useCurrentUser } from "@/hooks/use-auth";
import { LogOut, Upload, Loader2 } from "lucide-react";
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
    </div>
  );
}
