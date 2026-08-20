import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  useStoreBusinessReportSummary,
  useStoreDeliveryReportSummary,
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
import { AlertCircle, Banknote, CircleDollarSign, PackageCheck, RefreshCw, ShoppingBag, Truck, WalletCards, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const Route = createFileRoute("/app/loja/relatorios/entregas/")({
  head: () => ({
    meta: [
      { title: "Relatórios | Comandiva" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: StoreReports,
});

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function StoreReports() {
  const [period, setPeriod] = useState<DeliveryReportPeriodType>("today");

  const businessQuery = useStoreBusinessReportSummary(period);
  const deliverySummaryQuery = useStoreDeliveryReportSummary(period);
  const comparisonQuery = useStoreDeliveryReportComparison(period);
  const historyQuery = useStoreCompletedDeliveries(period);

  const isLoading = businessQuery.isLoading || deliverySummaryQuery.isLoading || comparisonQuery.isLoading || historyQuery.isLoading;
  const hasError = businessQuery.isError || deliverySummaryQuery.isError || comparisonQuery.isError || historyQuery.isError;
  const business = businessQuery.data;

  const refresh = () => {
    void businessQuery.refetch();
    void deliverySummaryQuery.refetch();
    void comparisonQuery.refetch();
    void historyQuery.refetch();
  };

  return (
    <div className="store-report-global mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand">Gestão da loja</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">Relatórios</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Vendas, pedidos, pagamentos e entregas calculados diretamente da operação real da loja.
          </p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Select value={period} onValueChange={(value) => setPeriod(value as DeliveryReportPeriodType)}>
            <SelectTrigger className="min-w-0 flex-1 sm:w-[180px] sm:flex-none">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="shrink-0" aria-label="Atualizar relatório" onClick={refresh} disabled={isLoading}>
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {hasError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Alguns dados não puderam ser carregados</AlertTitle>
          <AlertDescription>
            Tente atualizar. O relatório não substitui dados ausentes por números inventados.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand">Comercial</p>
          <h2 className="mt-1 font-display text-xl font-bold">Vendas e pedidos</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Faturamento concluído" value={business ? brl.format(Number(business.grossCompleted)) : "—"} loading={businessQuery.isLoading} icon={<CircleDollarSign className="size-4" />} hint="Pedidos entregues ou retirados" />
          <MetricCard title="Ticket médio" value={business ? brl.format(Number(business.averageTicket)) : "—"} loading={businessQuery.isLoading} icon={<WalletCards className="size-4" />} hint="Média dos pedidos concluídos" />
          <MetricCard title="Pedidos concluídos" value={business?.completedOrders ?? 0} loading={businessQuery.isLoading} icon={<PackageCheck className="size-4" />} hint={`${business?.totalOrders ?? 0} pedidos criados no período`} />
          <MetricCard title="Cancelados/recusados" value={business?.cancelledOrders ?? 0} loading={businessQuery.isLoading} icon={<XCircle className="size-4" />} hint={`${business?.openOrders ?? 0} ainda em andamento`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Recebido online confirmado</CardTitle></CardHeader>
            <CardContent>
              {businessQuery.isLoading ? <Skeleton className="h-8 w-28" /> : <p className="font-display text-2xl font-black">{brl.format((business?.onlinePaidCents ?? 0) / 100)}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Somente pagamentos marcados como pagos no backend. Dinheiro/maquininha não são tratados como recebimento online.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Taxas de entrega cobradas</CardTitle></CardHeader>
            <CardContent>
              {businessQuery.isLoading ? <Skeleton className="h-8 w-28" /> : <p className="font-display text-2xl font-black">{brl.format(Number(business?.deliveryFees ?? 0))}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Somatório das taxas nos pedidos concluídos.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Modalidade dos pedidos</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <SmallStat label="Entrega" value={business?.deliveryOrders ?? 0} />
              <SmallStat label="Retirada" value={business?.pickupOrders ?? 0} />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand">Pagamentos</p>
          <h2 className="mt-1 font-display text-xl font-bold">Formas usadas em pedidos concluídos</h2>
        </div>
        <Card className="min-w-0 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[520px]">
                <TableHeader><TableRow><TableHead className="pl-6">Forma</TableHead><TableHead className="text-right">Pedidos</TableHead><TableHead className="pr-6 text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {businessQuery.isLoading ? [1,2,3].map((i) => <TableRow key={i}><TableCell className="pl-6"><Skeleton className="h-4 w-28" /></TableCell><TableCell><Skeleton className="ml-auto h-4 w-8" /></TableCell><TableCell className="pr-6"><Skeleton className="ml-auto h-4 w-20" /></TableCell></TableRow>) : (business?.paymentMethods.length ?? 0) > 0 ? business?.paymentMethods.map((item) => (
                    <TableRow key={item.method}><TableCell className="pl-6 font-medium">{item.method}</TableCell><TableCell className="text-right tabular-nums">{item.orders}</TableCell><TableCell className="pr-6 text-right font-semibold">{brl.format(Number(item.amount))}</TableCell></TableRow>
                  )) : <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">Nenhum pedido concluído no período.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand">Logística</p>
          <h2 className="mt-1 font-display text-xl font-bold">Entregas</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard title="Entregas concluídas" value={deliverySummaryQuery.data?.completedDeliveries ?? 0} loading={deliverySummaryQuery.isLoading} icon={<Truck className="size-4" />} hint="Somente entregas realmente finalizadas" />
          <MetricCard title="Entregadores com conclusão" value={deliverySummaryQuery.data?.couriersWithCompletions ?? 0} loading={deliverySummaryQuery.isLoading} icon={<Truck className="size-4" />} hint="Entregadores que concluíram ao menos uma" />
          <MetricCard title="Fuso do relatório" value={deliverySummaryQuery.data?.timezone ?? business?.timezone ?? "—"} loading={deliverySummaryQuery.isLoading && businessQuery.isLoading} icon={<ShoppingBag className="size-4" />} hint="Períodos respeitam o horário da loja" />
        </div>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader><CardTitle className="text-lg">Entregas por entregador</CardTitle></CardHeader>
          <CardContent className="p-0 sm:px-6 sm:pb-6">
            <div className="max-w-full overflow-x-auto">
              <Table className="min-w-[520px]">
                <TableHeader><TableRow><TableHead>Entregador</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Concluídas</TableHead></TableRow></TableHeader>
                <TableBody>
                  {comparisonQuery.isLoading ? [1,2,3].map((i) => <TableRow key={i}><TableCell><Skeleton className="h-4 w-32" /></TableCell><TableCell><Skeleton className="h-4 w-16" /></TableCell><TableCell><Skeleton className="ml-auto h-4 w-8" /></TableCell></TableRow>) : (comparisonQuery.data?.rows.length ?? 0) > 0 ? comparisonQuery.data?.rows.map((row) => (
                    <TableRow key={row.courierId}><TableCell className="max-w-[240px] truncate font-medium">{row.courierName}</TableCell><TableCell><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.courierStatus === "ativo" ? "bg-success-soft text-success" : "bg-surface-muted text-muted-foreground"}`}>{row.courierStatus === "ativo" ? "Ativo" : "Inativo"}</span></TableCell><TableCell className="text-right font-semibold tabular-nums">{row.completed_deliveries}</TableCell></TableRow>
                  )) : <TableRow><TableCell colSpan={3} className="h-28 text-center text-muted-foreground">Nenhuma entrega concluída neste período.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader><CardTitle className="text-lg">Histórico de entregas concluídas</CardTitle></CardHeader>
          <CardContent className="p-0 sm:px-6 sm:pb-6">
            <div className="max-w-full overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Entregador</TableHead><TableHead className="text-right">Concluído em</TableHead></TableRow></TableHeader>
                <TableBody>
                  {historyQuery.isLoading ? [1,2,3].map((i) => <TableRow key={i}><TableCell><Skeleton className="h-4 w-12" /></TableCell><TableCell><Skeleton className="h-4 w-32" /></TableCell><TableCell><Skeleton className="ml-auto h-4 w-24" /></TableCell></TableRow>) : (historyQuery.data?.items.length ?? 0) > 0 ? historyQuery.data?.items.map((item) => (
                    <TableRow key={item.deliveryId}><TableCell className="font-mono text-sm">#{item.orderNumber}</TableCell><TableCell className="max-w-[260px] truncate">{item.courierName}</TableCell><TableCell className="whitespace-nowrap text-right text-sm">{format(new Date(item.completedAt), "dd/MM HH:mm", { locale: ptBR })}</TableCell></TableRow>
                  )) : <TableRow><TableCell colSpan={3} className="h-28 text-center text-muted-foreground">Nenhuma entrega encontrada.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({ title, value, loading, icon, hint }: { title: string; value: number | string; loading: boolean; icon: React.ReactNode; hint: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand/15 bg-brand-soft text-brand-soft-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-24" /> : <div className="break-words text-2xl font-bold tabular-nums">{value}</div>}
        {!loading ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-surface-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-black tabular-nums">{value}</p></div>;
}
