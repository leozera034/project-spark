/**
 * Fase 17 — Modo Cozinha.
 *
 * Projeção mínima: número, tempos, itens, quantidades, variações, opções,
 * porções e observações. Nenhum dado do cliente, nenhum valor financeiro.
 * As ações reutilizam a máquina central de transições da Fase 16.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ChefHat, Maximize2, Minimize2, RefreshCw, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyStores } from "@/store-orders/useStoreOrders";
import {
  useKitchenAction,
  useKitchenQueue,
  useKitchenRealtime,
  useOnlineStatus,
  useServerClock,
} from "@/kitchen/useKitchenOrders";
import {
  formatKitchenQuantity,
  KITCHEN_ACTION_LABEL,
  type KitchenAction,
  type KitchenOrder,
} from "@/kitchen/types";

export const Route = createFileRoute("/app/loja/cozinha")({
  head: () => ({
    meta: [
      { title: "Cozinha | Comandiva" },
      { name: "description", content: "Fila de preparo da cozinha, com itens e tempos." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: KitchenPage,
});

function minutesBetween(fromIso: string | null, nowMs: number): number | null {
  if (!fromIso) return null;
  const diff = Math.floor((nowMs - new Date(fromIso).getTime()) / 60_000);
  return diff < 0 ? 0 : diff;
}

function elapsedLabel(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function timeLabel(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function humanizePortionLabel(value: string | null): string | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return value;
  const current = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return value;
  return `em ${current} de ${total} ${total === 1 ? "parte" : "partes"}`;
}

function KitchenPage() {
  const online = useOnlineStatus();
  const stores = useMyStores();
  const storeId = stores.data?.[0]?.id ?? null;

  const live = useKitchenRealtime(storeId);
  const queue = useKitchenQueue(storeId, live, online);
  const { run, pendingId } = useKitchenAction(storeId, online);
  const nowMs = useServerClock(queue.data?.serverNow);

  const [fullscreen, setFullscreen] = useState(false);
  const [tab, setTab] = useState<"todo" | "doing">("todo");
  const [removedNotice, setRemovedNotice] = useState(false);
  const knownIds = useRef<Set<string>>(new Set());
  const actedId = useRef<string | null>(null);

  const orders = useMemo(() => queue.data?.orders ?? [], [queue.data]);
  const toPrepare = orders.filter((o) => o.status === "aceito");
  const inPreparation = orders.filter((o) => o.status === "em_preparo");

  useEffect(() => {
    if (!queue.data) return;
    const current = new Set(orders.map((o) => o.orderId));
    let vanished = false;
    knownIds.current.forEach((id) => {
      if (!current.has(id) && id !== actedId.current) vanished = true;
    });
    knownIds.current = current;
    if (vanished) {
      setRemovedNotice(true);
      window.setTimeout(() => setRemovedNotice(false), 10_000);
    }
  }, [orders, queue.data]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  };

  const act = async (order: KitchenOrder, action: KitchenAction) => {
    actedId.current = order.orderId;
    await run({ action, orderId: order.orderId, expectedVersion: order.version });
    window.setTimeout(() => {
      actedId.current = null;
    }, 1_000);
  };

  const lastUpdate = queue.dataUpdatedAt
    ? new Date(queue.dataUpdatedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <main className="mx-auto w-full max-w-[1800px] px-3 py-4 sm:px-6 lg:px-8">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ChefHat className="size-7 text-brand" aria-hidden="true" />
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Cozinha</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={online ? (live ? "default" : "secondary") : "destructive"}
            className="gap-1.5"
          >
            {online ? null : <WifiOff className="size-3.5" aria-hidden="true" />}
            {online ? (live ? "Atualização automática" : "Atualização periódica") : "Sem conexão"}
          </Badge>
          <span className="text-sm text-muted-foreground">Atualizado às {lastUpdate}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void queue.refetch()}
            disabled={!online || queue.isFetching}
          >
            <RefreshCw
              className={`size-4 ${queue.isFetching ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            {fullscreen ? (
              <Minimize2 className="size-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="size-4" aria-hidden="true" />
            )}
            {fullscreen ? "Sair da tela cheia" : "Tela cheia"}
          </Button>
        </div>
      </header>

      {!online ? (
        <p
          role="status"
          className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-base"
        >
          Sem conexão. Você pode consultar os pedidos carregados, mas não pode atualizar o preparo.
        </p>
      ) : null}

      {removedNotice ? (
        <p
          role="status"
          className="mb-4 rounded-lg border border-border bg-muted px-4 py-3 text-base"
        >
          Este pedido foi cancelado e saiu da fila de preparo.
        </p>
      ) : null}

      {queue.isError ? (
        <ErrorState
          title="Não foi possível abrir a cozinha"
          description="Confira sua permissão de cozinha ou tente novamente."
          onRetry={() => void queue.refetch()}
        />
      ) : queue.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <div className="mb-3 flex gap-2 lg:hidden" role="tablist" aria-label="Filas da cozinha">
            <Button
              role="tab"
              aria-selected={tab === "todo"}
              variant={tab === "todo" ? "default" : "outline"}
              className="h-14 flex-1 text-base"
              onClick={() => setTab("todo")}
            >
              A preparar ({toPrepare.length})
            </Button>
            <Button
              role="tab"
              aria-selected={tab === "doing"}
              variant={tab === "doing" ? "default" : "outline"}
              className="h-14 flex-1 text-base"
              onClick={() => setTab("doing")}
            >
              Em preparo ({inPreparation.length})
            </Button>
          </div>

          {toPrepare.length === 0 && inPreparation.length === 0 ? (
            <EmptyState
              title="A cozinha está em dia."
              description="Nenhum pedido aguardando preparo agora."
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <KitchenColumn
                title="A preparar"
                hidden={tab !== "todo"}
                emptyText="Nenhum pedido aguardando preparo."
                orders={toPrepare}
                nowMs={nowMs}
                pendingId={pendingId}
                online={online}
                onAct={act}
              />
              <KitchenColumn
                title="Em preparo"
                hidden={tab !== "doing"}
                emptyText="Nenhum pedido em preparo agora."
                orders={inPreparation}
                nowMs={nowMs}
                pendingId={pendingId}
                online={online}
                onAct={act}
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}

function KitchenColumn(props: {
  title: string;
  hidden: boolean;
  emptyText: string;
  orders: KitchenOrder[];
  nowMs: number;
  pendingId: string | null;
  online: boolean;
  onAct: (order: KitchenOrder, action: KitchenAction) => void | Promise<void>;
}) {
  const { title, hidden, emptyText, orders, nowMs, pendingId, online, onAct } = props;

  return (
    <section
      aria-label={title}
      className={`${hidden ? "hidden lg:block" : "block"} rounded-xl border border-border bg-card/40 p-3 sm:p-4`}
    >
      <h2 className="mb-3 text-xl font-semibold sm:text-2xl">
        {title} <span className="text-muted-foreground">({orders.length})</span>
      </h2>
      {orders.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-base text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {orders.map((order) => (
            <li key={order.orderId}>
              <KitchenCard
                order={order}
                nowMs={nowMs}
                busy={pendingId === order.orderId}
                online={online}
                onAct={onAct}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function KitchenCard(props: {
  order: KitchenOrder;
  nowMs: number;
  busy: boolean;
  online: boolean;
  onAct: (order: KitchenOrder, action: KitchenAction) => void | Promise<void>;
}) {
  const { order, nowMs, busy, online, onAct } = props;
  const reference = order.preparationStartedAt ?? order.acceptedAt ?? order.createdAt;
  const elapsed = minutesBetween(reference, nowMs);
  const action = order.allowedActions[0] ?? null;

  const urgency =
    order.urgencyLevel === "delayed"
      ? { text: "Acima do tempo previsto", className: "border-destructive text-destructive" }
      : order.urgencyLevel === "attention"
        ? { text: "Perto do tempo previsto", className: "border-brand text-brand" }
        : null;

  return (
    <article
      className={`rounded-xl border-2 bg-card p-4 shadow-none ${
        order.urgencyLevel === "delayed" ? "border-destructive" : "border-border"
      }`}
    >
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[28px] font-bold leading-none tracking-tight">
          Pedido nº {order.orderNumber}
        </h3>
        <p className="text-lg text-muted-foreground">
          {timeLabel(order.acceptedAt ?? order.createdAt)} ·{" "}
          {order.status === "em_preparo" ? "em preparo há" : "há"} {elapsedLabel(elapsed)}
        </p>
      </header>

      {urgency ? (
        <p
          className={`mb-3 inline-flex items-center gap-2 rounded-md border-2 px-3 py-1 text-base font-medium ${urgency.className}`}
        >
          <AlertTriangle className="size-4" aria-hidden="true" />
          {urgency.text}
        </p>
      ) : null}

      <ul className="flex flex-col divide-y divide-border">
        {order.items.map((item) => (
          <li key={item.itemId} className="py-3 first:pt-0 last:pb-0">
            <p className="text-xl font-semibold leading-snug">
              <span className="mr-1 tabular-nums">
                {formatKitchenQuantity(item.quantity, item.measurementUnit)}
              </span>
              {item.productName}
              {item.variantName ? (
                <span className="font-normal text-muted-foreground"> — {item.variantName}</span>
              ) : null}
            </p>
            {item.optionGroups.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1.5 pl-1 text-base text-muted-foreground">
                {item.optionGroups.map((opt, index) => {
                  const portion = humanizePortionLabel(opt.portionLabel);
                  return (
                    <li key={`${item.itemId}-${index}`} className="leading-snug">
                      <span className="font-medium text-foreground/90">{opt.itemName}</span>
                      {!opt.portionLabel && opt.quantity > 1 ? ` ×${opt.quantity}` : ""}
                      {portion ? <span className="text-foreground/75"> — {portion}</span> : null}
                      <span className="opacity-65"> · {opt.groupName}</span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {item.note ? (
              <p className="mt-2 whitespace-pre-line rounded-md border-l-4 border-brand bg-muted px-3 py-2 text-base font-medium">
                {item.note}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <footer className="mt-4">
        {action ? (
          <Button
            className="h-[52px] w-full text-lg"
            loading={busy}
            disabled={busy || !online}
            onClick={() => void onAct(order, action)}
          >
            {KITCHEN_ACTION_LABEL[action]}
          </Button>
        ) : (
          <p className="text-base text-muted-foreground">
            Sem ação disponível para você neste pedido.
          </p>
        )}
      </footer>
    </article>
  );
}
