import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { EmptyState, SectionTitle } from "@/components/demo/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/demo/state/useDemo";
import { demoHead } from "@/demo/utils/head";
import { deliveryStatusLabel } from "@/demo/utils/labels";

export const Route = createFileRoute("/preview/entregador/historico")({
  head: demoHead(
    "Histórico de entregas — Pediu Aqui",
    "Contador simples de entregas concluídas por período, sem valores nem repasses.",
  ),
  component: CourierHistory,
});

const PERIODS = [
  { id: "hoje", label: "Hoje" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
] as const;

function CourierHistory() {
  const { deliveries, sessionCourierId } = useDemo();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("hoje");

  const mine = deliveries.filter((delivery) => delivery.courierId === sessionCourierId);
  const list = mine.filter(
    (delivery) =>
      delivery.day === period && (delivery.status === "entregue" || delivery.status === "cancelada"),
  );
  const completed = list.filter((delivery) => delivery.status === "entregue").length;

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Histórico"
        description="Apenas a contagem de entregas concluídas. Sem valores, comissão ou repasse."
        action={
          <div className="flex gap-2" role="group" aria-label="Período">
            {PERIODS.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={period === item.id ? "brand" : "outline"}
                onClick={() => setPeriod(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        }
      />

      <div className="rounded-2xl border border-border bg-surface p-5 text-center">
        <p className="text-sm text-muted-foreground">Entregas concluídas</p>
        <p className="mt-1 text-5xl font-semibold text-foreground">{completed}</p>
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="Nada neste período"
          description="Quando você concluir entregas, elas aparecem aqui."
        />
      ) : (
        <ul className="space-y-3">
          {list.map((delivery) => (
            <li
              key={delivery.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-foreground">{delivery.orderCode}</p>
                <p className="text-sm text-muted-foreground">
                  Bairro {delivery.neighborhood}
                  {delivery.finishedAt ? ` · ${delivery.finishedAt}` : ""}
                </p>
                {delivery.incident ? (
                  <p className="text-sm text-warning">Problema: {delivery.incident}</p>
                ) : null}
              </div>
              <Badge variant={delivery.status === "entregue" ? "success" : "danger"}>
                {deliveryStatusLabel[delivery.status]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
