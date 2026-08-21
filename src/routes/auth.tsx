import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase, getSettledSession } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, PartyPopper, ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";

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
  const [invite, setInvite] = useState<{ token: string; note: string | null } | null>(null);
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
      // Valida pela RPC: ela responde só sobre o token que veio no link.
      // Ler a tabela direto deixaria qualquer visitante listar os convites.
      const { data, error } = await (supabase as any).rpc("validate_invite", { _token: token });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row?.valid) return setInviteInvalid(true);
      setInvite({ token, note: row.note ?? null });
      setMode("request");
    })();
  }, []);

  // Assim que houver sessão (login normal ou retorno do Google), o guarda de
  // rota decide: aprovado vai pro dashboard, pendente vai pra /pending.
  useEffect(() => {
    let done = false;
    const go = () => { if (done) return; done = true; navigate({ to: "/home" }); };
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
    navigate({ to: "/home" });
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
      // Carimba pela RPC (roda como o usuário recém-criado e só aceita
      // convite que ainda vale) — a tabela não é mais escrita pelo cliente.
      await (supabase as any).rpc("consume_invite", { _token: invite.token });
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
    <div className="dark relative min-h-screen overflow-y-auto bg-[#07070a] text-foreground">
      <WaveBackground />

      {/* Card de login — centralizado na tela inteira */}
      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl shadow-black/50 backdrop-blur-2xl"
        >
          <div className="mb-7 flex flex-col items-center text-center">
            <img src="/logo-mark.png" alt="Elo Marketing" className="mb-3 h-14 w-auto drop-shadow-[0_0_30px_rgba(37,99,235,0.35)]" />
            <div className="font-display text-xl font-bold tracking-tight text-white">
              Elo Marketing<span className="text-primary"> OS</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-white/40">
              <ShieldCheck className="h-3 w-3" />Acesso restrito
            </div>
          </div>

        <div className="w-full">
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
        </div>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * Fundo de ondas animadas — cor em movimento, sem linhas de grade.
 * Três camadas de <path> translúcidas, cada uma deslizando na horizontal
 * num loop infinito, com leve variação de forma via keyframes no "d".
 */
function WaveBackground() {
  const layers = [
    {
      fill: "url(#waveGradA)",
      opacity: 0.55,
      duration: 16,
      y: 0,
      d: [
        "M0,160 C320,220 420,80 720,120 C1020,160 1120,60 1440,110 L1440,400 L0,400 Z",
        "M0,140 C300,90 460,200 720,150 C980,100 1140,190 1440,150 L1440,400 L0,400 Z",
        "M0,160 C320,220 420,80 720,120 C1020,160 1120,60 1440,110 L1440,400 L0,400 Z",
      ],
    },
    {
      fill: "url(#waveGradB)",
      opacity: 0.4,
      duration: 22,
      y: 40,
      d: [
        "M0,200 C280,140 480,260 760,200 C1040,140 1200,240 1440,190 L1440,400 L0,400 Z",
        "M0,180 C300,240 500,120 760,170 C1020,220 1180,120 1440,170 L1440,400 L0,400 Z",
        "M0,200 C280,140 480,260 760,200 C1040,140 1200,240 1440,190 L1440,400 L0,400 Z",
      ],
    },
    {
      fill: "url(#waveGradC)",
      opacity: 0.3,
      duration: 28,
      y: 90,
      d: [
        "M0,240 C260,280 520,180 780,230 C1040,280 1220,200 1440,240 L1440,400 L0,400 Z",
        "M0,260 C280,200 500,300 780,260 C1060,220 1200,300 1440,260 L1440,400 L0,400 Z",
        "M0,240 C260,280 520,180 780,230 C1040,280 1220,200 1440,240 L1440,400 L0,400 Z",
      ],
    },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#07070a]">
      <motion.div
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 10, ease: "easeInOut", repeat: Infinity }}
        className="absolute left-1/2 top-1/2 h-[70vh] w-[70vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[160px]"
      />
      <svg
        className="absolute bottom-0 left-0 h-[60vh] w-full"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="waveGradA" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="50%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="waveGradB" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="50%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
          <linearGradient id="waveGradC" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="50%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        {layers.map((layer, i) => (
          <motion.path
            key={i}
            fill={layer.fill}
            opacity={layer.opacity}
            initial={false}
            animate={{ d: layer.d, x: [0, -60, 0] }}
            transition={{ duration: layer.duration, ease: "easeInOut", repeat: Infinity }}
            style={{ translateY: layer.y }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-[#07070a] via-transparent to-[#07070a]/40" />
    </div>
  );
}
