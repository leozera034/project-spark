import { useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Bike,
  ChefHat,
  Clock,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";

import { useAuth } from "@/auth/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { DashboardSkeleton } from "@/components/feedback/Skeletons";
import {
  useMyStores,
  useOrderCounts,
  useOrderQueue,
} from "@/store-orders/useStoreOrders";
import { ORDER_QUEUES, STATUS_LABEL, type StoreOrderStatus } from "@/store-orders/types";
import { orderStatusBadgeVariant } from "@/components/store/order-status";

export const Route = createFileRoute("/app/loja/")({
  head: () => ({
    meta: [
      { title: "Painel da loja | Pediu Aqui" },
      {
        name: "description",
        content: "Área autenticada da equipe da loja no Pediu Aqui.",
      },
      { property: "og:title", content: "Painel da loja | Pediu Aqui" },
      { property: "og:description", content: "Área autenticada da equipe da loja." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StoreHome,
});

const QUICK_ACTIONS = [
  { to: "/app/loja/pedidos", label: "Fila de pedidos", icon: ShoppingBag },
  { to: "/app/loja/cozinha", label: "Modo cozinha", icon: ChefHat },
  { to: "/app/loja/entregadores", label: "Entregadores", icon: Bike },
  { to: "/app/loja/cardapio", label: "Gerenciar cardápio", icon: UtensilsCrossed },
  { to: "/app/loja/relatorios/entregas", label: "Relatório de entregas", icon: BarChart3 },
] as const;

const KPI_QUEUES: Array<{ key: string; label: string; statuses: StoreOrderStatus[] }> = [
  { key: "novos", label: "Novos pedidos", statuses: ["aguardando_confirmacao"] },
  { key: "preparo", label: "Em preparo", statuses: ["aceito", "em_preparo"] },
  {
    key: "prontos",
    label: "Prontos p/ saída",
    statuses: ["pronto", "aguardando_retirada", "aguardando_entregador"],
  },
  { key: "rota", label: "Em rota", statuses: ["em_rota"] },
];

function StoreHome() {
  const { authContext } = useAuth();
  const storesQuery = useMyStores();
  const stores = storesQuery.data ?? [];
  const storeId = stores[0]?.id ?? null;
  const enabled = !storesQuery.isLoading && Boolean(storeId);

  const countsQuery = useOrderCounts(storeId, enabled);
  const recentFilters = useMemo(
    () => ({
      statuses: ORDER_QUEUES.flatMap((queue) => queue.statuses).filter(
        (status) => status !== "recusado" && status !== "cancelado",
      ),
      fulfillment: null,
      search: "",
      delayedOnly: false,
    }),
    [],
  );
  const recentQuery = useOrderQueue(storeId, recentFilters, enabled);

  if (storesQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <DashboardSkeleton />
      </div>
    );
  }

  if (storesQuery.error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <ErrorState
          kind="network"
          title="Não foi possível carregar sua loja"
          onRetry={() => void storesQuery.refetch()}
        />
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <EmptyState
          title="Nenhuma loja vinculada"
          description="Sua conta ainda não está associada a uma loja. Fale com um administrador."
        />
      </div>
    );
  }

  const counts = countsQuery.data?.byStatus ?? {};
  const countFor = (statuses: StoreOrderStatus[]) =>
    statuses.reduce((total, status) => total + (counts[status] ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Olá, {authContext?.full_name ?? "equipe"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumo operacional de {stores[0]?.name ?? "sua loja"} em tempo real.
        </p>
      </header>

      {/* KPIs */}
      <section aria-label="Indicadores operacionais" className="mt-6">
        {countsQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-surface-muted" />
            ))}
          </div>
        ) : countsQuery.error ? (
          <ErrorState
            kind="unexpected"
            title="Não foi possível carregar os indicadores"
            onRetry={() => void countsQuery.refetch()}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {KPI_QUEUES.map((kpi) => (
              <div key={kpi.key} className="panel p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {kpi.label}
                </p>
                <p className="mt-2 font-display text-3xl font-bold tabular-nums text-foreground">
                  {countFor(kpi.statuses)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ações rápidas */}
      <section aria-label="Ações rápidas" className="mt-8">
        <h2 className="text-sm font-semibold text-foreground">Ações rápidas</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.to}
              asChild
              variant="outline"
              className="h-auto flex-col gap-2 py-4 text-center"
            >
              <Link to={action.to}>
                <action.icon className="size-5" aria-hidden="true" />
                <span className="text-xs font-medium leading-tight">{action.label}</span>
              </Link>
            </Button>
          ))}
        </div>
      </section>

      {/* Pedidos recentes */}
      <section aria-label="Pedidos recentes" className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Pedidos recentes</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/loja/pedidos">Ver fila completa</Link>
          </Button>
        </div>

        <div className="mt-3">
          {recentQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-surface-muted" />
              ))}
            </div>
          ) : recentQuery.error ? (
            <ErrorState
              kind="unexpected"
              title="Não foi possível carregar os pedidos recentes"
              onRetry={() => void recentQuery.refetch()}
            />
          ) : (recentQuery.data?.orders.length ?? 0) === 0 ? (
            <EmptyState
              size="compact"
              title="Nenhum pedido em andamento"
              description="Assim que chegar um novo pedido, ele aparece aqui."
            />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {recentQuery.data?.orders.slice(0, 6).map((order) => (
                <li key={order.id}>
                  <Link
                    to="/app/loja/pedidos"
                    search={{ open: order.id } as never}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        #{order.orderNumber} · {order.customerFirstName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.itemCount} item(ns) · {order.fulfillment === "entrega" ? "Entrega" : "Retirada"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {order.isDelayed ? (
                        <Badge variant="danger" className="gap-1">
                          <Clock className="size-3" /> {order.delayMinutes} min
                        </Badge>
                      ) : null}
                      <Badge variant={orderStatusBadgeVariant(order.status)}>
                        {STATUS_LABEL[order.status]}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
