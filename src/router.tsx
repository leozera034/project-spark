import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { NotFoundPage } from "./components/feedback/NotFoundPage";
import { RouteErrorScreen } from "./components/feedback/RouteErrorScreen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Falha de rede é frequente em celular: uma tentativa extra evita
        // que o usuário veja tela de erro por oscilação momentânea.
        retry: 1,
        staleTime: 30_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFoundPage,
    defaultErrorComponent: RouteErrorScreen,
  });

  return router;
};
