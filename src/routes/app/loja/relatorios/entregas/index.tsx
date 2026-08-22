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
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, Banknote, CircleDollarSign, PackageCheck, RefreshCw, ShoppingBag, Truck, WalletCards, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/loja/relatorios/entregas/")({
  head: () => ({ meta: [{ title: "Relatórios | Comandiva" }, { name: "robots", content: "noindex,nofollow" }] }),
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
    <div className="mx-auto w-full max-w-7xl space-y-7 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand">Resultados</p>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight">Relatórios</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Vendas, pedidos, pagamentos e entregas em uma leitura rápida da operação.</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Select value={period} onValueChange={(value) => setPeriod(value as DeliveryReportPeriodType)}>
            <SelectTrigger className="min-w-0 flex-1 sm:w-[180px] sm:flex-none"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent><SelectItem value="today">Hoje</SelectItem><SelectItem value="week">Esta semana</SelectItem><SelectItem value="month">Este mês</SelectItem></SelectContent>
          </Select>
          <Button variant="outline" size="icon" aria-label="Atualizar relatório" onClick={refresh} disabled={isLoading}><RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} /></Button>
        </div>
      </header>

      {hasError ? <Alert variant="destructive"><AlertCircle className="size-4" /><AlertTitle>Não foi possível carregar todos os dados</AlertTitle><AlertDescription>Tente atualizar para completar o relatório.</AlertDescription></Alert> : null}

      <section className="space-y-3">
        <div><h2 className="font-display text-xl font-black">Resumo do período</h2><p className="mt-1 text-sm text-muted-foreground">Os principais números para acompanhar o desempenho da loja.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Faturamento concluído" value={business ? brl.format(Number(business.grossCompleted)) : "—"} loading={businessQuery.isLoading} icon={<CircleDollarSign className="size-4" />} hint="Pedidos entregues ou retirados" />
          <MetricCard title="Ticket médio" value={business ? brl.format(Number(business.averageTicket)) : "—"} loading={businessQuery.isLoading} icon={<WalletCards className="size-4" />} hint="Média dos pedidos concluídos" />
          <MetricCard title="Pedidos concluídos" value={business?.completedOrders ?? 0} loading={businessQuery.isLoading} icon={<PackageCheck className="size-4" />} hint={`${business?.totalOrders ?? 0} pedidos criados`} />
          <MetricCard title="Cancelados ou recusados" value={business?.cancelledOrders ?? 0} loading={businessQuery.isLoading} icon={<XCircle className="size-4" />} hint={`${business?.openOrders ?? 0} ainda em andamento`} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Recebido online</CardTitle></CardHeader><CardContent>{businessQuery.isLoading ? <Skeleton className="h-8 w-28" /> : <p className="font-display text-2xl font-black">{brl.format((business?.onlinePaidCents ?? 0) / 100)}</p>}<p className="mt-1 text-xs text-muted-foreground">Pagamentos online já confirmados.</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Taxas de entrega cobradas</CardTitle></CardHeader><CardContent>{businessQuery.isLoading ? <Skeleton className="h-8 w-28" /> : <p className="font-display text-2xl font-black">{brl.format(Number(business?.deliveryFees ?? 0))}</p>}<p className="mt-1 text-xs text-muted-foreground">Total das taxas nos pedidos concluídos.</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Modalidade</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3"><SmallStat label="Entrega" value={business?.deliveryOrders ?? 0} /><SmallStat label="Retirada" value={business?.pickupOrders ?? 0} /></CardContent></Card>
      </section>

      <section className="space-y-3">
        <div><h2 className="font-display text-xl font-black">Formas de pagamento</h2><p className="mt-1 text-sm text-muted-foreground">Como os clientes pagaram os pedidos concluídos.</p></div>
        <Card><CardContent className="divide-y p-0">
          {businessQuery.isLoading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="flex items-center justify-between p-4"><Skeleton className="h-5 w-32" /><Skeleton className="h-5 w-20" /></div>) : (business?.paymentMethods.length ?? 0) > 0 ? business?.paymentMethods.map((item) => (
            <div key={item.method} className="flex items-center justify-between gap-4 p-4 sm:px-5"><div><p className="font-semibold">{item.method}</p><p className="text-xs text-muted-foreground">{item.orders} pedido(s)</p></div><p className="font-display text-lg font-black">{brl.format(Number(item.amount))}</p></div>
          )) : <p className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido concluído no período.</p>}
        </CardContent></Card>
      </section>

      <section className="space-y-3">
        <div><h2 className="font-display text-xl font-black">Entregas</h2><p className="mt-1 text-sm text-muted-foreground">Volume concluído e desempenho da equipe de entrega.</p></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard title="Entregas concluídas" value={deliverySummaryQuery.data?.completedDeliveries ?? 0} loading={deliverySummaryQuery.isLoading} icon={<Truck className="size-4" />} hint="Finalizadas no período" />
          <MetricCard title="Entregadores com conclusão" value={deliverySummaryQuery.data?.couriersWithCompletions ?? 0} loading={deliverySummaryQuery.isLoading} icon={<Truck className="size-4" />} hint="Com ao menos uma entrega" />
          <MetricCard title="Pedidos de entrega" value={business?.deliveryOrders ?? 0} loading={businessQuery.isLoading} icon={<ShoppingBag className="size-4" />} hint="Pedidos concluídos com entrega" />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-lg">Entregas por entregador</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {comparisonQuery.isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />) : (comparisonQuery.data?.rows.length ?? 0) > 0 ? comparisonQuery.data?.rows.map((row) => (
                <div key={row.courierId} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate font-semibold">{row.courierName}</p><Badge variant={row.courierStatus === "ativo" ? "success" : "outline"} className="mt-1">{row.courierStatus === "ativo" ? "Ativo" : "Inativo"}</Badge></div><div className="text-right"><p className="font-display text-2xl font-black tabular-nums">{row.completed_deliveries}</p><p className="text-xs text-muted-foreground">concluída(s)</p></div></div>
              )) : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma entrega concluída neste período.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Entregas concluídas recentemente</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {historyQuery.isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />) : (historyQuery.data?.items.length ?? 0) > 0 ? historyQuery.data?.items.map((item) => (
                <div key={item.deliveryId} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><p className="font-semibold">Pedido #{item.orderNumber}</p><p className="text-xs text-muted-foreground">{item.courierName}</p></div><p className="whitespace-nowrap text-sm font-medium">{format(new Date(item.completedAt), "dd/MM HH:mm", { locale: ptBR })}</p></div>
              )) : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma entrega encontrada.</p>}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ title, value, loading, icon, hint }: { title: string; value: number | string; loading: boolean; icon: React.ReactNode; hint: string }) {
  return <Card><CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle><span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand/15 bg-brand-soft text-brand">{icon}</span></CardHeader><CardContent>{loading ? <Skeleton className="h-8 w-24" /> : <div className="break-words font-display text-2xl font-black tabular-nums">{value}</div>}{!loading ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}</CardContent></Card>;
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-surface-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-black tabular-nums">{value}</p></div>;
}
