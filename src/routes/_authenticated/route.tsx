import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSettledSession, getAccessState } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSettledSession (e não getUser) porque no retorno do Google a sessão
    // ainda está sendo criada — perguntar cedo demais mandava o usuário recém
    // logado de volta para a tela de login.
    const session = await getSettledSession();
    if (!session?.user) throw redirect({ to: "/auth" });
    // Sistema privado: conta nova entra pendente até um admin aprovar.
    const { approved } = await getAccessState(session.user.id);
    if (!approved) throw redirect({ to: "/pending" });
    return { user: session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
