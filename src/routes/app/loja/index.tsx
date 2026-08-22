import { useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Bike,
  ChefHat,
  Clock,
  MessageCircle,
  PackageCheck,
  ShoppingBag,
  UtensilsCrossed,
  WalletCards,
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
import { useStoreBusinessReportSummary } from "@/store/reports/deliveries/delivery-report.queries";

export const Route = createFileRoute("/app/loja/")({
  head: () => ({
    meta: [
      { title: "Início | Comandiva" },
      { name: "description", content: "Resumo da operação da loja na Comandiva." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StoreHome,
});

const QUICK_ACTIONS = [
  { to: "/app/loja/pedidos", label: "Pedidos", description: "Abrir a fila agora", icon: ShoppingBag },
  { to: "/app/loja/cozinha", label: "Cozinha", description: "Acompanhar preparo", icon: ChefHat },
  { to: "/app/loja/cardapio", label: "Cardápio", description: "Produtos e disponibilidade", icon: UtensilsCrossed },
  { to: "/app/loja/entregas", label: "Entregas", description: "Equipe e pedidos em saída", icon: Bike },
  { to: "/app/loja/whatsapp", label: "WhatsApp", description: "Conexão e mensagens", icon: MessageCircle },
] as const;

const KPI_QUEUES: Array<{ key: string; label: string; statuses: StoreOrderStatus[] }> = [
  { key: "novos", label: "Novos aguardando", statuses: ["aguardando_confirmacao"] },
  { key: "preparo", label: "Em preparo", statuses: ["aceito", "em_preparo"] },
  { key: "prontos", label: "Prontos para saída", statuses: ["pronto", "aguardando_retirada", "aguardando_entregador"] },
  { key: "rota", label: "Em rota", statuses: ["em_rota"] },
];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function StoreHome() {
  const { authContext } = useAuth();
  const storesQuery = useMyStores();
  const stores = storesQuery.data ?? [];
  const storeId = stores[0]?.id ?? null;
  const enabled = !storesQuery.isLoading && Boolean(storeId);

  const countsQuery = useOrderCounts(storeId, enabled);
  const businessQuery = useStoreBusinessReportSummary("today");
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
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <DashboardSkeleton />
      </div>
    );
  }

  if (storesQuery.error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <ErrorState kind="network" title="Não foi possível carregar sua loja" onRetry={() => void storesQuery.refetch()} />
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <EmptyState title="Nenhuma loja vinculada" description="Sua conta ainda não está associada a uma loja. Fale com um administrador." />
      </div>
    );
  }

  const counts = countsQuery.data?.byStatus ?? {};
  const countFor = (statuses: StoreOrderStatus[]) => statuses.reduce((total, status) => total + (counts[status] ?? 0), 0);
  const activeOrders = KPI_QUEUES.reduce((total, item) => total + countFor(item.statuses), 0);
  const delayedOrders = recentQuery.data?.orders.filter((order) => order.isDelayed).length ?? 0;
  const newOrders = countFor(["aguardando_confirmacao"]);
  const business = businessQuery.data;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-9">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{stores[0]?.name ?? "Sua loja"}</p>
          <h1 className="mt-1 font-display text-3xl font-black tracking-[-.04em] sm:text-4xl">
            Olá, {authContext?.full_name?.split(" ")[0] ?? "equipe"}.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Veja primeiro o que exige atenção na operação de hoje.</p>
        </div>
        <Button asChild size="lg"><Link to="/app/loja/pedidos">Abrir pedidos <ArrowRight className="size-4" /></Link></Button>
      </header>

      <section aria-label="Resumo de hoje" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Faturamento hoje" value={businessQuery.isLoading ? "—" : brl.format(Number(business?.grossCompleted ?? 0))} icon={WalletCards} />
        <SummaryCard label="Pedidos hoje" value={businessQuery.isLoading ? "—" : String(business?.totalOrders ?? 0)} icon={ShoppingBag} />
        <SummaryCard label="Ticket médio" value={businessQuery.isLoading ? "—" : brl.format(Number(business?.averageTicket ?? 0))} icon={PackageCheck} />
        <SummaryCard label="Novos aguardando" value={countsQuery.isLoading ? "—" : String(newOrders)} icon={Zap} attention={newOrders > 0} />
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Operação em andamento">
        {KPI_QUEUES.map((item) => (
          <Link key={item.key} to="/app/loja/pedidos" className="panel group flex items-center justify-between rounded-2xl p-4 transition hover:border-brand/25 hover:bg-brand-soft/25">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.1em] text-muted-foreground">{item.label}</p>
              <p className="mt-1 font-display text-2xl font-black tabular-nums">{countFor(item.statuses)}</p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-brand" />
          </Link>
        ))}
      </section>

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[1.45fr_.75fr]">
        <section className="panel min-w-0 overflow-hidden p-0" aria-label="Pedidos recentes">
          <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-foreground">Pedidos em andamento</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Os mais recentes que ainda precisam de acompanhamento</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0"><Link to="/app/loja/pedidos">Ver todos <ArrowRight className="size-3.5" /></Link></Button>
          </div>
          <div className="p-3 sm:p-4">
            {recentQuery.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-surface-muted" />)}</div>
            ) : recentQuery.error ? (
              <ErrorState kind="unexpected" title="Não foi possível carregar os pedidos recentes" onRetry={() => void recentQuery.refetch()} />
            ) : (recentQuery.data?.orders.length ?? 0) === 0 ? (
              <EmptyState size="compact" title="Tudo em dia" description="Nenhum pedido em andamento neste momento." />
            ) : (
              <ul className="space-y-2">
                {recentQuery.data?.orders.slice(0, 7).map((order) => (
                  <li key={order.id}>
                    <Link to="/app/loja/pedidos" search={{ open: order.id } as never} className="group flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-border bg-surface-muted/40 px-3 py-3 transition hover:border-brand/20 hover:bg-brand-soft/40 sm:px-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-foreground">#{order.orderNumber} · {order.customerFirstName}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{order.itemCount} item(ns) · {order.fulfillment === "entrega" ? "Entrega" : "Retirada"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {order.isDelayed ? <Badge variant="danger" className="hidden gap-1 min-[420px]:inline-flex"><Clock className="size-3" /> {order.delayMinutes} min</Badge> : null}
                        <Badge variant={orderStatusBadgeVariant(order.status)}>{STATUS_LABEL[order.status]}</Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="min-w-0 space-y-5">
          <section className="panel p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold">Atenção agora</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Prioridades sem precisar procurar em várias telas</p>
              </div>
              <span className={`grid size-10 place-items-center rounded-xl ${delayedOrders > 0 || newOrders > 0 ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}><Zap className="size-5" /></span>
            </div>
            <div className="mt-5 space-y-3">
              <PriorityRow label="Pedidos novos" value={newOrders} critical={newOrders > 0} />
              <PriorityRow label="Pedidos atrasados" value={delayedOrders} critical={delayedOrders > 0} />
              <PriorityRow label="Operações ativas" value={activeOrders} />
            </div>
          </section>

          <section className="panel p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold">Acesso rápido</h2>
            <div className="mt-4 grid gap-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.to} to={action.to as never} className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface-muted/35 p-3 transition hover:border-brand/20 hover:bg-brand-soft/50">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-4.5" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{action.label}</span><span className="block truncate text-xs text-muted-foreground">{action.description}</span></span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
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

function SummaryCard({ label, value, icon: Icon, attention = false }: { label: string; value: string; icon: typeof WalletCards; attention?: boolean }) {
  return (
    <article className={`panel p-5 ${attention ? "border-warning/35" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-extrabold uppercase tracking-[.11em] text-muted-foreground">{label}</p><p className="mt-3 font-display text-3xl font-black tracking-[-.04em] tabular-nums">{value}</p></div>
        <span className={`grid size-10 place-items-center rounded-xl ${attention ? "bg-warning-soft text-warning" : "bg-brand-soft text-brand"}`}><Icon className="size-5" /></span>
      </div>
    </article>
  );
}

function PriorityRow({ label, value, critical = false }: { label: string; value: number; critical?: boolean }) {
  return <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/35 px-3 py-2.5"><span className="text-sm font-medium">{label}</span><Badge variant={critical ? "warning" : "outline"}>{value}</Badge></div>;
}
