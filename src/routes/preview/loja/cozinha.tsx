import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, SectionTitle } from "@/components/demo/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/demo/state/useDemo";
import { elapsedLabel } from "@/demo/utils/format";
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/preview/loja/cozinha")({
  head: demoHead(
    "Modo cozinha — Pediu Aqui",
    "Tela de produção legível a distância, sem dados de contato ou financeiros.",
  ),
  component: Kitchen,
});

function Kitchen() {
  const { orders, setOrderStatus } = useDemo();
  const [view, setView] = useState<"grade" | "lista">("grade");

  const queue = orders.filter(
    (order) => order.status === "novo" || order.status === "em_preparo" || order.status === "pronto",
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <SectionTitle
        title="Modo cozinha"
        description="Somente o que a produção precisa ver."
        action={
          <div className="flex gap-2" role="group" aria-label="Formato de visualização">
            <Button
              variant={view === "grade" ? "brand" : "outline"}
              size="sm"
              onClick={() => setView("grade")}
            >
              Grade
            </Button>
            <Button
              variant={view === "lista" ? "brand" : "outline"}
              size="sm"
              onClick={() => setView("lista")}
            >
              Lista
            </Button>
          </div>
        }
      />

      {queue.length === 0 ? (
        <EmptyState
          title="Nenhum pedido na fila"
          description="Assim que a loja aceitar um pedido, ele aparece aqui."
        />
      ) : (
        <ul
          className={
            view === "grade" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-4"
          }
        >
          {queue.map((order) => (
            <li key={order.id} className="rounded-2xl border-2 border-border bg-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-3xl font-bold tracking-tight text-foreground">{order.code}</span>
                <div className="text-right">
                  <p className="text-lg font-semibold text-foreground">{order.createdAt}</p>
                  <p className="text-base text-muted-foreground">
                    {elapsedLabel(order.placedMinutesAgo)}
                  </p>
                </div>
              </div>

              <Badge
                variant={order.status === "pronto" ? "success" : order.status === "em_preparo" ? "warning" : "info"}
                className="mt-3 text-sm"
              >
                {order.status === "novo" ? "Aguardando início" : order.status === "em_preparo" ? "Em preparo" : "Pronto"}
              </Badge>

              <ul className="mt-4 space-y-3">
                {order.items.map((item) => (
                  <li key={item.name} className="border-b border-border pb-3 last:border-0">
                    <p className="text-2xl font-semibold text-foreground">
                      {item.quantity} × {item.name}
                    </p>
                    {item.options.length > 0 ? (
                      <p className="text-lg text-muted-foreground">{item.options.join(", ")}</p>
                    ) : null}
                  </li>
                ))}
              </ul>

              {order.note ? (
                <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-lg font-medium text-warning">
                  {order.note}
                </p>
              ) : null}

              <div className="mt-4 grid gap-2">
                {order.status === "novo" ? (
                  <Button
                    size="touch"
                    variant="brand"
                    className="h-14 text-lg"
                    onClick={() => {
                      setOrderStatus(order.id, "em_preparo");
                      toast.success("Preparo iniciado", {
                        description: "Alteração realizada apenas na demonstração.",
                      });
                    }}
                  >
                    Iniciar preparo
                  </Button>
                ) : null}
                {order.status === "em_preparo" ? (
                  <Button
                    size="touch"
                    variant="brand"
                    className="h-14 text-lg"
                    onClick={() => {
                      setOrderStatus(order.id, "pronto");
                      toast.success("Pedido pronto", {
                        description: "Alteração realizada apenas na demonstração.",
                      });
                    }}
                  >
                    Marcar como pronto
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
