import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Lightbulb, Copy, Check } from "lucide-react";
import { toast } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { humanizeError, errorRefCode } from "../lib/error-friendly";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/hooks/use-theme";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="surface-card max-w-md p-10 text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O recurso que você está procurando não existe ou foi movido.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  const { title, description, tip } = humanizeError(error);
  const refCode = errorRefCode(error);
  const route = typeof window !== "undefined" ? window.location.pathname : "";
  const when = new Date().toLocaleString("pt-BR");

  const prompt = `Encontrei um erro no Elo Marketing OS.

Código de referência: ${refCode}
Página: ${route}
Data/hora: ${when}
Mensagem técnica: ${error.message}

O que eu vi na tela: ${title} — ${description}

Pode investigar e corrigir isso?`;

  const copyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast.success("Prompt copiado! Cole numa conversa com o Claude.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="surface-card relative w-full max-w-lg overflow-hidden p-8 text-center sm:p-10">
        <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br from-red-500/20 to-red-500/0 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-gradient-to-tl from-amber-500/15 to-amber-500/0 blur-3xl" />

        <div className="relative mb-5 font-display text-sm font-bold tracking-tight">
          Elo Marketing<span className="text-primary"> OS</span>
        </div>

        <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-500/20 to-red-500/5 text-red-400">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <h1 className="relative font-display text-xl font-semibold">{title}</h1>
        <p className="relative mt-2 text-sm text-muted-foreground">{description}</p>

        <div className="relative mt-5 rounded-lg border border-primary/25 bg-primary/5 p-4 text-left">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <Lightbulb className="h-3.5 w-3.5" /> O que fazer
          </div>
          <p className="mt-1.5 text-sm text-foreground/90">{tip}</p>
        </div>

        <div className="relative mt-4 rounded-lg border border-border/60 bg-surface-2/60 p-4 text-left">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prompt para o Claude</span>
            <button
              onClick={copyPrompt}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs hover:bg-accent"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-[10.5px] leading-relaxed text-muted-foreground">{prompt}</pre>
        </div>

        <div className="relative mt-3 text-[11px] text-muted-foreground/70">Referência {refCode}</div>

        <div className="relative mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a href="/" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Ir para o início</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Elo Marketing OS" },
      { name: "description", content: "Sistema interno de gestão da Elo Marketing — clientes, projetos, equipe e financeiro em um só lugar." },
      { name: "theme-color", content: "#050505" },
      { property: "og:title", content: "Elo Marketing OS" },
      { name: "twitter:title", content: "Elo Marketing OS" },
      { property: "og:description", content: "Sistema interno de gestão da Elo Marketing — clientes, projetos, equipe e financeiro em um só lugar." },
      { name: "twitter:description", content: "Sistema interno de gestão da Elo Marketing — clientes, projetos, equipe e financeiro em um só lugar." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/55977136-ac5b-47d2-9c61-1046d48db7f1/id-preview-6673bfc9--c15e2145-4f80-48aa-9b1a-fda780b8c4bd.lovable.app-1782839236543.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/55977136-ac5b-47d2-9c61-1046d48db7f1/id-preview-6673bfc9--c15e2145-4f80-48aa-9b1a-fda780b8c4bd.lovable.app-1782839236543.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "icon", href: "/logo.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/logo.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme')||'dark';document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}` }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Outlet />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
