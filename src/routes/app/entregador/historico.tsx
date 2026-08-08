import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, History } from "lucide-react";
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
      { title: "Histórico de entregas | Pediu Aqui" },
      {
        name: "description",
        content: "Entregas concluídas do entregador, com contador do dia, da semana e do mês.",
      },
      { property: "og:title", content: "Histórico de entregas | Pediu Aqui" },
      {
        property: "og:description",
        content: "Consulte suas entregas concluídas e os contadores derivados do período.",
      },
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
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background px-4 py-3">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar">
          <Link to="/app/entregador">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-base font-bold">Histórico de entregas</h1>
      </header>

      <main className="space-y-4 p-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Hoje", value: counter.data?.today },
            { label: "Semana", value: counter.data?.currentWeek },
            { label: "Mês", value: counter.data?.currentMonth },
          ].map((metric) => (
            <Card key={metric.label}>
              <CardContent className="p-3 text-center">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">
                  {counter.isLoading ? "–" : (metric.value ?? 0)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {history.isError ? (
          <ErrorState
            title="Não foi possível carregar o histórico"
            description="Verifique sua conexão e tente novamente."
            onRetry={() => void history.refetch()}
          />
        ) : history.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <History className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Nenhuma entrega concluída neste período</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Somente entregas finalizadas aparecem aqui.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.deliveryId}
                className="flex items-center justify-between rounded-lg border bg-surface p-4"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-brand" />
                  <div>
                    <p className="text-sm font-bold">Pedido #{item.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      Concluída em {formatDateTime(item.completedAt)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0 || history.isFetching}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">Página {page + 1}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={items.length < PAGE_SIZE || history.isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </Button>
        </div>
      </main>
    </div>
  );
}
