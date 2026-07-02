import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { uploadImage } from "@/lib/storage";
import { Upload, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — Sistema Elo Marketing" }] }),
  component: SettingsPage,
});

function SettingsPage() {
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
    <div>
      <PageHeader eyebrow="Conta" title="Configurações" description="Identidade e preferências da agência." />
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
    </div>
  );
}
