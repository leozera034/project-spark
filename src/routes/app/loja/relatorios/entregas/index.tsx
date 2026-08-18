import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  useStoreDeliveryReportSummary,
  useStoreDeliveryReportSeries,
  useStoreDeliveryReportComparison,
  useStoreCompletedDeliveries,
} from "@/store/reports/deliveries/delivery-report.queries";
import { DeliveryReportPeriodType } from "@/store/reports/deliveries/delivery-report.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, RefreshCw, Truck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const Route = createFileRoute("/app/loja/relatorios/entregas/")({
  head: () => ({
    meta: [
      { title: "Relatório de entregas | Comandiva" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: StoreDeliveryReports,
});

function StoreDeliveryReports() {
  const [period, setPeriod] = useState<DeliveryReportPeriodType>("today");

  const summaryQuery = useStoreDeliveryReportSummary(period);
  const seriesQuery = useStoreDeliveryReportSeries(period);
  const comparisonQuery = useStoreDeliveryReportComparison(period);
  const historyQuery = useStoreCompletedDeliveries(period);

  const isLoading =
    summaryQuery.isLoading ||
    seriesQuery.isLoading ||
    comparisonQuery.isLoading ||
    historyQuery.isLoading;
  const isError =
    summaryQuery.isError ||
    seriesQuery.isError ||
    comparisonQuery.isError ||
    historyQuery.isError;

  return (
    <div className="store-report-global mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand">Operação</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Relatório de entregas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhamento operacional de entregas concluídas.
          </p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Select value={period} onValueChange={(v) => setPeriod(v as DeliveryReportPeriodType)}>
            <SelectTrigger className="min-w-0 flex-1 sm:w-[180px] sm:flex-none">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            aria-label="Atualizar relatório"
            onClick={() => {
              void summaryQuery.refetch();
              void seriesQuery.refetch();
              void comparisonQuery.refetch();
              void historyQuery.refetch();
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>
            Não foi possível carregar os dados do relatório. Verifique suas permissões.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Entregas concluídas"
          value={summaryQuery.data?.completedDeliveries ?? 0}
          loading={isLoading}
        />
        <MetricCard
          title="Entregadores ativos"
          value={summaryQuery.data?.couriersWithCompletions ?? 0}
          loading={isLoading}
        />

        {summaryQuery.data?.timezone ? (
          <Card className="sm:col-span-2 lg:col-span-1">
            <CardContent className="flex h-full min-h-28 flex-col justify-center p-5">
              <p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Fuso do relatório</p>
              <p className="mt-2 break-words text-sm font-semibold text-foreground">
                {summaryQuery.data.timezone}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Entregas por entregador</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:px-6 sm:pb-6">
          <div className="max-w-full overflow-x-auto">
            <Table className="min-w-[520px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Entregador</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Concluídas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [1, 2, 3].map((i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : (comparisonQuery.data?.rows.length ?? 0) > 0 ? (
                  comparisonQuery.data?.rows.map((row) => (
                    <TableRow key={row.courierId}>
                      <TableCell className="max-w-[240px] truncate font-medium">{row.courierName}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            row.courierStatus === "ativo"
                              ? "bg-success-soft text-success"
                              : "bg-surface-muted text-muted-foreground"
                          }`}
                        >
                          {row.courierStatus === "ativo" ? "Ativo" : "Inativo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {row.completed_deliveries}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-28 text-center text-muted-foreground">
                      Nenhuma entrega concluída neste período.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Histórico recente</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:px-6 sm:pb-6">
          <div className="max-w-full overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Entregador</TableHead>
                  <TableHead className="text-right">Concluído em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [1, 2, 3].map((i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : (historyQuery.data?.items.length ?? 0) > 0 ? (
                  historyQuery.data?.items.map((item) => (
                    <TableRow key={item.deliveryId}>
                      <TableCell className="font-mono text-sm">#{item.orderNumber}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{item.courierName}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm">
                        {format(new Date(item.completedAt), "dd/MM HH:mm", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-28 text-center text-muted-foreground">
                      Nenhuma entrega encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ title, value, loading }: { title: string; value: number; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand/15 bg-brand-soft text-brand-soft-foreground">
          <Truck className="size-4" />
        </span>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold tabular-nums">{value}</div>}
      </CardContent>
    </Card>
  );
}