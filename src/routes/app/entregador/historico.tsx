import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, History } from "lucide-react";
import { useState } from "react";

import { ErrorState } from "@/components/feedback/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMyCompletedDeliveries,
  useMyCourierDeliveryCounter,
} from "@/courier/reports/courier-counter.queries";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/app/entregador/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de entregas | Comandiva" },
      {
        name: "description",
        content: "Entregas concluídas do entregador, com contadores do dia, da semana e do mês.",
      },
      { property: "og:title", content: "Histórico de entregas | Comandiva" },
      { property: "og:description", content: "Consulte suas entregas concluídas e os contadores do período." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CourierHistory,
});

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CourierHistory() {
  const [page, setPage] = useState(0);
  const counter = useMyCourierDeliveryCounter();
  const history = useMyCompletedDeliveries(page, PAGE_SIZE);
  const items = history.data?.items ?? [];

  return (
    <main className="mx-auto max-w-lg space-y-5 p-4">
      <header>
        <p className="text-xs font-black uppercase tracking-[.14em] text-brand">Seu desempenho</p>
        <h1 className="mt-1 font-display text-2xl font-black tracking-tight">Histórico de entregas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acompanhe suas entregas concluídas e o volume dos períodos recentes.</p>
      </header>

      <section className="grid grid-cols-3 gap-2" aria-label="Resumo de entregas">
        {[
          { label: "Hoje", value: counter.data?.today },
          { label: "Semana", value: counter.data?.currentWeek },
          { label: "Mês", value: counter.data?.currentMonth },
        ].map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">{metric.label}</p>
              <p className="mt-1 font-display text-2xl font-black tabular-nums">{counter.isLoading ? "–" : metric.value ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-labelledby="completed-deliveries-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="completed-deliveries-title" className="font-display text-lg font-black">Entregas concluídas</h2>
            <p className="mt-1 text-xs text-muted-foreground">Mais recentes primeiro.</p>
          </div>
          <span className="text-xs text-muted-foreground">Página {page + 1}</span>
        </div>

        {history.isError ? (
          <ErrorState title="Não foi possível carregar o histórico" description="Verifique sua conexão e tente novamente." onRetry={() => void history.refetch()} />
        ) : history.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 w-full rounded-xl" />)}</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <History className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-bold">Nenhuma entrega concluída nesta página</p>
            <p className="mt-1 text-xs text-muted-foreground">Suas entregas finalizadas aparecerão aqui.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.deliveryId} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success-soft text-success"><CheckCircle2 className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">Pedido #{item.orderNumber}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Concluída em {formatDateTime(item.completedAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Button variant="outline" size="sm" disabled={page === 0 || history.isFetching} onClick={() => setPage((current) => Math.max(0, current - 1))}>Anterior</Button>
        <Button variant="outline" size="sm" disabled={items.length < PAGE_SIZE || history.isFetching} onClick={() => setPage((current) => current + 1)}>Próxima</Button>
      </div>
    </main>
  );
}
