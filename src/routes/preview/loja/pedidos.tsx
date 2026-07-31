import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { SectionTitle } from "@/components/demo/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { neighborhoodById } from "@/demo/data/demoStore";
import { useDemo } from "@/demo/state/useDemo";
import type { DemoOrder, OrderStatus } from "@/demo/types/demo";
import { elapsedLabel, formatBRL } from "@/demo/utils/format";
import { demoHead } from "@/demo/utils/head";
import { fulfillmentLabel, orderStatusLabel, orderStatusTone, paymentLabel } from "@/demo/utils/labels";

export const Route = createFileRoute("/preview/loja/pedidos")({
  head: demoHead(
    "Pedidos da loja — Pediu Aqui",
    "Quadro de pedidos por estado, com detalhes e ações operacionais demonstrativas.",
  ),
  component: Orders,
});

const COLUMNS: { status: OrderStatus; title: string }[] = [
  { status: "novo", title: "Novos" },
  { status: "em_preparo", title: "Em preparo" },
  { status: "pronto", title: "Prontos" },
  { status: "aguardando_entregador", title: "Aguardando entregador" },
  { status: "saiu_para_entrega", title: "Saiu para entrega" },
  { status: "aguardando_retirada", title: "Aguardando retirada" },
];

const FILTERS: { id: OrderStatus | "todos"; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "novo", label: "Novos" },
  { id: "em_preparo", label: "Em preparo" },
  { id: "pronto", label: "Prontos" },
  { id: "saiu_para_entrega", label: "Em entrega" },
  { id: "aguardando_retirada", label: "Retirada" },
  { id: "concluido", label: "Concluídos" },
  { id: "cancelado", label: "Cancelados" },
];

function OrderCard({ order, onOpen }: { order: DemoOrder; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:bg-muted"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{order.code}</span>
        <span className="text-xs text-muted-foreground">{order.createdAt}</span>
      </div>
      <p className="mt-1 text-sm text-foreground">{order.customerName}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{fulfillmentLabel[order.fulfillment]}</Badge>
        <Badge variant={orderStatusTone[order.status]}>{orderStatusLabel[order.status]}</Badge>
        {order.late ? <Badge variant="danger">Atrasado</Badge> : null}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {order.items.reduce((sum, item) => sum + item.quantity, 0)} itens ·{" "}
          {elapsedLabel(order.placedMinutesAgo)}
        </span>
        <span className="text-sm font-semibold text-foreground">{formatBRL(order.total)}</span>
      </div>
    </button>
  );
}

