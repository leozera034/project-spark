import { useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Bike,
  CheckCircle2,
  ChefHat,
  Clock,
  MessageCircle,
  PackageCheck,
  ShoppingBag,
  UtensilsCrossed,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";

import { useAuth } from "@/auth/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useOrderCounts, useOrderQueue, useOrderTransition } from "@/store-orders/useStoreOrders";
import { ACTION_LABEL, ORDER_QUEUES, STATUS_LABEL, type StoreOrderAction, type StoreOrderListItem, type StoreOrderStatus } from "@/store-orders/types";
import { orderStatusBadgeVariant } from "@/components/store/order-status";
import { useStoreBusinessReportSummary } from "@/store/reports/deliveries/delivery-report.queries";
import { useStoreScope } from "@/store-scope/StoreScopeProvider";

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

const MANAGEMENT_ACTIONS = [
  { to: "/app/loja/cardapio", label: "Cardápio", description: "Produtos, preços e disponibilidade", icon: UtensilsCrossed },
  { to: "/app/loja/entregas", label: "Entregas", description: "Equipe, devoluções e taxas", icon: Bike },
  { to: "/app/loja/crescimento", label: "Clientes", description: "Recorrência e relacionamento", icon: Users },
  { to: "/app/loja/whatsapp", label: "WhatsApp", description: "Conexão, avisos e histórico", icon: MessageCircle },
] as const;

const KPI_QUEUES: Array<{ key: string; label: string; hint: string; statuses: StoreOrderStatus[] }> = [
  { key: "novos", label: "Novos", hint: "Aguardando aceite", statuses: ["aguardando_confirmacao"] },
  { key: "preparo", label: "Em preparo", hint: "Na cozinha agora", statuses: ["aceito", "em_preparo"] },
  { key: "prontos", label: "Prontos", hint: "Retirada ou saída", statuses: ["pronto", "aguardando_retirada", "aguardando_entregador"] },
  { key: "rota", label: "Em rota", hint: "Indo ao cliente", statuses: ["em_rota"] },
];

const ACTION_SUCCESS: Partial<Record<StoreOrderAction, string>> = {
  accept: "Pedido aceito.",
  start_preparation: "Preparo iniciado.",
  mark_ready: "Pedido marcado como pronto.",
  complete_pickup: "Retirada confirmada.",
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function StoreHome() {
  const { authContext } = useAuth();
  const { storeId, selectedStore } = useStoreScope();
  const enabled = Boolean(storeId);

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

  if (!storeId || !selectedStore) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <EmptyState title="Escolha uma loja" description="Selecione a operação que deseja acompanhar." />
      </div>
    );
  }

  const counts = countsQuery.data?.byStatus ?? {};
  const countFor = (statuses: StoreOrderStatus[]) => statuses.reduce((total, status) => total + (counts[status] ?? 0), 0);
  const activeOrders = KPI_QUEUES.reduce((total, item) => total + countFor(item.statuses), 0);
  const newOrders = countFor(["aguardando_confirmacao"]);
  const delayedOrders = recentQuery.data?.orders.filter((order) => order.isDelayed).length ?? 0;
  const business = businessQuery.data;
  const priorityOrders = [...(recentQuery.data?.orders ?? [])]
    .sort((a, b) => {
      if (a.isDelayed !== b.isDelayed) return a.isDelayed ? -1 : 1;
      if (a.status === "aguardando_confirmacao" && b.status !== "aguardando_confirmacao") return -1;
      if (b.status === "aguardando_confirmacao" && a.status !== "aguardando_confirmacao") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 7);
  const needsAttention = newOrders > 0 || delayedOrders > 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-9">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-brand">Central da loja</p>
          <h1 className="mt-1 font-display text-3xl font-black tracking-[-.04em] sm:text-4xl">
            {selectedStore.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Olá, {authContext?.full_name?.split(" ")[0] ?? "equipe"}. Aqui está o que importa na operação de hoje.
          </p>
        </div>
        <Button asChild size="lg" className="sm:min-w-40">
          <Link to="/app/loja/pedidos">Abrir pedidos <ArrowRight className="size-4" /></Link>
        </Button>
      </header>

      <section
        className={`mt-6 flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 ${
          needsAttention ? "border-warning/35 bg-warning-soft/55" : "border-success/25 bg-success-soft/45"
        }`}
        aria-label="Prioridade da operação"
      >
        <div className="flex items-start gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl bg-background ${needsAttention ? "text-warning" : "text-success"}`}>
            {needsAttention ? <AlertTriangle className="size-5" /> : <CheckCircle2 className="size-5" />}
          </span>
          <div>
            <p className="font-display text-base font-black text-foreground">
              {needsAttention ? "Há pedidos que precisam de atenção" : "Operação em dia"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {needsAttention
                ? `${newOrders} novo(s) aguardando aceite e ${delayedOrders} pedido(s) com atraso na fila atual.`
                : `${activeOrders} pedido(s) em andamento, sem novos ou atrasados na fila atual.`}
            </p>
          </div>
        </div>
        {needsAttention ? (
          <Button asChild variant="outline" className="shrink-0 bg-background">
            <Link to="/app/loja/pedidos">Resolver agora <ArrowRight className="size-4" /></Link>
          </Button>
        ) : null}
      </section>

      <section aria-label="Resumo de hoje" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Faturamento hoje" value={businessQuery.isLoading ? "—" : brl.format(Number(business?.grossCompleted ?? 0))} icon={WalletCards} />
        <SummaryCard label="Pedidos hoje" value={businessQuery.isLoading ? "—" : String(business?.totalOrders ?? 0)} icon={ShoppingBag} />
        <SummaryCard label="Ticket médio" value={businessQuery.isLoading ? "—" : brl.format(Number(business?.averageTicket ?? 0))} icon={PackageCheck} />
        <SummaryCard label="Novos aguardando" value={countsQuery.isLoading ? "—" : String(newOrders)} icon={Zap} attention={newOrders > 0} />
      </section>

      <section className="mt-5" aria-labelledby="orders-now-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="orders-now-title" className="font-display text-xl font-black">Pedidos agora</h2>
            <p className="mt-1 text-sm text-muted-foreground">Acompanhe a passagem dos pedidos pela operação.</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/app/loja/pedidos">Ver fila completa <ArrowRight className="size-3.5" /></Link></Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {KPI_QUEUES.map((item) => (
            <Link
              key={item.key}
              to="/app/loja/pedidos"
              className="panel group flex items-center justify-between rounded-2xl p-4 transition hover:border-brand/25 hover:bg-brand-soft/25"
            >
              <div>
                <p className="text-xs font-black uppercase tracking-[.1em] text-muted-foreground">{item.label}</p>
                <p className="mt-1 font-display text-3xl font-black tabular-nums">{countFor(item.statuses)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.hint}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-brand" />
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-6 grid min-w-0 gap-5 xl:grid-cols-[1.45fr_.75fr]">
        <section className="panel min-w-0 overflow-hidden p-0" aria-label="Fila de prioridade">
          <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-black text-foreground">Fila de prioridade</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Atrasados e novos aparecem primeiro. A ação principal pode ser concluída sem sair desta tela.</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0"><Link to="/app/loja/pedidos">Ver todos <ArrowRight className="size-3.5" /></Link></Button>
          </div>
          <div className="p-3 sm:p-4">
            {recentQuery.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[84px] animate-pulse rounded-xl border border-border bg-surface-muted" />)}</div>
            ) : recentQuery.error ? (
              <ErrorState kind="unexpected" title="Não foi possível carregar os pedidos" onRetry={() => void recentQuery.refetch()} />
            ) : priorityOrders.length === 0 ? (
              <EmptyState size="compact" title="Tudo em dia" description="Nenhum pedido em andamento neste momento." />
            ) : (
              <ul className="space-y-2">
                {priorityOrders.map((order) => (
                  <PriorityOrderItem key={order.id} order={order} storeId={storeId} />
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="min-w-0 space-y-5">
          <section className="panel p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[.12em] text-muted-foreground">Atalhos</p>
                <h2 className="mt-1 font-display text-lg font-black">Gerenciar loja</h2>
              </div>
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><ChefHat className="size-5" /></span>
            </div>
            <div className="mt-4 grid gap-2">
              {MANAGEMENT_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.to}
                    to={action.to as never}
                    className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface-muted/35 p-3 transition hover:border-brand/20 hover:bg-brand-soft/50"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-brand"><Icon className="size-4.5" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{action.label}</span><span className="block truncate text-xs text-muted-foreground">{action.description}</span></span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-brand/15 bg-brand-soft/35 p-5">
            <p className="text-xs font-black uppercase tracking-[.12em] text-brand">Fluxo recomendado</p>
            <p className="mt-2 text-sm font-bold text-foreground">Pedidos → Cozinha → Entrega</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              A navegação acompanha a sequência real do pedido. Cardápio, clientes e comunicação ficam separados para não atrapalhar a operação.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function PriorityOrderItem({ order, storeId }: { order: StoreOrderListItem; storeId: string }) {
  const transition = useOrderTransition(storeId);
  const primaryAction = order.allowedActions.find((action) => action !== "reject" && action !== "cancel") ?? null;
  const detailSearch = { open: order.id } as never;

  return (
    <li className={`rounded-2xl border p-3 transition sm:p-4 ${order.isDelayed ? "border-warning/30 bg-warning-soft/30" : "border-border bg-surface-muted/40"}`}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/app/loja/pedidos" search={detailSearch} className="group min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-black text-foreground">#{order.orderNumber} · {order.customerFirstName}</p>
            {order.status === "aguardando_confirmacao" ? <Badge variant="warning" className="shrink-0">Novo</Badge> : null}
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{order.itemCount} item(ns)</span>
            <span aria-hidden="true">·</span>
            <span>{order.fulfillment === "entrega" ? "Entrega" : "Retirada"}</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-foreground">{brl.format(order.total)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={orderStatusBadgeVariant(order.status)}>{STATUS_LABEL[order.status]}</Badge>
            {order.isDelayed ? <span className="flex items-center gap-1 text-[11px] font-bold text-warning"><Clock className="size-3" /> {order.delayMinutes} min de atraso</span> : null}
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:justify-end">
          {primaryAction ? (
            <Button
              size="sm"
              className="flex-1 sm:flex-none"
              disabled={transition.isRunning}
              loading={transition.isRunning}
              onClick={() => void transition.run(
                { action: primaryAction, orderId: order.id, expectedVersion: order.version },
                ACTION_SUCCESS[primaryAction] ?? `${ACTION_LABEL[primaryAction]} concluído.`,
              )}
            >
              {ACTION_LABEL[primaryAction]}
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline" className="flex-1 sm:flex-none">
            <Link to="/app/loja/pedidos" search={detailSearch}>Detalhes</Link>
          </Button>
        </div>
      </div>
    </li>
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
