import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { completeGoogleCalendarConnect } from "@/lib/google-calendar.functions";

export const Route = createFileRoute("/google-calendar-callback")({
  head: () => ({ meta: [{ title: "Conectando Google Calendar — Elo Marketing OS" }] }),
  component: GoogleCalendarCallbackPage,
});

function GoogleCalendarCallbackPage() {
  const navigate = useNavigate();
  const complete = useServerFn(completeGoogleCalendarConnect);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Conectando sua conta do Google…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");

    if (oauthError) {
      setStatus("error");
      setMessage("Você cancelou a conexão com o Google.");
      return;
    }
    if (!code || !state) {
      setStatus("error");
      setMessage("Link de retorno do Google inválido.");
      return;
    }

    complete({ data: { code, state } })
      .then((r) => {
        setStatus("success");
        setMessage(r.email ? `Conectado como ${r.email}!` : "Google Calendar conectado!");
        setTimeout(() => navigate({ to: "/calendar" }), 1800);
      })
      .catch((e: Error) => {
        setStatus("error");
        setMessage(e.message || "Falha ao conectar com o Google.");
      });
  }, [complete, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="surface-card w-full max-w-sm p-8 text-center">
        {status === "loading" && <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />}
        {status === "success" && <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />}
        {status === "error" && <XCircle className="mx-auto h-8 w-8 text-destructive" />}
        <p className="mt-4 text-sm text-muted-foreground">{message}</p>
        {status === "error" && (
          <button
            onClick={() => navigate({ to: "/calendar" })}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Voltar para o calendário
          </button>
        )}
      </div>
    </div>
  );
}