function Orders() {
  const { orders, setOrderStatus, assignCourier, couriers } = useDemo();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "todos">("todos");

  const selected = orders.find((order) => order.id === selectedId) ?? null;
  const filtered = filter === "todos" ? orders : orders.filter((order) => order.status === filter);

  function act(label: string, action: () => void) {
    action();
    toast.success(label, { description: "Alteração realizada apenas na demonstração." });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <SectionTitle
        title="Pedidos"
        description="Colunas no computador, lista com filtros no celular. Toque em um pedido para ver os detalhes."
      />

      {/* Mobile e tablet: lista filtrada */}
      <div className="xl:hidden">
        <div className="rail -mx-4 gap-2 px-4">
          <ul className="flex gap-2 pb-2">
            {FILTERS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={filter === item.id}
                  onClick={() => setFilter(item.id)}
                  className={`min-h-11 whitespace-nowrap rounded-full border px-4 text-sm font-medium ${
                    filter === item.id
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-border bg-surface text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <ul className="mt-3 space-y-3">
          {filtered.map((order) => (
            <li key={order.id}>
              <OrderCard order={order} onOpen={() => setSelectedId(order.id)} />
            </li>
          ))}
        </ul>
      </div>

      {/* Desktop largo: colunas */}
      <div className="hidden gap-3 xl:grid xl:grid-cols-6">
        {COLUMNS.map((column) => {
          const columnOrders = orders.filter((order) => order.status === column.status);
          return (
            <section key={column.status} className="rounded-xl bg-surface-muted p-2">
              <h2 className="px-1 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {column.title} · {columnOrders.length}
              </h2>
              <div className="space-y-2">
                {columnOrders.map((order) => (
                  <OrderCard key={order.id} order={order} onOpen={() => setSelectedId(order.id)} />
                ))}
                {columnOrders.length === 0 ? (
                  <p className="px-1 py-3 text-xs text-muted-foreground">Nada por aqui agora.</p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <Sheet open={selected !== null} onOpenChange={(open) => (open ? null : setSelectedId(null))}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>Pedido {selected.code}</SheetTitle>
                <SheetDescription>
                  {selected.createdAt} · {fulfillmentLabel[selected.fulfillment]} ·{" "}
                  {elapsedLabel(selected.placedMinutesAgo)}
                </SheetDescription>
              </SheetHeader>

              <dl className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Cliente</dt>
                  <dd className="text-foreground">{selected.customerName}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Telefone</dt>
                  <dd className="text-foreground">{selected.customerPhone}</dd>
                </div>
                {selected.address ? (
                  <>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Endereço</dt>
                      <dd className="text-right text-foreground">
                        {selected.address.street}, {selected.address.number}
                        {selected.address.complement ? ` — ${selected.address.complement}` : ""}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Bairro</dt>
                      <dd className="text-foreground">
                        {neighborhoodById(selected.address.neighborhoodId)?.name}
                      </dd>
                    </div>
                    {selected.address.reference ? (
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Referência</dt>
                        <dd className="text-right text-foreground">{selected.address.reference}</dd>
                      </div>
                    ) : null}
                  </>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Pagamento</dt>
                  <dd className="text-foreground">
                    {paymentLabel[selected.paymentMethod]}
                    {selected.changeFor ? ` · troco para ${formatBRL(selected.changeFor)}` : ""}
                  </dd>
                </div>
              </dl>

              <section className="mt-4">
                <h3 className="text-sm font-semibold text-foreground">Itens</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {selected.items.map((item) => (
                    <li key={item.name} className="flex justify-between gap-4">
                      <span className="text-foreground">
                        {item.quantity} × {item.name}
                        {item.options.length > 0 ? (
                          <span className="block text-xs text-muted-foreground">
                            {item.options.join(", ")}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground">
                        {formatBRL(item.unitPrice * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              {selected.note ? (
                <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm italic text-foreground">
                  “{selected.note}”
                </p>
              ) : null}

              <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd>{formatBRL(selected.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Taxa</dt>
                  <dd>{formatBRL(selected.deliveryFee)}</dd>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <dt>Total</dt>
                  <dd>{formatBRL(selected.total)}</dd>
                </div>
              </dl>

              {selected.courierId ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Entregador: {couriers.find((courier) => courier.id === selected.courierId)?.name}
                </p>
              ) : null}

              <div className="mt-5 grid gap-2">
                {selected.status === "novo" ? (
                  <>
                    <Button
                      size="touch"
                      variant="brand"
                      onClick={() => act("Pedido aceito", () => setOrderStatus(selected.id, "em_preparo"))}
                    >
                      Aceitar e iniciar preparo
                    </Button>
                    <Button
                      size="touch"
                      variant="outline"
                      onClick={() =>
                        act("Pedido recusado", () =>
                          setOrderStatus(selected.id, "cancelado", "Item esgotado no estoque"),
                        )
                      }
                    >
                      Recusar com motivo
                    </Button>
                  </>
                ) : null}

                {selected.status === "em_preparo" ? (
                  <Button
                    size="touch"
                    variant="brand"
                    onClick={() => act("Pedido pronto", () => setOrderStatus(selected.id, "pronto"))}
                  >
                    Marcar como pronto
                  </Button>
                ) : null}

                {selected.status === "pronto" && selected.fulfillment === "entrega" ? (
                  <Button
                    size="touch"
                    variant="brand"
                    onClick={() =>
                      act("Pedido na fila de entrega", () =>
                        setOrderStatus(selected.id, "aguardando_entregador"),
                      )
                    }
                  >
                    Enviar para a fila de entrega
                  </Button>
                ) : null}

                {selected.status === "pronto" && selected.fulfillment === "retirada" ? (
                  <Button
                    size="touch"
                    variant="brand"
                    onClick={() =>
                      act("Pedido aguardando o cliente", () =>
                        setOrderStatus(selected.id, "aguardando_retirada"),
                      )
                    }
                  >
                    Avisar que está pronto para retirada
                  </Button>
                ) : null}

                {selected.status === "aguardando_entregador" ? (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium text-foreground">Atribuir entregador</p>
                    <div className="mt-2 grid gap-2">
                      {couriers
                        .filter((courier) => courier.online)
                        .map((courier) => (
                          <Button
                            key={courier.id}
                            variant="outline"
                            size="touch"
                            onClick={() =>
                              act(`Entrega atribuída a ${courier.name}`, () => {
                                assignCourier(selected.id, courier.id);
                                setOrderStatus(selected.id, "saiu_para_entrega");
                              })
                            }
                          >
                            {courier.name} · {courier.vehicle}
                          </Button>
                        ))}
                    </div>
                  </div>
                ) : null}

                {selected.status === "saiu_para_entrega" ? (
                  <>
                    <Button
                      size="touch"
                      variant="brand"
                      onClick={() => act("Entrega concluída", () => setOrderStatus(selected.id, "concluido"))}
                    >
                      Concluir entrega
                    </Button>
                    <Button
                      size="touch"
                      variant="outline"
                      onClick={() =>
                        act("Entregador liberado", () =>
                          setOrderStatus(selected.id, "aguardando_entregador"),
                        )
                      }
                    >
                      Trocar entregador
                    </Button>
                  </>
                ) : null}

                {selected.status === "aguardando_retirada" ? (
                  <Button
                    size="touch"
                    variant="brand"
                    onClick={() => act("Retirada concluída", () => setOrderStatus(selected.id, "concluido"))}
                  >
                    Concluir retirada
                  </Button>
                ) : null}

                {selected.status !== "concluido" && selected.status !== "cancelado" ? (
                  <Button
                    size="touch"
                    variant="ghost"
                    className="text-danger"
                    onClick={() =>
                      act("Pedido cancelado", () =>
                        setOrderStatus(selected.id, "cancelado", "Cancelado pela loja"),
                      )
                    }
                  >
                    Cancelar com motivo
                  </Button>
                ) : null}

                {selected.cancelReason ? (
                  <p className="text-sm text-muted-foreground">Motivo: {selected.cancelReason}</p>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
