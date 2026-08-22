import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bike,
  Clock,
  MoreHorizontal,
  Printer,
  RadioTower,
  RefreshCw,
  RouteIcon,
  Search,
  ShoppingBag,
  SlidersHorizontal,
} from "lucide-react";

import { brl } from "@/components/storefront/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMyStores,
  useOrderCounts,
  useOrderDetail,
  useOrderHistory,
  useOrderQueue,
  useOrderRealtime,
  useOrderTransition,
  useTransitionReasons,
} from "@/store-orders/useStoreOrders";
import { StoreOperationalAlerts } from "@/notifications/store/StoreOperationalAlerts";
import { orderStatusBadgeVariant } from "@/components/store/order-status";
import { printOrderReceipt } from "@/lib/thermal-receipt";
import {
  useAssignCourier,
  useDeliveryAssignment,
  useEligibleCouriers,
} from "@/store/couriers/hooks/useCouriers";
import {
  BLOCKING_REASON_LABEL,
  COURIER_VEHICLE_LABEL,
  formatRouteDistance,
  formatRouteDuration,
  routeQualityLabel,
} from "@/store/couriers/courier.formatters";
import {
  ACTION_LABEL,
  ORDER_QUEUES,
  STATUS_LABEL,
  type StoreOrderAction,
  type StoreOrderListItem,
} from "@/store-orders/types";

export const Route = createFileRoute("/app/loja/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos | Comandiva" },
      { name: "description", content: "Filas operacionais de pedidos da loja em tempo real." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OrdersPanel,
});

