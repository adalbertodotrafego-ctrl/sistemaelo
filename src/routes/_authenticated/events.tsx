import { createFileRoute, redirect } from "@tanstack/react-router";

// Eventos foi fundido com o Planejamento Elo — esta rota some do menu e só
// redireciona quem chegar aqui por um link/favorito antigo (inclui o retorno
// do Google Calendar em google-calendar-callback.tsx).
export const Route = createFileRoute("/_authenticated/events")({
  beforeLoad: () => {
    throw redirect({ to: "/social" });
  },
});
