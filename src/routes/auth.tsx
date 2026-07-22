import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase, getSettledSession } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, PartyPopper } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Elo Marketing OS" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [invite, setInvite] = useState<{ id: string; note: string | null } | null>(null);
  const [inviteInvalid, setInviteInvalid] = useState(false);

  // Chegou por link de convite (?convite=token): valida e dá as boas-vindas.
  // Um token inválido não trava ninguém — a pessoa ainda entra normalmente.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("convite");
    if (!token) return;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("invites").select("id, note, expires_at, used_at").eq("token", token).maybeSingle();
      if (error || !data) return setInviteInvalid(true);
      if (data.used_at || new Date(data.expires_at) < new Date()) return setInviteInvalid(true);
      setInvite({ id: data.id, note: data.note });
    })();
  }, []);

  // Entra assim que existir sessão — seja porque já estava logado, seja porque
  // o retorno do Google acabou de ser processado. Só o getSession de uma vez
  // não bastava: quando a sessão chegava um instante depois, a tela ficava
  // parada aqui mesmo com o login tendo dado certo.
  useEffect(() => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      navigate({ to: "/dashboard" });
    };
    getSettledSession().then((session) => { if (session) go(); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) go();
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/dashboard" });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: name },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);

    // Queima o convite para o link não circular indefinidamente. Se falhar,
    // não atrapalha: a conta já foi criada.
    if (invite) {
      await (supabase as any).from("invites")
        .update({ used_at: new Date().toISOString(), used_by: data.user?.id ?? null })
        .eq("id", invite.id);
    }

    // Quando a confirmação por email está desligada, o cadastro já devolve a
    // sessão pronta — antes a tela ficava parada pedindo pra "confirmar o
    // email" que nunca chegava. Com sessão, entra direto.
    if (data.session) {
      toast.success("Conta criada! Bem-vindo.");
      return navigate({ to: "/dashboard" });
    }
    toast.success("Conta criada! Verifique seu email para confirmar.");
  };

  const google = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setLoading(false);
      return toast.error("Falha ao entrar com Google");
    }
    // A successful call navigates the browser away to Google; nothing left to do here.
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="surface-card w-full max-w-md p-8"
      >
        <Link to="/" className="mb-6 flex flex-col leading-tight">
          <span className="font-display text-xl font-bold tracking-tight">
            Elo Marketing<span className="text-primary"> OS</span>
          </span>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Agência de Marketing</span>
        </Link>

        {invite && (
          <div className="mb-5 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <PartyPopper className="h-4 w-4 shrink-0 text-primary" />
              <span className="font-display text-sm font-semibold">Você foi convidado! 🎉</span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {invite.note ? <>Convite para <strong className="text-foreground">{invite.note}</strong>. </> : null}
              Bem-vindo ao <strong className="text-foreground">Elo Marketing OS</strong> — o sistema onde a agência
              acompanha clientes, campanhas, demandas e resultados. Crie sua conta abaixo para começar.
            </p>
          </div>
        )}
        {inviteInvalid && (
          <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            Este link de convite expirou ou já foi usado. Você ainda pode entrar ou criar sua conta normalmente —
            ou peça um link novo para alguém do time.
          </div>
        )}

        <Tabs defaultValue={invite ? "signup" : "signin"}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={signIn} className="mt-6 space-y-4">
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
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={signUp} className="mt-6 space-y-4">
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
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou continuar com</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={google} disabled={loading}>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#fff" d="M21.35 11.1H12v3.2h5.35c-.23 1.22-1.41 3.58-5.35 3.58-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.57-2.48C16.74 3.38 14.6 2.5 12 2.5 6.76 2.5 2.5 6.76 2.5 12s4.26 9.5 9.5 9.5c5.48 0 9.1-3.85 9.1-9.27 0-.62-.07-1.1-.15-1.13z"/></svg>
          Google
        </Button>
      </motion.div>
    </div>
  );
}
