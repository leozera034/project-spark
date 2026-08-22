import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, RefreshCw } from "lucide-react";

import { useAdminPaymentExceptionActions, useAdminPaymentExceptions } from "@/admin/finance/admin-payment-exceptions.queries";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminPaymentExceptionItem, PaymentExceptionStatus } from "@/lib/admin-payment-exceptions.functions";

export const Route = createFileRoute("/admin/excecoes-financeiras")({
  head: () => ({ meta: [{ title: "Exceções financeiras | Admin Comandiva" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: FinancialExceptionsPage,
});

type Filter = PaymentExceptionStatus | "all";
const filters: Array<{ key: Filter; label: string }> = [
  { key: "open", label: "Abertas" },
  { key: "in_review", label: "Em análise" },
  { key: "resolved", label: "Resolvidas" },
  { key: "all", label: "Todas" },
];
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function FinancialExceptionsPage() {
  const [filter, setFilter] = useState<Filter>("open");
  const query = useAdminPaymentExceptions(filter === "all" ? null : filter);
  const actions = useAdminPaymentExceptionActions();
  const items = query.data?.items ?? [];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-brand">Operação financeira</p>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight">Exceções financeiras</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Pagamentos que chegaram depois de um pedido já cancelado ou recusado. O encerramento é automático somente quando o webhook da Stripe confirmar o reembolso integral.
          </p>
        </div>
        <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={`size-4 ${query.isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </header>

      <Card className="border-warning/30 bg-warning-soft/25">
        <CardContent className="flex items-start gap-3 p-4 sm:p-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            <p className="font-bold">Não marque uma exceção como resolvida manualmente.</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Abra o pagamento na Stripe, processe o reembolso pelo procedimento financeiro autorizado e aguarde o evento <code>charge.refunded</code>. A COMANDIVA reconcilia pedido, ledger e esta fila pelo fato confirmado no provedor.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="rail flex gap-2 overflow-x-auto pb-1" aria-label="Filtros de exceção">
        {filters.map((item) => (
          <Button key={item.key} size="sm" className="shrink-0" variant={filter === item.key ? "default" : "outline"} onClick={() => setFilter(item.key)}>
            {item.label}
          </Button>
        ))}
      </div>

      {query.isError ? <ErrorState title="Não foi possível carregar as exceções financeiras" onRetry={() => void query.refetch()} /> : null}
      {query.isLoading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-52 animate-pulse rounded-2xl border border-border bg-surface-muted" />)}</div> : null}
      {!query.isLoading && !query.isError && items.length === 0 ? (
        <EmptyState title="Nenhuma exceção neste filtro" description="Quando um pagamento tardio exigir tratamento, ele aparecerá aqui automaticamente." />
      ) : null}

      <section className="space-y-3" aria-label="Fila de exceções">
        {items.map((item) => (
          <ExceptionCard key={item.id} item={item} reviewing={actions.review.isPending} onReview={() => actions.review.mutate({ taskId: item.id, note: "Análise operacional iniciada; aguardando confirmação de reembolso pela Stripe." })} />
        ))}
      </section>
    </main>
  );
}

function ExceptionCard({ item, reviewing, onReview }: { item: AdminPaymentExceptionItem; reviewing: boolean; onReview: () => void }) {
  const resolved = item.status === "resolved";
  const directCharge = item.metadata?.charge_pattern === "direct";
  const stripeUrl = `https://dashboard.stripe.com/payments/${encodeURIComponent(item.providerPaymentId)}`;
  return (
    <Card className={resolved ? "border-success/25" : item.status === "open" ? "border-warning/35" : ""}>
      <CardHeader className="pb-3">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{item.storeName} · Pedido #{item.orderNumber}</CardTitle>
              <StatusBadge status={item.status} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Detectada em {formatDate(item.detectedAt)}</p>
          </div>
          <p className="shrink-0 font-display text-2xl font-black tabular-nums">{money.format(item.amountCents / 100)}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Identifier label="PaymentIntent" value={item.providerPaymentId} />
          <Identifier label="Charge" value={item.providerChargeId ?? "Ainda não registrada"} />
        </div>

        {directCharge ? (
          <p className="rounded-xl border border-warning/25 bg-warning-soft/30 p-3 text-xs leading-5 text-muted-foreground">
            Este pagamento usa cobrança direta. Confirme a conta conectada correta antes de qualquer ação na Stripe.
          </p>
        ) : null}

        {item.resolutionNote ? <p className="rounded-xl border border-border bg-surface-muted/35 p-3 text-sm leading-6">{item.resolutionNote}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {resolved ? `Reembolso confirmado em ${formatDate(item.resolvedAt)}` : item.status === "in_review" ? `Análise iniciada em ${formatDate(item.reviewedAt)}` : "Aguardando início da análise."}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={stripeUrl} target="_blank" rel="noreferrer">Abrir pagamento na Stripe <ArrowUpRight className="size-3.5" /></a>
            </Button>
            {item.status === "open" ? <Button size="sm" disabled={reviewing} onClick={onReview}>{reviewing ? "Registrando…" : "Iniciar análise"}</Button> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: PaymentExceptionStatus }) {
  if (status === "resolved") return <Badge variant="success"><CheckCircle2 className="size-3" /> Resolvida</Badge>;
  if (status === "in_review") return <Badge variant="outline"><Clock3 className="size-3" /> Em análise</Badge>;
  return <Badge variant="warning"><AlertTriangle className="size-3" /> Aberta</Badge>;
}

function Identifier({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-border bg-surface-muted/30 p-3"><p className="text-[11px] font-black uppercase tracking-[.08em] text-muted-foreground">{label}</p><p className="mt-1 truncate font-mono text-xs" title={value}>{value}</p></div>;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
}
