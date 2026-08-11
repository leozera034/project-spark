/**
 * Fase 16 — Painel real de pedidos da loja.
 *
 * Filas por status, sinal de tempo real, ações vindas do servidor e histórico
 * completo. Nada de transição otimista: cada ação envia a versão conhecida e
 * a tela só muda com a resposta do banco.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bike,
  Clock,
  RadioTower,
  Printer,
  RefreshCw,
  Search,
  ShoppingBag,
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
  ACTION_LABEL,
  ORDER_QUEUES,
  STATUS_LABEL,
  type StoreOrderAction,
  type StoreOrderListItem,
} from "@/store-orders/types";

export const Route = createFileRoute("/app/loja/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos | Pediu Aqui" },
      { name: "description", content: "Filas operacionais de pedidos da loja em tempo real." },
      { property: "og:title", content: "Pedidos | Pediu Aqui" },
      { property: "og:description", content: "Filas operacionais de pedidos da loja." },
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
  const countFor = (statuses: string[]) =>
    statuses.reduce((total, status) => total + (counts[status as never] ?? 0), 0);

  if (storesQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (storesQuery.error || stores.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <ErrorState
          title="Sem acesso a pedidos"
          description="Sua conta não está vinculada a nenhuma loja com permissão de fila de pedidos."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <StoreOperationalAlerts />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Filas operacionais da sua loja, atualizadas automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={live ? "default" : "secondary"} className="gap-1.5">
            <RadioTower className="size-3.5" />
            {live ? "Tempo real ativo" : "Atualização periódica"}
          </Badge>
          <Button
            variant="outline"
            size="icon"
            aria-label="Atualizar filas"
            onClick={() => {
              void countsQuery.refetch();
              void listQuery.refetch();
            }}
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </header>

      {stores.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {stores.map((store) => (
            <Button
              key={store.id}
              size="sm"
              variant={storeId === store.id ? "default" : "outline"}
              onClick={() => setSelectedStore(store.id)}
            >
              {store.name}
            </Button>
          ))}
        </div>
      ) : null}

      {selectionRequired ? (
        <EmptyState
          className="mt-8"
          title="Escolha uma loja"
          description="Sua conta atende mais de uma loja. Selecione qual fila você quer operar agora."
        />
      ) : (
        <>
          <nav className="mt-6 flex flex-wrap gap-2" aria-label="Filas de pedidos">
            {ORDER_QUEUES.map((item) => (
              <Button
                key={item.key}
                size="sm"
                variant={item.key === queueKey ? "default" : "outline"}
                onClick={() => setQueueKey(item.key)}
                aria-current={item.key === queueKey ? "page" : undefined}
              >
                {item.label}
                <span className="ml-1.5 tabular-nums opacity-70">{countFor(item.statuses)}</span>
              </Button>
            ))}
          </nav>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Número do pedido ou nome"
                aria-label="Buscar pedidos"
                className="pl-9"
              />
            </div>
            <Button
              size="sm"
              variant={fulfillment === "entrega" ? "default" : "outline"}
              onClick={() => setFulfillment(fulfillment === "entrega" ? null : "entrega")}
            >
              <Bike className="size-4" /> Entrega
            </Button>
            <Button
              size="sm"
              variant={fulfillment === "retirada" ? "default" : "outline"}
              onClick={() => setFulfillment(fulfillment === "retirada" ? null : "retirada")}
            >
              <ShoppingBag className="size-4" /> Retirada
            </Button>
            <Button
              size="sm"
              variant={delayedOnly ? "default" : "outline"}
              onClick={() => setDelayedOnly((value) => !value)}
            >
              <AlertTriangle className="size-4" /> Atrasados
            </Button>
          </div>

          <section className="mt-5">
            {listQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
            ) : listQuery.error ? (
              <ErrorState
                title="Não foi possível carregar a fila"
                description="Verifique sua conexão e tente de novo."
                onRetry={() => void listQuery.refetch()}
              />
            ) : (listQuery.data?.orders.length ?? 0) === 0 ? (
              <EmptyState
                title="Nenhum pedido nesta fila"
                description="Assim que um pedido chegar nesta etapa, ele aparece aqui automaticamente."
              />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {listQuery.data?.orders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    storeId={storeId}
                    onOpen={() => setOpenOrderId(order.id)}
                  />
                ))}
              </ul>
            )}

            {listQuery.data?.nextCursor ? (
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => listQuery.setCursor(listQuery.data?.nextCursor ?? null)}
              >
                Ver mais antigos
              </Button>
            ) : null}
            {listQuery.cursor ? (
              <Button variant="ghost" className="mt-2 w-full" onClick={() => listQuery.setCursor(null)}>
                Voltar ao início da fila
              </Button>
            ) : null}
          </section>
        </>
      )}

      <OrderDetailDialog
        storeId={storeId}
        storeName={stores.find((store) => store.id === storeId)?.name ?? "Loja"}
        orderId={openOrderId}
        onClose={() => setOpenOrderId(null)}
      />
    </div>
  );
}

function OrderCard({
  order,
  storeId,
  onOpen,
}: {
  order: StoreOrderListItem;
  storeId: string | null;
  onOpen: () => void;
}) {
  return (
    <li className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold tabular-nums">#{order.orderNumber}</p>
          <p className="text-sm text-muted-foreground">
            {order.customerFirstName} · {order.itemCount} item(ns) ·{" "}
            {order.fulfillment === "entrega" ? "Entrega" : "Retirada"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{brl(order.total)}</p>
          <p className="text-xs text-muted-foreground">{order.paymentLabel ?? "Pagamento"}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant={orderStatusBadgeVariant(order.status)}>{STATUS_LABEL[order.status]}</Badge>
        {order.isDelayed ? (
          <Badge variant="danger" className="gap-1">
            <Clock className="size-3" /> Atrasado {order.delayMinutes} min
          </Badge>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {new Date(order.createdAt).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <OrderActions storeId={storeId} order={order} />
        <Button size="sm" variant="ghost" onClick={onOpen}>
          Detalhes
        </Button>
      </div>
    </li>
  );
}

function OrderActions({
  storeId,
  order,
}: {
  storeId: string | null;
  order: { id: string; version: number; allowedActions: StoreOrderAction[] };
}) {
  const { run, isRunning } = useOrderTransition(storeId);
  const [pendingAction, setPendingAction] = useState<StoreOrderAction | null>(null);

  const direct = order.allowedActions.filter(
    (action) => action !== "reject" && action !== "cancel",
  );
  const withReason = order.allowedActions.filter(
    (action) => action === "reject" || action === "cancel",
  );

  return (
    <>
      {direct.map((action) => (
        <Button
          key={action}
          size="sm"
          disabled={isRunning}
          onClick={() =>
            void run(
              { action, orderId: order.id, expectedVersion: order.version },
              `${ACTION_LABEL[action]}: feito.`,
            )
          }
        >
          {ACTION_LABEL[action]}
        </Button>
      ))}
      {withReason.map((action) => (
        <Button
          key={action}
          size="sm"
          variant="outline"
          disabled={isRunning}
          onClick={() => setPendingAction(action)}
        >
          {ACTION_LABEL[action]}
        </Button>
      ))}

      <ReasonDialog
        action={pendingAction}
        storeId={storeId}
        orderId={order.id}
        version={order.version}
        onClose={() => setPendingAction(null)}
      />
    </>
  );
}

/** Recusa e cancelamento exigem motivo do catálogo controlado. */
function ReasonDialog({
  action,
  storeId,
  orderId,
  version,
  onClose,
}: {
  action: StoreOrderAction | null;
  storeId: string | null;
  orderId: string;
  version: number;
  onClose: () => void;
}) {
  const reasonsQuery = useTransitionReasons();
  const { run, isRunning } = useOrderTransition(storeId);
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [internalNote, setInternalNote] = useState("");

  const open = action === "reject" || action === "cancel";
  const reasons = (reasonsQuery.data ?? []).filter((reason) =>
    action === "reject" ? reason.applies_reject : reason.applies_cancel,
  );
  const selected = reasons.find((reason) => reason.code === reasonCode) ?? null;

  function close() {
    setReasonCode(null);
    setInternalNote("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action === "reject" ? "Recusar pedido" : "Cancelar pedido"}</DialogTitle>
          <DialogDescription>
            Escolha o motivo. O cliente vê apenas a mensagem pública ligada a ele; a observação
            interna fica só no histórico da loja.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {reasons.map((reason) => (
              <Button
                key={reason.code}
                type="button"
                size="sm"
                variant={reasonCode === reason.code ? "default" : "outline"}
                onClick={() => setReasonCode(reason.code)}
              >
                {reason.internal_label}
              </Button>
            ))}
          </div>

          {selected?.public_message ? (
            <p className="rounded-xl border border-border bg-surface-muted p-3 text-sm text-muted-foreground">
              O cliente verá: “{selected.public_message}”
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="internal-note">Observação interna (opcional)</Label>
            <Textarea
              id="internal-note"
              value={internalNote}
              maxLength={500}
              onChange={(event) => setInternalNote(event.target.value)}
              placeholder="Contexto para a equipe. Não aparece para o cliente."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={isRunning}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            disabled={!reasonCode || isRunning}
            loading={isRunning}
            onClick={async () => {
              if (!action || !reasonCode) return;
              const done = await run(
                {
                  action,
                  orderId,
                  expectedVersion: version,
                  reasonCode,
                  internalNote: internalNote.trim() || null,
                },
                action === "reject" ? "Pedido recusado." : "Pedido cancelado.",
              );
              if (done) close();
            }}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrderDetailDialog({
  storeId,
  storeName,
  orderId,
  onClose,
}: {
  storeId: string | null;
  storeName: string;
  orderId: string | null;
  onClose: () => void;
}) {
  const detailQuery = useOrderDetail(storeId, orderId);
  const historyQuery = useOrderHistory(storeId, orderId, Boolean(orderId));
  const detail = detailQuery.data;

  return (
    <Dialog open={Boolean(orderId)} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {detail ? `Pedido #${detail.orderNumber}` : "Detalhes do pedido"}
          </DialogTitle>
          <DialogDescription>
            {detail
              ? `${STATUS_LABEL[detail.status]} · ${detail.fulfillment === "entrega" ? "Entrega" : "Retirada"}`
              : "Carregando informações do pedido."}
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isLoading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : detail ? (
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium">{detail.customer.fullName ?? detail.customer.firstName}</p>
              {detail.customer.phone ? (
                <p className="text-muted-foreground">{detail.customer.phone}</p>
              ) : null}
              {detail.delivery?.neighborhood ? (
                <p className="text-muted-foreground">Bairro: {detail.delivery.neighborhood}</p>
              ) : null}
            </div>

            <Separator />

            <ul className="space-y-2">
              {detail.items.map((item, index) => (
                <li key={`${item.productName}-${index}`}>
                  <div className="flex justify-between gap-3">
                    <span>
                      {item.quantity}× {item.productName}
                      {item.variantName ? ` · ${item.variantName}` : ""}
                    </span>
                    <span className="tabular-nums">{brl(item.lineTotal)}</span>
                  </div>
                  {item.options.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {item.options.map((option) => option.optionName).join(", ")}
                    </p>
                  ) : null}
                  {item.notes ? (
                    <p className="text-xs text-muted-foreground">{item.notes}</p>
                  ) : null}
                </li>
              ))}
            </ul>

            {detail.notes ? (
              <p className="rounded-xl border border-border bg-surface-muted p-3 text-xs">
                Observação do cliente: {detail.notes}
              </p>
            ) : null}

            <Separator />

            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{brl(detail.totals.total)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {detail.payment.label ?? "Pagamento"}
              {detail.payment.needsChange && detail.payment.changeFor
                ? ` · troco para ${brl(detail.payment.changeFor)}`
                : ""}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => printOrderReceipt(detail, { name: storeName })}
              >
                <Printer className="size-4" /> Imprimir cupom (80mm)
              </Button>
              <OrderActions
                storeId={storeId}
                order={{
                  id: detail.id,
                  version: detail.version,
                  allowedActions: detail.allowedActions,
                }}
              />
            </div>

            {detail.fulfillment === "entrega" ? (
              <DeliveryAssignmentPanel storeId={storeId} orderId={detail.id} />
            ) : null}

            <Separator />

            <div>
              <h3 className="text-sm font-semibold">Histórico</h3>
              {historyQuery.isLoading ? (
                <Skeleton className="mt-2 h-20 w-full rounded-lg" />
              ) : historyQuery.error ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Seu perfil não tem acesso ao histórico completo deste pedido.
                </p>
              ) : (
                <ol className="mt-2 space-y-2">
                  {(historyQuery.data ?? []).map((entry, index) => (
                    <li key={`${entry.occurredAt}-${index}`} className="text-xs">
                      <span className="font-medium">{STATUS_LABEL[entry.toStatus]}</span>{" "}
                      <span className="text-muted-foreground">
                        {new Date(entry.occurredAt).toLocaleString("pt-BR")} ·{" "}
                        {entry.actorName ?? entry.actorKind}
                      </span>
                      {entry.internalNote ? (
                        <p className="text-muted-foreground">{entry.internalNote}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        ) : (
          <ErrorState
            title="Pedido indisponível"
            description="Não conseguimos carregar este pedido agora."
            onRetry={() => void detailQuery.refetch()}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeliveryAssignmentPanel({
  storeId,
  orderId,
}: {
  storeId: string | null;
  orderId: string;
}) {
  const assignmentQuery = useDeliveryAssignment(storeId, orderId);
  const eligibleQuery = useEligibleCouriers(storeId, orderId);
  const assign = useAssignCourier();
  const assignment = assignmentQuery.data;

  if (assignmentQuery.isLoading) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  if (!assignment?.applicable || !assignment.delivery) return null;

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="font-semibold">Entregador</h3>
        <p className="text-xs text-muted-foreground">
          {assignment.delivery.courier
            ? `Atribuído a ${assignment.delivery.courier.displayName}`
            : "Escolha quem fará esta entrega."}
        </p>
      </div>

      {eligibleQuery.isLoading ? (
        <Skeleton className="h-10 w-full rounded-md" />
      ) : (eligibleQuery.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum entregador ativo disponível.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {eligibleQuery.data?.map((courier) => (
            <Button
              key={courier.courierId}
              type="button"
              variant={assignment.delivery?.courier?.courierId === courier.courierId ? "default" : "outline"}
              disabled={assign.isPending || courier.eligibility === "blocked" || Boolean(assignment.delivery?.courier)}
              onClick={() =>
                assign.mutate({
                  storeId,
                  orderId,
                  courierId: courier.courierId,
                  expectedDeliveryVersion: assignment.delivery?.version ?? 0,
                })
              }
            >
              {courier.displayName}
              {courier.presenceStatus === "offline" ? " · offline" : ""}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
