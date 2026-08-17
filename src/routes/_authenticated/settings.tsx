import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { uploadImage } from "@/lib/storage";
import {
  Upload, Loader2, Shield, Users2, ArrowRight, Sun, Moon, HelpCircle, ChevronDown,
  Lock, Database, KeyRound, BellRing,
} from "lucide-react";
import { usePermissions, TOGGLEABLE_PAGES } from "@/hooks/use-permissions";
import { useLang } from "@/hooks/use-language";
import { useTheme } from "@/hooks/use-theme";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { RolesManager } from "@/components/roles-manager";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — Elo Marketing OS" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin } = usePermissions();
  const { t } = useLang();

  return (
    <div>
      <PageHeader eyebrow="Conta" title={t("settings.title")} description="Preferências, ajuda, privacidade e administração do sistema." />

      <div className="space-y-10">
        <Section title={t("settings.preferences")}><PreferencesTab /></Section>
        <Section title="Notificações"><NotificationsTab /></Section>
        <Section title="Segurança"><SecurityTab /></Section>
        <Section title={t("settings.faq")}><FaqTab /></Section>
        <Section title={t("settings.privacy")}><PrivacyTab /></Section>
        <Section title={t("settings.about")}><AboutTab /></Section>
        {isAdmin && <Section title="Identidade da agência"><IdentityTab /></Section>}
        {isAdmin && <Section title="Cargos & Permissões"><RolesTab /></Section>}
        {isAdmin && <Section title="Seções do sistema"><SectionsTab /></Section>}
        {isAdmin && <Section title="Equipe"><TeamShortcutTab /></Section>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 border-b border-border/60 pb-2 font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function PreferencesTab() {
  const { lang, setLang, t } = useLang();
  const { theme, toggle } = useTheme();
  return (
    <div className="max-w-xl space-y-4">
      <div className="surface-card flex items-center justify-between p-4">
        <div>
          <div className="text-sm font-medium">{t("settings.language")}</div>
          <div className="text-xs text-muted-foreground">Idioma da interface (navegação e configurações).</div>
        </div>
        <div className="inline-flex rounded-lg border border-border/60 p-0.5">
          {(["pt", "en"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)}
              className={"rounded-md px-3 py-1.5 text-xs font-medium transition " + (lang === l ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>
              {l === "pt" ? "🇧🇷 Português" : "🇺🇸 English"}
            </button>
          ))}
        </div>
      </div>
      <div className="surface-card flex items-center justify-between p-4">
        <div>
          <div className="text-sm font-medium">{t("settings.theme")}</div>
          <div className="text-xs text-muted-foreground">Alterne entre claro e escuro.</div>
        </div>
        <Button variant="outline" onClick={toggle}>
          {theme === "dark" ? <><Sun className="mr-2 h-4 w-4" />Escuro</> : <><Moon className="mr-2 h-4 w-4" />Claro</>}
        </Button>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const push = usePushNotifications();

  return (
    <div className="max-w-xl space-y-4">
      <div className="surface-card flex items-center justify-between p-4">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-medium"><BellRing className="h-4 w-4 text-primary" />Avisos no navegador</div>
          <div className="text-xs text-muted-foreground">
            {push.supported
              ? "Receba notificações do sistema (menções, reuniões, novidades) mesmo com a aba fechada."
              : "Seu navegador não tem suporte a notificações push."}
          </div>
        </div>
        <Switch
          checked={push.subscribed}
          disabled={!push.supported || push.loading}
          onCheckedChange={(v) => {
            if (v) push.subscribe().then(() => toast.success("Notificações ativadas neste navegador!")).catch((err: Error) => toast.error(err.message));
            else push.unsubscribe().catch((err: Error) => toast.error(err.message));
          }}
        />
      </div>
    </div>
  );
}

function SecurityTab() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const changePassword = useMutation({
    mutationFn: async () => {
      if (password.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres");
      if (password !== confirm) throw new Error("As senhas não coincidem");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Senha atualizada!"); setPassword(""); setConfirm(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="surface-card max-w-xl space-y-4 p-6">
      <div className="flex items-center gap-2 text-sm font-medium"><KeyRound className="h-4 w-4 text-primary" />Alterar senha</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Nova senha</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" /></div>
        <div><Label>Confirmar senha</Label><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
      </div>
      <Button onClick={() => changePassword.mutate()} disabled={!password || !confirm || changePassword.isPending}>Atualizar senha</Button>
    </div>
  );
}

const FAQS = [
  { q: "Como convido alguém para o sistema?", a: "No topo, clique no ícone de convite (👤+) e gere um link. Envie por WhatsApp ou e-mail — quem abrir cria a conta e um admin aprova na aba Equipe." },
  { q: "Por que meu quadro de Tarefas não aparece para todo mundo?", a: "Cada quadro é visível só para seus responsáveis. Um admin define quem enxerga em cada quadro pelo botão de Permissões." },
  { q: "Como funciona a verba de mídia nos Clientes?", a: "É a soma do orçamento diário das campanhas ativas (Meta + Google Ads), atualizada sozinha. Depende dos tokens configurados no servidor." },
  { q: "Uma demanda recorrente sumiu, e agora?", a: "Ela volta a ficar pendente sozinha quando vira o período (dia/semana/mês) — basta abrir o quadro. O gatilho é marcar o status de conclusão." },
  { q: "Como troco o idioma ou o tema?", a: "Aqui em Configurações → Preferências. O idioma cobre a navegação e as configurações; o resto é traduzido aos poucos." },
];

function FaqTab() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="max-w-2xl space-y-2">
      {FAQS.map((f, i) => (
        <div key={i} className="surface-card overflow-hidden">
          <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
            <span className="flex items-center gap-2 text-sm font-medium"><HelpCircle className="h-4 w-4 shrink-0 text-primary" />{f.q}</span>
            <ChevronDown className={"h-4 w-4 shrink-0 text-muted-foreground transition " + (open === i ? "rotate-180" : "")} />
          </button>
          {open === i && <div className="border-t border-border/60 px-4 pb-4 pt-3 text-sm text-muted-foreground">{f.a}</div>}
        </div>
      ))}
    </div>
  );
}

function PrivacyTab() {
  return (
    <div className="surface-card max-w-2xl space-y-3 p-6 text-sm text-muted-foreground">
      <h3 className="flex items-center gap-2 font-display text-base font-semibold text-foreground"><Lock className="h-4 w-4 text-primary" />Política de Privacidade</h3>
      <p>O Elo Marketing OS é um sistema interno e privado da Elo Marketing. Os dados aqui registrados — clientes, campanhas, demandas, financeiro — são de uso exclusivo da agência e da sua equipe autorizada.</p>
      <p><strong className="text-foreground">Acesso.</strong> Cada conta é aprovada por um administrador. O acesso a cada área respeita as permissões do seu cargo, e cada quadro de Tarefas é restrito aos seus responsáveis.</p>
      <p><strong className="text-foreground">Dados de terceiros.</strong> Integrações (Meta Ads, Google Ads, Reportei, Google Calendar) usam tokens guardados no servidor, nunca no navegador, e servem apenas para exibir métricas dos clientes da agência.</p>
      <p><strong className="text-foreground">Retenção.</strong> As informações permanecem enquanto o cliente/projeto estiver ativo. Exclusões feitas no sistema são permanentes.</p>
      <p className="text-xs">Dúvidas sobre privacidade? Fale com um administrador da Elo.</p>
    </div>
  );
}

function AboutTab() {
  return (
    <div className="max-w-2xl space-y-4">
      <div className="surface-card space-y-3 p-6 text-sm text-muted-foreground">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold text-foreground"><Database className="h-4 w-4 text-primary" />Banco de dados</h3>
        <p>Os dados ficam no <strong className="text-foreground">Supabase</strong> (PostgreSQL gerenciado), com segurança por linha (RLS) — cada pessoa só acessa o que tem permissão. As imagens ficam no Storage do próprio Supabase.</p>
        <p>Atualizações em tempo real (CRM, Tarefas, Planejamento) usam o canal de Realtime do Supabase.</p>
        <p className="text-xs">Backups e manutenção do banco são gerenciados pela infraestrutura do Supabase.</p>
      </div>
      <div className="surface-card space-y-2 p-6 text-sm text-muted-foreground">
        <h3 className="font-display text-base font-semibold text-foreground">Sobre o Elo Marketing OS</h3>
        <p>Sistema operacional interno da Elo Marketing: clientes, CRM, tarefas, campanhas, relatórios, eventos e financeiro num só lugar.</p>
        <p className="text-xs">Criado por <strong className="text-foreground">Gabriel Tobar</strong>.</p>
      </div>
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