function OrdersPanel() {
  const storesQuery = useMyStores();
  const stores = storesQuery.data ?? [];
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const storeId = selectedStore ?? (stores.length === 1 ? stores[0].id : null);
  const selectionRequired = !storeId && stores.length > 1;
  const [queueKey, setQueueKey] = useState(ORDER_QUEUES[0].key);
  const [search, setSearch] = useState("");
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const fulfillmentParams = Route.useSearch() as any;
  const [fulfillment, setFulfillment] = useState<"entrega" | "retirada" | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(fulfillmentParams?.open || null);
  const queue = ORDER_QUEUES.find((item) => item.key === queueKey) ?? ORDER_QUEUES[0];
  const filters = useMemo(
    () => ({ statuses: queue.statuses, fulfillment, search, delayedOnly }),
    [queue.statuses, fulfillment, search, delayedOnly],
  );
  const enabled = !selectionRequired && !storesQuery.isLoading;
  const live = useOrderRealtime(storeId);
  const countsQuery = useOrderCounts(storeId, enabled);
  const listQuery = useOrderQueue(storeId, filters, enabled);
  const counts = countsQuery.data?.byStatus ?? {};
  const countFor = (statuses: string[]) => statuses.reduce((total, status) => total + (counts[status as never] ?? 0), 0);
  const activeFilterCount = Number(Boolean(fulfillment)) + Number(delayedOnly);

  if (storesQuery.isLoading) {
    return <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 sm:px-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full rounded-xl" /></div>;
  }
  if (storesQuery.error || stores.length === 0) {
    return <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6"><ErrorState title="Sem acesso a pedidos" description="Sua conta não está vinculada a nenhuma loja com permissão de fila de pedidos." /></div>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <StoreOperationalAlerts />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight">Pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe cada pedido da chegada até a entrega ou retirada.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={live ? "success" : "secondary"} className="gap-1.5"><RadioTower className="size-3.5" />{live ? "Atualização ao vivo" : "Atualização periódica"}</Badge>
          <Button variant="outline" size="icon" aria-label="Atualizar pedidos" onClick={() => { void countsQuery.refetch(); void listQuery.refetch(); }}><RefreshCw className="size-4" /></Button>
        </div>
      </header>

      {stores.length > 1 ? <div className="mt-4 flex flex-wrap gap-2">{stores.map((store) => <Button key={store.id} size="sm" variant={storeId === store.id ? "default" : "outline"} onClick={() => setSelectedStore(store.id)}>{store.name}</Button>)}</div> : null}

      {selectionRequired ? (
        <EmptyState className="mt-8" title="Escolha uma loja" description="Sua conta atende mais de uma loja. Selecione qual fila você quer operar agora." />
      ) : (
        <>
          <nav className="rail mt-6 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Filas de pedidos">
            {ORDER_QUEUES.map((item) => (
              <Button key={item.key} size="sm" className="shrink-0" variant={item.key === queueKey ? "default" : "outline"} onClick={() => setQueueKey(item.key)} aria-current={item.key === queueKey ? "page" : undefined}>
                {item.label}<span className="ml-1.5 tabular-nums opacity-70">{countFor(item.statuses)}</span>
              </Button>
            ))}
          </nav>

          <div className="mt-4 flex items-center gap-2">
            <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Número do pedido ou nome" aria-label="Buscar pedidos" className="pl-9" /></div>
            <Button variant={activeFilterCount ? "default" : "outline"} className="shrink-0 md:hidden" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal className="size-4" /> Filtros{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </Button>
            <div className="hidden items-center gap-2 md:flex">
              <Button size="sm" variant={fulfillment === "entrega" ? "default" : "outline"} onClick={() => setFulfillment(fulfillment === "entrega" ? null : "entrega")}><Bike className="size-4" /> Entrega</Button>
              <Button size="sm" variant={fulfillment === "retirada" ? "default" : "outline"} onClick={() => setFulfillment(fulfillment === "retirada" ? null : "retirada")}><ShoppingBag className="size-4" /> Retirada</Button>
              <Button size="sm" variant={delayedOnly ? "default" : "outline"} onClick={() => setDelayedOnly((value) => !value)}><AlertTriangle className="size-4" /> Atrasados</Button>
            </div>
          </div>

          <section className="mt-5">
            {listQuery.isLoading ? <div className="space-y-3"><Skeleton className="h-28 w-full rounded-xl" /><Skeleton className="h-28 w-full rounded-xl" /></div> : listQuery.error ? <ErrorState title="Não foi possível carregar a fila" description="Verifique sua conexão e tente novamente." onRetry={() => void listQuery.refetch()} /> : (listQuery.data?.orders.length ?? 0) === 0 ? <EmptyState title="Nenhum pedido nesta fila" description="Assim que um pedido chegar nesta etapa, ele aparece aqui automaticamente." /> : (
              <ul className="grid gap-3 md:grid-cols-2">{listQuery.data?.orders.map((order) => <OrderCard key={order.id} order={order} storeId={storeId} onOpen={() => setOpenOrderId(order.id)} />)}</ul>
            )}
            {listQuery.data?.nextCursor ? <Button variant="outline" className="mt-4 w-full" onClick={() => listQuery.setCursor(listQuery.data?.nextCursor ?? null)}>Ver mais antigos</Button> : null}
            {listQuery.cursor ? <Button variant="ghost" className="mt-2 w-full" onClick={() => listQuery.setCursor(null)}>Voltar ao início da fila</Button> : null}
          </section>
        </>
      )}

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-[28px] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-5">
          <SheetHeader className="text-left"><SheetTitle>Filtrar pedidos</SheetTitle><SheetDescription>Use somente os filtros que fazem parte da operação atual.</SheetDescription></SheetHeader>
          <div className="mt-5 space-y-5">
            <div><p className="mb-2 text-sm font-semibold">Modalidade</p><div className="grid grid-cols-3 gap-2"><Button variant={fulfillment === null ? "default" : "outline"} onClick={() => setFulfillment(null)}>Todos</Button><Button variant={fulfillment === "entrega" ? "default" : "outline"} onClick={() => setFulfillment("entrega")}><Bike className="size-4" /> Entrega</Button><Button variant={fulfillment === "retirada" ? "default" : "outline"} onClick={() => setFulfillment("retirada")}><ShoppingBag className="size-4" /> Retirada</Button></div></div>
            <Button className="w-full justify-between" variant={delayedOnly ? "default" : "outline"} onClick={() => setDelayedOnly((value) => !value)}><span className="flex items-center gap-2"><AlertTriangle className="size-4" /> Mostrar apenas atrasados</span><span>{delayedOnly ? "Ativo" : ""}</span></Button>
            <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => { setFulfillment(null); setDelayedOnly(false); }}>Limpar</Button><Button className="flex-1" onClick={() => setFiltersOpen(false)}>Ver pedidos</Button></div>
          </div>
        </SheetContent>
      </Sheet>

      <OrderDetailDialog storeId={storeId} storeName={stores.find((store) => store.id === storeId)?.name ?? "Loja"} orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
}

function OrderCard({ order, storeId, onOpen }: { order: StoreOrderListItem; storeId: string | null; onOpen: () => void }) {
  return (
    <li className={`panel p-4 ${order.status === "aguardando_confirmacao" ? "border-brand/30 shadow-e2" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-lg font-semibold tabular-nums">#{order.orderNumber}</p><p className="text-sm text-muted-foreground">{order.customerFirstName} · {order.itemCount} item(ns) · {order.fulfillment === "entrega" ? "Entrega" : "Retirada"}</p></div>
        <div className="text-right"><p className="font-semibold tabular-nums">{brl(order.total)}</p><p className="text-xs text-muted-foreground">{order.paymentLabel ?? "Pagamento"}</p></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant={orderStatusBadgeVariant(order.status)}>{STATUS_LABEL[order.status]}</Badge>
        {order.isDelayed ? <Badge variant="danger" className="gap-1"><Clock className="size-3" /> Atrasado {order.delayMinutes} min</Badge> : null}
        {order.route ? <Badge variant="outline" className="gap-1"><RouteIcon className="size-3" />{formatRouteDistance(order.route.distanceMeters)} · {formatRouteDuration(order.route.durationSeconds)}{order.route.isApproximate ? " · aprox." : ""}</Badge> : null}
        <span className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <div className="mt-4 flex items-center gap-2"><OrderActions storeId={storeId} order={order} /><Button size="sm" variant="ghost" className="ml-auto" onClick={onOpen}>Detalhes</Button></div>
    </li>
  );
}

function OrderActions({ storeId, order }: { storeId: string | null; order: { id: string; version: number; allowedActions: StoreOrderAction[] } }) {
  const { run, isRunning } = useOrderTransition(storeId);
  const [pendingAction, setPendingAction] = useState<StoreOrderAction | null>(null);
  const direct = order.allowedActions.filter((action) => action !== "reject" && action !== "cancel");
  const withReason = order.allowedActions.filter((action) => action === "reject" || action === "cancel");
  const primary = direct[0] ?? null;

  return (
    <>
      {primary ? <Button size="sm" disabled={isRunning} onClick={() => void run({ action: primary, orderId: order.id, expectedVersion: order.version }, `${ACTION_LABEL[primary]}: feito.`)}>{ACTION_LABEL[primary]}</Button> : null}
      {withReason.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="sm" variant="outline" disabled={isRunning} aria-label="Mais ações"><MoreHorizontal className="size-4" /> Mais</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {withReason.map((action) => <DropdownMenuItem key={action} className="text-destructive" onClick={() => setPendingAction(action)}>{ACTION_LABEL[action]}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <ReasonDialog action={pendingAction} storeId={storeId} orderId={order.id} version={order.version} onClose={() => setPendingAction(null)} />
    </>
  );
}

function ReasonDialog({ action, storeId, orderId, version, onClose }: { action: StoreOrderAction | null; storeId: string | null; orderId: string; version: number; onClose: () => void }) {
  const reasonsQuery = useTransitionReasons();
  const { run, isRunning } = useOrderTransition(storeId);
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [internalNote, setInternalNote] = useState("");
  const open = action === "reject" || action === "cancel";
  const reasons = (reasonsQuery.data ?? []).filter((reason) => action === "reject" ? reason.applies_reject : reason.applies_cancel);
  const selected = reasons.find((reason) => reason.code === reasonCode) ?? null;
  function close() { setReasonCode(null); setInternalNote(""); onClose(); }
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : close())}>
      <DialogContent>
        <DialogHeader><DialogTitle>{action === "reject" ? "Recusar pedido" : "Cancelar pedido"}</DialogTitle><DialogDescription>Escolha o motivo. A observação interna fica somente para a equipe.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">{reasons.map((reason) => <Button key={reason.code} type="button" size="sm" variant={reasonCode === reason.code ? "default" : "outline"} onClick={() => setReasonCode(reason.code)}>{reason.internal_label}</Button>)}</div>
          {selected?.public_message ? <p className="rounded-xl border border-border bg-surface-muted p-3 text-sm text-muted-foreground">O cliente verá: “{selected.public_message}”</p> : null}
          <div className="space-y-1.5"><Label htmlFor="internal-note">Observação interna (opcional)</Label><Textarea id="internal-note" value={internalNote} maxLength={500} onChange={(event) => setInternalNote(event.target.value)} placeholder="Contexto para a equipe. Não aparece para o cliente." /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={close} disabled={isRunning}>Voltar</Button><Button variant="destructive" disabled={!reasonCode || isRunning} loading={isRunning} onClick={async () => { if (!action || !reasonCode) return; const done = await run({ action, orderId, expectedVersion: version, reasonCode, internalNote: internalNote.trim() || null }, action === "reject" ? "Pedido recusado." : "Pedido cancelado."); if (done) close(); }}>Confirmar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrderDetailDialog({ storeId, storeName, orderId, onClose }: { storeId: string | null; storeName: string; orderId: string | null; onClose: () => void }) {
  const detailQuery = useOrderDetail(storeId, orderId);
  const historyQuery = useOrderHistory(storeId, orderId, Boolean(orderId));
  const detail = detailQuery.data;
  return (
    <Sheet open={Boolean(orderId)} onOpenChange={(next) => (next ? null : onClose())}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-5 py-4 text-left sm:px-6"><SheetTitle>{detail ? `Pedido #${detail.orderNumber}` : "Detalhes do pedido"}</SheetTitle><SheetDescription>{detail ? `${STATUS_LABEL[detail.status]} · ${detail.fulfillment === "entrega" ? "Entrega" : "Retirada"}` : "Carregando informações do pedido."}</SheetDescription></SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {detailQuery.isLoading ? <Skeleton className="h-48 w-full rounded-xl" /> : detail ? (
            <div className="space-y-4 text-sm">
              <div><p className="font-medium">{detail.customer.fullName ?? detail.customer.firstName}</p>{detail.customer.phone ? <p className="text-muted-foreground">{detail.customer.phone}</p> : null}{detail.delivery?.neighborhood ? <p className="text-muted-foreground">Bairro: {detail.delivery.neighborhood}</p> : null}</div>
              {detail.delivery?.route ? <div className="rounded-xl border border-border bg-muted/40 p-3"><p className="flex items-center gap-2 font-semibold"><RouteIcon className="size-4" />{formatRouteDistance(detail.delivery.route.distanceMeters)} · {formatRouteDuration(detail.delivery.route.durationSeconds)}</p><p className="mt-1 text-xs text-muted-foreground">Estimativa de deslocamento para a entrega.</p></div> : null}
              <Separator />
              <ul className="space-y-2">{detail.items.map((item, index) => <li key={`${item.productName}-${index}`}><div className="flex justify-between gap-3"><span>{item.quantity}× {item.productName}{item.variantName ? ` · ${item.variantName}` : ""}</span><span className="tabular-nums">{brl(item.lineTotal)}</span></div>{item.options.length > 0 ? <p className="text-xs text-muted-foreground">{item.options.map((option) => option.optionName).join(", ")}</p> : null}{item.notes ? <p className="text-xs text-muted-foreground">{item.notes}</p> : null}</li>)}</ul>
              {detail.notes ? <p className="rounded-xl border border-border bg-surface-muted p-3 text-xs">Observação do cliente: {detail.notes}</p> : null}
              <Separator />
              <div className="flex justify-between font-semibold"><span>Total</span><span className="tabular-nums">{brl(detail.totals.total)}</span></div>
              <p className="text-xs text-muted-foreground">{detail.payment.label ?? "Pagamento"}{detail.payment.needsChange && detail.payment.changeFor ? ` · troco para ${brl(detail.payment.changeFor)}` : ""}</p>
              <Button variant="outline" onClick={() => printOrderReceipt(detail, { name: storeName })}><Printer className="size-4" /> Imprimir pedido</Button>
              {detail.fulfillment === "entrega" ? <DeliveryAssignmentPanel storeId={storeId} orderId={detail.id} /> : null}
              <Separator />
              <div><h3 className="text-sm font-semibold">Histórico</h3>{historyQuery.isLoading ? <Skeleton className="mt-2 h-20 w-full rounded-lg" /> : historyQuery.error ? <p className="mt-2 text-xs text-muted-foreground">O histórico completo não está disponível para este perfil.</p> : <ol className="mt-2 space-y-2">{(historyQuery.data ?? []).map((entry, index) => <li key={`${entry.occurredAt}-${index}`} className="text-xs"><span className="font-medium">{STATUS_LABEL[entry.toStatus]}</span>{" "}<span className="text-muted-foreground">{new Date(entry.occurredAt).toLocaleString("pt-BR")} · {entry.actorName ?? "Equipe"}</span>{entry.internalNote ? <p className="text-muted-foreground">{entry.internalNote}</p> : null}</li>)}</ol>}</div>
            </div>
          ) : <ErrorState title="Pedido indisponível" description="Não conseguimos carregar este pedido agora." onRetry={() => void detailQuery.refetch()} />}
        </div>
        {detail && detail.allowedActions.length > 0 ? (
          <div className="border-t border-border bg-card px-5 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-6">
            <div className="flex items-center gap-2"><OrderActions storeId={storeId} order={{ id: detail.id, version: detail.version, allowedActions: detail.allowedActions }} /></div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DeliveryAssignmentPanel({ storeId, orderId }: { storeId: string | null; orderId: string }) {
  const assignmentQuery = useDeliveryAssignment(storeId, orderId);
  const eligibleQuery = useEligibleCouriers(storeId, orderId);
  const assign = useAssignCourier();
  const assignment = assignmentQuery.data;
  if (assignmentQuery.isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!assignment?.applicable || !assignment.delivery) return null;
  const current = assignment.delivery.courier;
  const route = assignment.delivery.route ?? null;
  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <div><h3 className="font-semibold">Entregador</h3><p className="text-xs text-muted-foreground">{current ? `Atribuído a ${current.displayName} · ${COURIER_VEHICLE_LABEL[current.vehicle]}` : "Escolha quem fará esta entrega."}</p></div>
      {route ? <div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-semibold">{formatRouteDistance(route.distanceMeters)} · {formatRouteDuration(route.durationSeconds)}</p><p className="text-xs text-muted-foreground">Estimativa de deslocamento.</p></div> : null}
      {eligibleQuery.isLoading ? <Skeleton className="h-10 w-full rounded-md" /> : (eligibleQuery.data?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">Nenhum entregador cadastrado.</p> : (
        <div className="grid gap-2 sm:grid-cols-2">
          {eligibleQuery.data?.map((courier) => <Button key={courier.courierId} type="button" variant={current?.courierId === courier.courierId ? "default" : "outline"} className="h-auto min-h-11 flex-col items-start gap-0.5 py-2 text-left" disabled={assign.isPending || courier.eligibility === "blocked" || Boolean(current)} onClick={() => assign.mutate({ storeId, orderId, courierId: courier.courierId, expectedDeliveryVersion: assignment.delivery?.version ?? 0 })}><span>{courier.displayName} · {COURIER_VEHICLE_LABEL[courier.vehicle]}</span><span className="text-[10px] font-normal opacity-70">{courier.blockingReason ? BLOCKING_REASON_LABEL[courier.blockingReason] ?? "Indisponível" : courier.presenceStatus === "offline" ? "Offline — confirme antes" : "Disponível"}</span></Button>)}
        </div>
      )}
    </section>
  );
}
