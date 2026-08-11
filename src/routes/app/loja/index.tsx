import { useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bike,
  ChefHat,
  Clock,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  Zap,
} from "lucide-react";

import { useAuth } from "@/auth/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { DashboardSkeleton } from "@/components/feedback/Skeletons";
import { useMyStores, useOrderCounts, useOrderQueue } from "@/store-orders/useStoreOrders";
import { ORDER_QUEUES, STATUS_LABEL, type StoreOrderStatus } from "@/store-orders/types";
import { orderStatusBadgeVariant } from "@/components/store/order-status";

export const Route = createFileRoute("/app/loja/")({
  head: () => ({
    meta: [
      { title: "Painel da loja | Pediu Aqui" },
      { name: "description", content: "Área autenticada da equipe da loja no Pediu Aqui." },
      { property: "og:title", content: "Painel da loja | Pediu Aqui" },
      { property: "og:description", content: "Área autenticada da equipe da loja." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StoreHome,
});

const QUICK_ACTIONS = [
  { to: "/app/loja/pedidos", label: "Fila de pedidos", description: "Priorize e acompanhe", icon: ShoppingBag },
  { to: "/app/loja/cozinha", label: "Modo cozinha", description: "Produção em tempo real", icon: ChefHat },
  { to: "/app/loja/cardapio", label: "Cardápio", description: "Produtos e disponibilidade", icon: UtensilsCrossed },
  { to: "/app/loja/entregadores", label: "Entregadores", description: "Equipe e operação", icon: Bike },
  { to: "/app/loja/relatorios/entregas", label: "Relatórios", description: "Desempenho da operação", icon: BarChart3 },
] as const;

const KPI_QUEUES: Array<{ key: string; label: string; hint: string; statuses: StoreOrderStatus[]; icon: typeof ShoppingBag }> = [
  { key: "novos", label: "Novos", hint: "Aguardando aceite", statuses: ["aguardando_confirmacao"], icon: Zap },
  { key: "preparo", label: "Em preparo", hint: "Produção ativa", statuses: ["aceito", "em_preparo"], icon: ChefHat },
  { key: "prontos", label: "Prontos", hint: "Aguardando saída", statuses: ["pronto", "aguardando_retirada", "aguardando_entregador"], icon: PackageCheck },
  { key: "rota", label: "Em rota", hint: "Entrega acontecendo", statuses: ["em_rota"], icon: Bike },
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
    return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8"><DashboardSkeleton /></div>;
  }

  if (storesQuery.error) {
    return <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6"><ErrorState kind="network" title="Não foi possível carregar sua loja" onRetry={() => void storesQuery.refetch()} /></div>;
  }

  if (stores.length === 0) {
    return <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6"><EmptyState title="Nenhuma loja vinculada" description="Sua conta ainda não está associada a uma loja. Fale com um administrador." /></div>;
  }

  const counts = countsQuery.data?.byStatus ?? {};
  const countFor = (statuses: StoreOrderStatus[]) => statuses.reduce((total, status) => total + (counts[status] ?? 0), 0);
  const activeOrders = KPI_QUEUES.reduce((total, item) => total + countFor(item.statuses), 0);
  const delayedOrders = recentQuery.data?.orders.filter((order) => order.isDelayed).length ?? 0;
  const newOrders = countFor(["aguardando_confirmacao"]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="relative overflow-hidden rounded-[30px] border border-violet-300/10 bg-[linear-gradient(135deg,rgba(52,22,86,.72),rgba(18,10,29,.94)_48%,rgba(10,6,17,.98))] p-5 shadow-[0_30px_90px_-45px_rgba(124,58,237,.55)] sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/15 bg-violet-500/10 px-3 py-1 text-xs font-extrabold text-violet-200"><Sparkles className="size-3.5" /> Cockpit operacional</span>
              <span className="rounded-full border border-white/[.07] bg-white/[.035] px-3 py-1 text-xs font-semibold text-white/48">Atualização em tempo real</span>
            </div>
            <h1 className="mt-5 font-display text-3xl font-black tracking-[-.045em] text-white sm:text-4xl">
              Olá, {authContext?.full_name ?? "equipe"}.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/48 sm:text-base">
              {stores[0]?.name ?? "Sua loja"} em uma única visão: pedidos, produção, saída e entregas.
            </p>
          </div>
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to="/app/loja/pedidos">Abrir operação <ArrowRight className="size-4" /></Link>
          </Button>
        </div>
      </section>

      <section aria-label="Indicadores operacionais" className="mt-5">
        {countsQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-surface-muted" />)}</div>
        ) : countsQuery.error ? (
          <ErrorState kind="unexpected" title="Não foi possível carregar os indicadores" onRetry={() => void countsQuery.refetch()} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {KPI_QUEUES.map((kpi) => {
              const Icon = kpi.icon;
              const value = countFor(kpi.statuses);
              return (
                <article key={kpi.key} className="panel group relative overflow-hidden p-5">
                  <div className="absolute right-0 top-0 size-24 translate-x-8 -translate-y-8 rounded-full bg-violet-500/8 blur-2xl transition group-hover:bg-violet-500/14" />
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-[.14em] text-white/38">{kpi.label}</p>
                      <p className="mt-3 font-display text-4xl font-black tabular-nums tracking-[-.05em] text-white">{value}</p>
                      <p className="mt-1 text-xs text-white/35">{kpi.hint}</p>
                    </div>
                    <span className="grid size-10 place-items-center rounded-xl border border-violet-300/10 bg-violet-500/10 text-violet-300"><Icon className="size-5" /></span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_.75fr]">
        <section className="panel overflow-hidden p-0" aria-label="Pedidos recentes">
          <div className="flex items-center justify-between border-b border-white/[.06] px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-display text-lg font-bold text-white">Operação agora</h2>
              <p className="mt-0.5 text-xs text-white/36">Pedidos que exigem acompanhamento da equipe</p>
            </div>
            <Button asChild variant="ghost" size="sm"><Link to="/app/loja/pedidos">Ver todos <ArrowRight className="size-3.5" /></Link></Button>
          </div>
          <div className="p-3 sm:p-4">
            {recentQuery.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-surface-muted" />)}</div>
            ) : recentQuery.error ? (
              <ErrorState kind="unexpected" title="Não foi possível carregar os pedidos recentes" onRetry={() => void recentQuery.refetch()} />
            ) : (recentQuery.data?.orders.length ?? 0) === 0 ? (
              <EmptyState size="compact" title="Operação tranquila" description="Nenhum pedido em andamento neste momento." />
            ) : (
              <ul className="space-y-2">
                {recentQuery.data?.orders.slice(0, 7).map((order) => (
                  <li key={order.id}>
                    <Link to="/app/loja/pedidos" search={{ open: order.id } as never} className="group flex items-center justify-between gap-3 rounded-2xl border border-white/[.055] bg-white/[.025] px-4 py-3 transition hover:border-violet-400/18 hover:bg-violet-500/[.055]">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">#{order.orderNumber} · {order.customerFirstName}</p>
                        <p className="mt-0.5 text-xs text-white/38">{order.itemCount} item(ns) · {order.fulfillment === "entrega" ? "Entrega" : "Retirada"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {order.isDelayed ? <Badge variant="danger" className="gap-1"><Clock className="size-3" /> {order.delayMinutes} min</Badge> : null}
                        <Badge variant={orderStatusBadgeVariant(order.status)}>{STATUS_LABEL[order.status]}</Badge>
                        <ArrowRight className="hidden size-4 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-violet-300 sm:block" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="space-y-5">
          <section className="panel p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-white">Prioridade</h2>
                <p className="mt-0.5 text-xs text-white/36">O que merece atenção agora</p>
              </div>
              <span className={`grid size-10 place-items-center rounded-xl ${delayedOrders > 0 || newOrders > 0 ? "bg-amber-500/10 text-amber-300" : "bg-emerald-500/10 text-emerald-300"}`}><Zap className="size-5" /></span>
            </div>
            <div className="mt-5 space-y-3">
              <PriorityRow label="Pedidos novos" value={newOrders} critical={newOrders > 0} />
              <PriorityRow label="Pedidos atrasados" value={delayedOrders} critical={delayedOrders > 0} />
              <PriorityRow label="Operações ativas" value={activeOrders} />
            </div>
          </section>

          <section className="panel p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold text-white">Acesso rápido</h2>
            <div className="mt-4 grid gap-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.to} to={action.to} className="group flex items-center gap-3 rounded-xl border border-white/[.055] bg-white/[.02] p-3 transition hover:border-violet-400/18 hover:bg-violet-500/[.05]">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-300"><Icon className="size-4.5" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-white">{action.label}</span><span className="block truncate text-xs text-white/34">{action.description}</span></span>
                    <ArrowRight className="size-4 text-white/22 transition group-hover:translate-x-0.5 group-hover:text-violet-300" />
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function PriorityRow({ label, value, critical = false }: { label: string; value: number; critical?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[.055] bg-white/[.02] px-3.5 py-3">
      <span className="text-sm text-white/55">{label}</span>
      <span className={`rounded-lg px-2.5 py-1 text-sm font-black tabular-nums ${critical ? "bg-amber-500/10 text-amber-300" : "bg-white/[.045] text-white/72"}`}>{value}</span>
    </div>
  );
}
