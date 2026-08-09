import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // 30s staleTime: navigating between pages reuses cached data instead of
  // refiring every Supabase query on each mount/focus, which was the main
  // source of redundant network chatter. Mutations still invalidate their
  // own keys, so edits keep showing up immediately.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        // Voltar para a aba não é motivo para recarregar tudo: com o time
        // grande, cada alt-tab viraria uma rajada de consultas no banco.
        // Quem precisa de dado vivo tem o tempo real das Tarefas.
        refetchOnWindowFocus: false,
        // Reconectou depois de cair: aí sim vale revalidar.
        refetchOnReconnect: true,
        // Dado fora de uso sai da memória em 5 min (aba aberta o dia todo
        // não vira acúmulo de quadros inteiros na RAM).
        gcTime: 5 * 60_000,
        // Erro de permissão/autenticação não melhora repetindo.
        retryOnMount: false,
      },
      mutations: { retry: 0 },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
