import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { 
  useStoreDeliveryReportSummary, 
  useStoreDeliveryReportSeries, 
  useStoreDeliveryReportComparison, 
  useStoreCompletedDeliveries 
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
  component: StoreDeliveryReports,
});

function StoreDeliveryReports() {
  const [period, setPeriod] = useState<DeliveryReportPeriodType>("today");
  
  const summaryQuery = useStoreDeliveryReportSummary(period);
  const seriesQuery = useStoreDeliveryReportSeries(period);
  const comparisonQuery = useStoreDeliveryReportComparison(period);
  const historyQuery = useStoreCompletedDeliveries(period);

  const isLoading = summaryQuery.isLoading || seriesQuery.isLoading || comparisonQuery.isLoading || historyQuery.isLoading;
  const isError = summaryQuery.isError || seriesQuery.isError || comparisonQuery.isError || historyQuery.isError;

  return (
    <div className="store-report-global mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatório de Entregas</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhamento operacional de entregas concluídas.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as DeliveryReportPeriodType)}>
            <SelectTrigger className="w-[180px]">
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
            onClick={() => {
              summaryQuery.refetch();
              seriesQuery.refetch();
              comparisonQuery.refetch();
              historyQuery.refetch();
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>
            Não foi possível carregar os dados do relatório. Verifique suas permissões.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entregas Concluídas
            </CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold">{summaryQuery.data?.completedDeliveries ?? 0}</div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entregadores Ativos
            </CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold">{summaryQuery.data?.couriersWithCompletions ?? 0}</div>
            )}
          </CardContent>
        </Card>

        {summaryQuery.data?.timezone && (
          <div className="flex items-end pb-2">
             <span className="text-[10px] text-muted-foreground opacity-50 uppercase tracking-widest">
               Fuso: {summaryQuery.data.timezone}
             </span>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Entregas por Entregador</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entregador</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Concluídas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : (comparisonQuery.data?.rows.length ?? 0) > 0 ? (
                comparisonQuery.data?.rows.map((row) => (
                  <TableRow key={row.courierId}>
                    <TableCell className="font-medium">{row.courierName}</TableCell>
                    <TableCell>
                      <span className={`text-xs ${row.courierStatus === 'ativo' ? 'text-violet-300' : 'text-muted-foreground'}`}>
                        {row.courierStatus === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{row.completed_deliveries}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Nenhuma entrega concluída neste período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico Recente</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Entregador</TableHead>
                <TableHead className="text-right">Concluído em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3].map(i => (
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
                    <TableCell>{item.courierName}</TableCell>
                    <TableCell className="text-right text-sm">
                      {format(new Date(item.completedAt), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Nenhuma entrega encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
