import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase, getAccessState } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, Clock } from "lucide-react";

export const Route = createFileRoute("/pending")({
  head: () => ({ meta: [{ title: "Aguardando aprovação — Elo Marketing OS" }] }),
  component: PendingPage,
});

function PendingPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) { navigate({ to: "/auth" }); return; }
      if (active) setEmail(user.email ?? null);
      const { approved } = await getAccessState(user.id);
      if (approved) { navigate({ to: "/dashboard" }); return; }
      if (active) setChecking(false);
    };
    check();
    // Aprovou no painel do admin? A tela reage sozinha, sem F5.
    const channel = supabase
      .channel("my-approval")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => check())
      .subscribe();
    // Rede de segurança: reconfere de tempos em tempos.
    const timer = setInterval(check, 20000);
    return () => { active = false; supabase.removeChannel(channel); clearInterval(timer); };
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
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
        className="surface-card w-full max-w-md p-8 text-center"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          {checking ? <Loader2 className="h-6 w-6 animate-spin" /> : <Clock className="h-6 w-6" />}
        </div>
        <h1 className="font-display text-xl font-bold">Solicitação enviada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua conta {email ? <>(<strong className="text-foreground">{email}</strong>)</> : null} foi criada e está
          <strong className="text-foreground"> aguardando aprovação</strong> de um administrador da Elo.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Assim que for liberado, esta tela entra sozinha — pode deixar aberta.
        </div>
        <Button variant="ghost" className="mt-6" onClick={signOut}>Sair</Button>
      </motion.div>
    </div>
  );
}
