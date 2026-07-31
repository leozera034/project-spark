import { useRouterState } from "@tanstack/react-router";

/**
 * Barra fina no topo enquanto o roteador carrega dados de uma rota.
 * Garante retorno visual imediato em qualquer navegação, sem tela travada.
 */
export function RouteProgress() {
  const isLoading = useRouterState({ select: (state) => state.status === "pending" });

  return (
    <div
      aria-hidden={!isLoading}
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 transition-opacity duration-200 ${
        isLoading ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="route-progress h-full bg-brand" />
      <span className="sr-only" role="status" aria-live="polite">
        {isLoading ? "Carregando página" : ""}
      </span>
    </div>
  );
}
