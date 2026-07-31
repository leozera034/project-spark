import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { SectionTitle } from "@/components/demo/States";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/demo/state/useDemo";
import { formatBRL } from "@/demo/utils/format";
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/preview/loja/relatorios")({
  head: demoHead(
    "Relatórios da loja — Pediu Aqui",
    "Resumo operacional simples: pedidos, ticket médio, itens mais vendidos e entregas concluídas.",
  ),
  component: Reports,
});

const PERIODS = [
  { id: "hoje", label: "Hoje" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
] as const;

type Period = (typeof PERIODS)[number]["id"];

const SUMMARY: Record<Period, { orders: number; revenue: number; cancelled: number }> = {
  hoje: { orders: 38, revenue: 2145.6, cancelled: 2 },
  semana: { orders: 214, revenue: 12890.4, cancelled: 9 },
  mes: { orders: 892, revenue: 54210.75, cancelled: 31 },
};

const TOP_ITEMS = [
  { name: "Pão francês", quantity: 412 },
  { name: "Bolo de cenoura com cobertura", quantity: 168 },
  { name: "Café coado 500 ml", quantity: 151 },
  { name: "Queijo minas frescal", quantity: 97 },
  { name: "Suco de laranja 1 L", quantity: 88 },
];

function Reports() {
  const { deliveries } = useDemo();
  const [period, setPeriod] = useState<Period>("hoje");
  const data = SUMMARY[period];
  const average = data.revenue / data.orders;
  const completedDeliveries = deliveries.filter(
    (delivery) => delivery.status === "entregue" && delivery.day === period,
  ).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <SectionTitle
        title="Relatórios"
        description="Números simples para decidir o dia. Sem gráficos difíceis de ler no celular."
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Pedidos", value: String(data.orders) },
          { label: "Faturamento", value: formatBRL(data.revenue) },
          { label: "Ticket médio", value: formatBRL(average) },
          { label: "Cancelados", value: String(data.cancelled) },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">Itens mais vendidos</h2>
          <ul className="mt-3 space-y-2">
            {TOP_ITEMS.map((item) => (
              <li key={item.name} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm text-foreground">{item.name}</span>
                <span
                  aria-hidden="true"
                  className="h-2 rounded-full bg-brand"
                  style={{ width: `${(item.quantity / TOP_ITEMS[0].quantity) * 60}%` }}
                />
                <span className="ml-auto text-sm text-muted-foreground">{item.quantity}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">Entregas concluídas</h2>
          <p className="mt-2 text-4xl font-semibold text-foreground">{completedDeliveries}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Contagem simples do período, sem valores por entrega e sem cálculo de repasse.
          </p>
          <h3 className="mt-4 text-sm font-semibold text-foreground">Horários de pico</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>11h às 13h · maior volume de pedidos</li>
            <li>18h às 20h · segundo pico do dia</li>
            <li>Domingo pela manhã · maior número de retiradas</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
