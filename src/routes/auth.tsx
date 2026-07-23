import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase, getSettledSession } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2, PartyPopper, ArrowLeft, ShieldCheck, BarChart3, Users, Kanban, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Elo Marketing OS" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "request">("signin");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [invite, setInvite] = useState<{ id: string; note: string | null } | null>(null);
  const [inviteInvalid, setInviteInvalid] = useState(false);

  // Se o retorno do Google/Supabase trouxe um erro na URL, mostra em vez de
  // "travar" em silêncio — assim dá pra ver a causa (ex.: redirect_uri não
  // liberado no Supabase) em vez de só voltar pra tela de login.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errDesc = params.get("error_description") || hash.get("error_description") || params.get("error") || hash.get("error");
    if (errDesc) {
      toast.error(`Falha no login: ${decodeURIComponent(errDesc).replace(/\+/g, " ")}`);
      // Limpa a URL para o erro não reaparecer a cada recarga.
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Chegou por link de convite (?convite=token): valida e já abre "solicitar acesso".
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("convite");
    if (!token) return;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("invites").select("id, note, expires_at, used_at").eq("token", token).maybeSingle();
      if (error || !data) return setInviteInvalid(true);
      if (data.used_at || new Date(data.expires_at) < new Date()) return setInviteInvalid(true);
      setInvite({ id: data.id, note: data.note });
      setMode("request");
    })();
  }, []);

  // Assim que houver sessão (login normal ou retorno do Google), o guarda de
  // rota decide: aprovado vai pro dashboard, pendente vai pra /pending.
  useEffect(() => {
    let done = false;
    const go = () => { if (done) return; done = true; navigate({ to: "/dashboard" }); };
    getSettledSession().then((session) => { if (session) go(); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { if (session) go(); });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard" });
  };

  const requestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/auth`, data: { full_name: name } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);

    if (invite) {
      await (supabase as any).from("invites")
        .update({ used_at: new Date().toISOString(), used_by: data.user?.id ?? null }).eq("id", invite.id);
    }
    // Avisa os admins que há uma solicitação nova (best-effort).
    try {
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      const ids = (admins ?? []).map((a: any) => a.user_id);
      if (ids.length) {
        await supabase.from("notifications").insert(
          ids.map((user_id: string) => ({
            user_id, kind: "info", title: "Nova solicitação de acesso",
            body: `${name || email} pediu acesso ao sistema. Aprove na aba Equipe.`, link: "/team",
          })),
        );
      }
    } catch { /* nunca bloqueia o cadastro */ }

    // Cadastro com confirmação desligada já devolve sessão → o guarda leva pra
    // /pending (conta nasce pendente). Se veio sem sessão, mostramos aviso aqui.
    if (data.session) return navigate({ to: "/pending" });
    toast.success("Solicitação enviada! Verifique seu email para confirmar e aguarde a aprovação.");
    setMode("signin");
  };

  const google = async () => {
    setLoading(true);
    // Redireciona para /auth (não /dashboard): aqui a troca do code é processada
    // e a navegação é decidida. Mandar direto pro dashboard fazia o guarda
    // devolver pro login antes da sessão ficar pronta — o loop que travava.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) { setLoading(false); toast.error("Falha ao entrar com Google"); }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Painel de marca */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary/20 via-background to-background lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-20 top-10 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="font-display text-2xl font-bold tracking-tight">
          Elo Marketing<span className="text-primary"> OS</span>
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight">
            O sistema operacional<br />da agência, num lugar só.
          </h1>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Clientes, CRM, tarefas, campanhas, relatórios e eventos — tudo integrado e em tempo real.
          </p>
          <div className="mt-8 space-y-3">
            {[
              { icon: Users, text: "Clientes e CRM com pipeline ao vivo" },
              { icon: Kanban, text: "Tarefas no estilo monday, por responsável" },
              { icon: BarChart3, text: "Relatórios automáticos com dados reais" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />Acesso restrito à equipe da Elo
        </div>
      </div>

      {/* Painel do formulário */}
      <div className="relative flex items-center justify-center px-4 py-12">
        <div className="pointer-events-none absolute inset-0 -z-10 lg:hidden">
          <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 lg:hidden">
            <div className="font-display text-xl font-bold tracking-tight">
              Elo Marketing<span className="text-primary"> OS</span>
            </div>
          </div>

          {invite && mode === "request" && (
            <div className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2">
                <PartyPopper className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-display text-sm font-semibold">Você foi convidado! 🎉</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {invite.note ? <>Convite para <strong className="text-foreground">{invite.note}</strong>. </> : null}
                Solicite seu acesso abaixo — um admin da Elo aprova e você entra.
              </p>
            </div>
          )}
          {inviteInvalid && (
            <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              Este link de convite expirou ou já foi usado. Você ainda pode entrar, ou solicitar acesso.
            </div>
          )}

          {mode === "signin" ? (
            <>
              <h2 className="font-display text-2xl font-bold">Bem-vindo de volta</h2>
              <p className="mb-6 mt-1 text-sm text-muted-foreground">Entre para acessar o sistema.</p>

              <Button variant="outline" className="w-full" onClick={google} disabled={loading}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1H12v3.2h5.35c-.23 1.22-1.41 3.58-5.35 3.58-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.57-2.48C16.74 3.38 14.6 2.5 12 2.5 6.76 2.5 2.5 6.76 2.5 12s4.26 9.5 9.5 9.5c5.48 0 9.1-3.85 9.1-9.27 0-.62-.07-1.1-.15-1.13z"/></svg>
                Entrar com Google
              </Button>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">ou com email</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={signIn} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
                </Button>
              </form>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                Ainda não faz parte da equipe?{" "}
                <button onClick={() => setMode("request")} className="font-medium text-primary hover:underline">
                  Solicitar acesso
                </button>
              </p>
            </>
          ) : (
            <>
              <button onClick={() => setMode("signin")} className="mb-4 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" />Voltar para entrar
              </button>
              <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
                <Sparkles className="h-5 w-5 text-primary" />Solicitar acesso
              </h2>
              <p className="mb-6 mt-1 text-sm text-muted-foreground">
                Sistema privado da Elo. Sua conta é criada e liberada por um admin.
              </p>

              <form onSubmit={requestAccess} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome completo</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="email2">Email</Label>
                  <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="password2">Senha</Label>
                  <Input id="password2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar solicitação"}
                </Button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">ou</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <Button variant="outline" className="w-full" onClick={google} disabled={loading}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1H12v3.2h5.35c-.23 1.22-1.41 3.58-5.35 3.58-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.57-2.48C16.74 3.38 14.6 2.5 12 2.5 6.76 2.5 2.5 6.76 2.5 12s4.26 9.5 9.5 9.5c5.48 0 9.1-3.85 9.1-9.27 0-.62-.07-1.1-.15-1.13z"/></svg>
                Solicitar com Google
              </Button>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
