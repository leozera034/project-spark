import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock3,
  CreditCard,
  RefreshCw,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import { useAuth } from "@/auth/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PayoutSpeed, StoreFinancialSettlement, StorePayoutHistoryItem } from "@/lib/store-finance.functions";
import { useStoreFinanceActions, useStoreFinancialCenter } from "@/store/finance/store-finance.queries";

export const Route = createFileRoute("/app/loja/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro | Comandiva" },
      { name: "description", content: "Vendas, taxas, saldo e repasses da sua loja." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: StoreFinancialCenter,
});

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const SPEEDS: Array<{ key: PayoutSpeed; label: string; detail: string }> = [
  { key: "standard", label: "Padrão", detail: "Menor taxa" },
  { key: "daily", label: "Diário", detail: "Próximo ciclo diário" },
  { key: "fast", label: "Rápido", detail: "Liberação acelerada" },
  { key: "instant", label: "Imediato", detail: "Maior velocidade" },
];

function cents(value: number | null | undefined) {
  return money.format((Number(value) || 0) / 100);
}

function percentage(bps: number | null | undefined) {
  return `${((Number(bps) || 0) / 100).toFixed(2).replace(".", ",")}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : dateTime.format(parsed);
}

function StoreFinancialCenter() {
  const { authContext } = useAuth();
  const storeId = authContext?.store_ids?.[0] ?? null;
  const finance = useStoreFinancialCenter(storeId);
  const actions = useStoreFinanceActions();
  const [speed, setSpeed] = useState<PayoutSpeed>("standard");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const data = finance.data;
  const available = data?.balances.availableCents ?? 0;
  const payoutReady = Boolean(data?.connection.payoutsEnabled && data?.connection.transfersEnabled);
  const speedFeeBps = useMemo(() => {
    if (!data) return 0;
    if (speed === "daily") return data.fees.payoutDailyFeeBps;
    if (speed === "fast") return data.fees.payoutFastFeeBps;
    if (speed === "instant") return data.fees.payoutInstantFeeBps;
    return data.fees.payoutStandardFeeBps;
  }, [data, speed]);
  const payoutFee = Math.ceil((available * speedFeeBps) / 10000);
  const payoutNet = Math.max(available - payoutFee, 0);

  if (!storeId) {
    return <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">Nenhuma loja vinculada a esta conta.</div>;
  }

  const requestPayout = () => {
    if (!payoutReady || available <= 0 || actions.requestPayout.isPending) return;
    setSuccessMessage(null);
    actions.requestPayout.mutate(
      {
        storeId,
        speed,
        idempotencyKey: `merchant-payout-${crypto.randomUUID()}`,
      },
      {
        onSuccess: (result) => {
          setSuccessMessage(`Repasse solicitado. Valor líquido previsto: ${cents(result.net_payout_cents)}.`);
        },
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand">Recebimentos</p>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight">Financeiro</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Acompanhe o que vendeu, o que ainda será liberado, as taxas cobradas e cada repasse para sua loja.
          </p>
        </div>
        <Button variant="outline" onClick={() => void finance.refetch()} disabled={finance.isFetching}>
          <RefreshCw className={`size-4 ${finance.isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </header>

      {finance.isError ? (
        <Alert><AlertDescription>Não foi possível carregar o financeiro agora. Tente atualizar novamente.</AlertDescription></Alert>
      ) : null}

      {data && !payoutReady ? (
        <Alert>
          <AlertDescription>
            Sua conta de recebimento ainda não está totalmente habilitada. Pedidos podem continuar usando formas offline, mas repasses online permanecem bloqueados até a conta Stripe estar pronta para transferências e recebimentos.
          </AlertDescription>
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert><CheckCircle2 className="size-4" /><AlertDescription>{successMessage}</AlertDescription></Alert>
      ) : null}

      {actions.requestPayout.isError ? (
        <Alert><AlertDescription>O repasse não pôde ser solicitado. Atualize o saldo e tente novamente; nenhum novo repasse foi confirmado por esta tentativa.</AlertDescription></Alert>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo financeiro">
        <BalanceCard icon={WalletCards} label="Disponível" value={finance.isLoading ? "—" : cents(data?.balances.availableCents)} detail="Pode entrar em um repasse agora" />
        <BalanceCard icon={Clock3} label="A receber" value={finance.isLoading ? "—" : cents(data?.balances.pendingCents)} detail="Vendas ainda aguardando liberação" />
        <BalanceCard icon={ArrowDownToLine} label="Em repasse" value={finance.isLoading ? "—" : cents(data?.balances.reservedCents)} detail="Já reservado para transferência" />
        <BalanceCard icon={CheckCircle2} label="Repassado" value={finance.isLoading ? "—" : cents(data?.balances.transferredCents)} detail="Acumulado conciliado" />
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[1fr_.82fr]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ArrowDownToLine className="size-5 text-brand" /> Solicitar repasse</CardTitle>
            <p className="text-sm text-muted-foreground">Escolha a velocidade. A taxa e o líquido são calculados antes de você confirmar.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-2">
              {SPEEDS.map((option) => {
                const active = speed === option.key;
                const feeBps = data ? feeForSpeed(data.fees, option.key) : 0;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSpeed(option.key)}
                    className={`min-h-20 rounded-2xl border p-4 text-left transition ${active ? "border-brand/35 bg-brand-soft" : "border-border bg-surface-muted/35 hover:border-brand/20"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{option.label}</span>
                      <Badge variant={active ? "default" : "outline"}>{percentage(feeBps)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{option.detail}</p>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-border bg-surface-muted/35 p-4">
              <MoneyRow label="Saldo disponível" value={cents(available)} />
              <MoneyRow label={`Taxa do repasse · ${percentage(speedFeeBps)}`} value={`− ${cents(payoutFee)}`} muted />
              <div className="my-3 border-t border-border" />
              <MoneyRow label="Você recebe" value={cents(payoutNet)} strong />
            </div>

            <Button className="min-h-12 w-full sm:w-auto" onClick={requestPayout} disabled={!payoutReady || available <= 0 || actions.requestPayout.isPending}>
              <ArrowDownToLine className="size-4" />
              {actions.requestPayout.isPending ? "Solicitando…" : available <= 0 ? "Sem saldo disponível" : "Confirmar repasse"}
            </Button>

            {!data?.automaticPayoutAvailable ? (
              <p className="text-xs leading-5 text-muted-foreground">
                Repasse automático ainda não é oferecido nesta versão. Isso evita prometer uma automação financeira que não esteja ativa; cada repasse exige confirmação do lojista.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-brand" /> Taxas e recebimento</CardTitle>
            <p className="text-sm text-muted-foreground">Transparência sobre o que é descontado de cada venda online.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <FeeRow label="Taxa COMANDIVA por pedido online" value={percentage(data?.fees.orderApplicationFeeBps)} />
            <FeeRow label="Repasse padrão" value={percentage(data?.fees.payoutStandardFeeBps)} />
            <FeeRow label="Repasse diário" value={percentage(data?.fees.payoutDailyFeeBps)} />
            <FeeRow label="Repasse rápido" value={percentage(data?.fees.payoutFastFeeBps)} />
            <FeeRow label="Repasse imediato" value={percentage(data?.fees.payoutInstantFeeBps)} />
            <div className="mt-4 rounded-xl border border-border bg-surface-muted/35 p-3 text-xs leading-5 text-muted-foreground">
              A taxa da Stripe aparece por venda no histórico abaixo. O valor líquido de cada venda é calculado como bruto menos taxa Stripe e taxa COMANDIVA.
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2"><ReceiptText className="size-5 text-brand" /> Vendas e liquidação</CardTitle>
            <p className="text-sm text-muted-foreground">Últimas vendas online conciliadas com taxas e data de disponibilidade.</p>
          </CardHeader>
          <CardContent className="p-0">
            <SettlementList items={data?.settlements ?? []} loading={finance.isLoading} />
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2"><CreditCard className="size-5 text-brand" /> Histórico de repasses</CardTitle>
            <p className="text-sm text-muted-foreground">Solicitações, taxas, previsão e valor líquido.</p>
          </CardHeader>
          <CardContent className="p-0">
            <PayoutList items={data?.payouts ?? []} loading={finance.isLoading} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function feeForSpeed(fees: NonNullable<ReturnType<typeof useStoreFinancialCenter>["data"]>["fees"], speed: PayoutSpeed) {
  if (speed === "daily") return fees.payoutDailyFeeBps;
  if (speed === "fast") return fees.payoutFastFeeBps;
  if (speed === "instant") return fees.payoutInstantFeeBps;
  return fees.payoutStandardFeeBps;
}

function BalanceCard({ icon: Icon, label, value, detail }: { icon: typeof WalletCards; label: string; value: string; detail: string }) {
  return (
    <Card><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-2 break-words text-2xl font-black tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-5" /></span></div></CardContent></Card>
  );
}

function MoneyRow({ label, value, muted = false, strong = false }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return <div className="flex items-center justify-between gap-3 py-1.5"><span className={`text-sm ${muted ? "text-muted-foreground" : "text-foreground"}`}>{label}</span><span className={`${strong ? "text-lg font-black" : "text-sm font-bold"} tabular-nums`}>{value}</span></div>;
}

function FeeRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted/30 px-3 py-3"><span className="text-sm text-muted-foreground">{label}</span><span className="font-bold tabular-nums">{value}</span></div>;
}

function SettlementList({ items, loading }: { items: StoreFinancialSettlement[]; loading: boolean }) {
  if (loading) return <ListSkeleton />;
  if (items.length === 0) return <EmptyList text="Ainda não há vendas online conciliadas para mostrar." />;
  return <div className="divide-y divide-border">{items.map((item) => <div key={item.id} className="p-4"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold">{item.orderNumber ? `Pedido #${item.orderNumber}` : "Venda online"}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(item.createdAt)} · disponível {formatDate(item.availableAt)}</p></div><StatusBadge status={item.status} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><MiniMoney label="Bruto" value={cents(item.grossCents)} /><MiniMoney label="Stripe" value={`− ${cents(item.stripeFeeCents)}`} /><MiniMoney label="COMANDIVA" value={`− ${cents(item.platformFeeCents)}`} /><MiniMoney label="Líquido" value={cents(item.merchantPayableCents)} strong /></div></div>)}</div>;
}

function PayoutList({ items, loading }: { items: StorePayoutHistoryItem[]; loading: boolean }) {
  if (loading) return <ListSkeleton />;
  if (items.length === 0) return <EmptyList text="Nenhum repasse foi solicitado ainda." />;
  return <div className="divide-y divide-border">{items.map((item) => <div key={item.id} className="p-4"><div className="flex min-w-0 items-start justify-between gap-3"><div><p className="font-bold">{cents(item.netCents)} líquidos</p><p className="mt-1 text-xs text-muted-foreground">Solicitado {formatDate(item.requestedAt)} · previsão {formatDate(item.targetReleaseAt)}</p></div><StatusBadge status={item.status} /></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>Base {cents(item.grossCents)}</span><span>Taxa {cents(item.feeCents)} ({percentage(item.feeBps)})</span>{item.paidAt ? <span>Pago {formatDate(item.paidAt)}</span> : null}</div>{item.message ? <p className="mt-2 text-xs text-warning">{item.message}</p> : null}</div>)}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const label = normalized === "available" ? "Disponível" : normalized === "pending" ? "A receber" : normalized === "reserved" ? "Em repasse" : normalized === "transferred" || normalized === "paid" ? "Pago" : normalized === "requested" ? "Solicitado" : normalized === "processing" ? "Processando" : normalized === "failed" ? "Reprocessando" : normalized === "refunded" ? "Estornado" : status;
  const variant = normalized === "failed" ? "warning" : normalized === "paid" || normalized === "transferred" || normalized === "available" ? "success" : "outline";
  return <Badge variant={variant}>{label}</Badge>;
}

function MiniMoney({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="rounded-lg bg-surface-muted/45 px-2.5 py-2"><p className="text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">{label}</p><p className={`mt-0.5 tabular-nums ${strong ? "font-black text-foreground" : "font-semibold"}`}>{value}</p></div>;
}

function ListSkeleton() {
  return <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-surface-muted" />)}</div>;
}

function EmptyList({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
