import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { uploadImage } from "@/lib/storage";
import { Upload, Loader2, ShieldOff, Shield, Users2, ArrowRight } from "lucide-react";
import { usePermissions, TOGGLEABLE_PAGES } from "@/hooks/use-permissions";
import { RolesManager } from "@/components/roles-manager";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — Sistema Elo Marketing" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin } = usePermissions();

  return (
    <div>
      <PageHeader eyebrow="Conta" title="Configurações" description="Identidade, cargos, seções e equipe — tudo num só lugar." />
      {!isAdmin ? (
        <EmptyState icon={ShieldOff} title="Área restrita" description="Apenas administradores podem alterar as configurações do sistema." />
      ) : (
        <Tabs defaultValue="identity">
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="identity">Identidade</TabsTrigger>
            <TabsTrigger value="roles">Cargos & Permissões</TabsTrigger>
            <TabsTrigger value="sections">Seções do sistema</TabsTrigger>
            <TabsTrigger value="team">Equipe</TabsTrigger>
          </TabsList>
          <TabsContent value="identity" className="mt-0"><IdentityTab /></TabsContent>
          <TabsContent value="roles" className="mt-0"><RolesTab /></TabsContent>
          <TabsContent value="sections" className="mt-0"><SectionsTab /></TabsContent>
          <TabsContent value="team" className="mt-0"><TeamShortcutTab /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function IdentityTab() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { data } = useQuery({
    queryKey: ["agency-settings"],
    queryFn: async () => (await supabase.from("agency_settings").select("*").limit(1).maybeSingle()).data,
  });

  const [form, setForm] = useState({ name: "", logo_url: "", primary_color: "#2563EB" });
  useEffect(() => {
    if (data) setForm({ name: data.name ?? "", logo_url: data.logo_url ?? "", primary_color: data.primary_color ?? "#2563EB" });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const { error } = await supabase.from("agency_settings").update(form).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agency-settings"] }); toast.success("Configurações salvas"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const onPickLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const url = await uploadImage("logos", file, "agency");
      setForm(f => ({ ...f, logo_url: url }));
      if (data) await supabase.from("agency_settings").update({ logo_url: url }).eq("id", data.id);
      qc.invalidateQueries({ queryKey: ["agency-settings"] });
      toast.success("Logo atualizado!");
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  return (
    <div className="surface-card max-w-2xl space-y-4 p-6">
      <div><Label>Nome da agência</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
      <div>
        <Label>Logo</Label>
        <div className="mt-2 flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-surface/40">
            {form.logo_url ? <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain" /> : <span className="text-[10px] text-muted-foreground">Sem logo</span>}
          </div>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Enviar imagem
          </Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickLogo} />
        </div>
      </div>
      <div><Label>Cor principal</Label>
        <div className="flex gap-2">
          <Input value={form.primary_color} onChange={e => setForm({...form, primary_color: e.target.value})} />
          <input type="color" value={form.primary_color} onChange={e => setForm({...form, primary_color: e.target.value})} className="h-10 w-14 cursor-pointer rounded border border-border/60 bg-transparent" />
        </div>
      </div>
      <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
    </div>
  );
}

function RolesTab() {
  const { data: jobRoles } = useQuery({
    queryKey: ["job-roles"],
    queryFn: async () => (await supabase.from("job_roles").select("*").order("name")).data ?? [],
  });
  return (
    <div className="surface-card max-w-2xl p-6">
      <p className="mb-4 text-sm text-muted-foreground">
        Cada cargo define quais seções do sistema seus membros conseguem ver. Um membro sem cargo atribuído enxerga tudo por padrão.
      </p>
      <RolesManager jobRoles={jobRoles ?? []} />
    </div>
  );
}

function SectionsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["agency-settings"],
    queryFn: async () => (await supabase.from("agency_settings").select("*").limit(1).maybeSingle()).data,
  });
  const [disabled, setDisabled] = useState<string[]>([]);
  useEffect(() => {
    setDisabled(((data as any)?.disabled_pages as string[]) ?? []);
  }, [data]);

  const dirty = JSON.stringify([...disabled].sort()) !== JSON.stringify([...(((data as any)?.disabled_pages as string[]) ?? [])].sort());

  const toggle = (key: string, enabled: boolean) => {
    setDisabled((d) => (enabled ? d.filter((k) => k !== key) : [...d, key]));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const { error } = await (supabase as any).from("agency_settings").update({ disabled_pages: disabled }).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agency-settings"] });
      qc.invalidateQueries({ queryKey: ["agency-disabled-pages"] });
      toast.success("Seções atualizadas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="surface-card max-w-2xl p-6">
      <p className="mb-4 text-sm text-muted-foreground">
        Desligue aqui as seções que a agência não usa. Elas somem do menu para <strong>todo mundo</strong>, inclusive administradores,
        até serem religadas nesta mesma tela.
      </p>
      <div className="space-y-1">
        {TOGGLEABLE_PAGES.map((p) => {
          const enabled = !disabled.includes(p.key);
          return (
            <div key={p.key} className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
              <span className="text-sm font-medium">{p.label}</span>
              <Switch checked={enabled} onCheckedChange={(v) => toggle(p.key, v)} />
            </div>
          );
        })}
      </div>
      <Button className="mt-4" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>Salvar</Button>
    </div>
  );
}

function TeamShortcutTab() {
  const { data: count } = useQuery({
    queryKey: ["team-count"],
    queryFn: async () => (await supabase.from("profiles").select("*", { count: "exact", head: true })).count ?? 0,
  });
  return (
    <div className="surface-card max-w-2xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Users2 className="h-5 w-5" /></div>
        <div>
          <div className="font-display text-lg font-semibold">{count ?? "—"} pessoas na equipe</div>
          <div className="text-xs text-muted-foreground">Gerenciar membros, admins e cargo de cada um fica na página Equipe.</div>
        </div>
      </div>
      <Button asChild>
        <Link to="/team"><Shield className="mr-2 h-4 w-4" />Ir para Equipe<ArrowRight className="ml-2 h-4 w-4" /></Link>
      </Button>
    </div>
  );
}
