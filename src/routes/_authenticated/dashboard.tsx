import { createFileRoute, redirect } from "@tanstack/react-router";

// O Dashboard foi fundido com a Home — esta rota some do menu e só
// redireciona quem chegar aqui por um link/favorito antigo.
export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/home" });
  },
});
