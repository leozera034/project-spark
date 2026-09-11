import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, CreditCard, FileText, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PlanCatalog, type BillingInterval } from "@/components/billing/PlanCatalog";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listPublicPlans } from "@/lib/marketing.functions";
import {
  cancelStorePlanAtPeriodEnd,
  changeStorePlan,
  createStoreBillingPortal,
  createStorePlanCheckout,
  getMyStorePlanBillingDetail,
  resumeStorePlan,
  type StorePlanBillingDetail,
} from "@/lib/store-plan-billing.functions";
import type { StoreBillingAccess, StoreBillingStage } from "@/lib/store-billing.functions";
import { useStoreBillingAccess } from "@/store/billing/store-billing.queries";
import { useStoreScope } from "@/store-scope/StoreScopeProvider";

export const Route = createFileRoute("/app/loja/plano")({
  loader: () => listPublicPlans(),
  head: () => ({ meta: [{ title: "Conta e plano | Comandiva" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: StorePlanPage,
});

type StageCopy = { label: string; description: string; variant: "success" | "warning" | "danger" | "outline" | "brand" };
const STAGE_COPY: Record<StoreBillingStage, StageCopy> = {
  billing_unconfigured: { label: "Configuração pendente", description: "A configuração comercial desta loja ainda precisa ser concluída.", variant: "warning" },
  complimentary: { label: "Cortesia ativa", description: "Sua loja está usando uma cortesia concedida pela Comandiva.", variant: "brand" },
  free: { label: "Plano gratuito", description: "A loja está no plano gratuito e não possui mensalidade recorrente.", variant: "outline" },
  trial: { label: "Período de teste", description: "Seu período de teste está ativo até a data indicada abaixo.", variant: "brand" },
  full: { label: "Assinatura ativa", description: "A assinatura está regular e os recursos do plano permanecem liberados.", variant: "success" },
  notice: { label: "Pagamento pendente", description: "Existe uma cobrança pendente. Atualize a forma de pagamento para evitar restrições.", variant: "warning" },
  restricted_growth: { label: "Recursos limitados", description: "Alguns recursos estão pausados até a regularização da cobrança.", variant: "warning" },
  restricted_writes: { label: "Alterações limitadas", description: "Algumas alterações administrativas estão pausadas enquanto a cobrança permanece pendente.", variant: "warning" },
  suspended_orders: { label: "Novos pedidos pausados", description: "Novos pedidos estão temporariamente suspensos; seus dados continuam preservados.", variant: "danger" },
  trial_expired: { label: "Teste encerrado", description: "O período de teste terminou e a conta está sendo ajustada para o plano disponível.", variant: "outline" },
};

type PurchaseIntent = { planCode: "essencial" | "profissional" | "avancado"; interval: BillingInterval } | null;

function queryIntent(): { purchase: PurchaseIntent; payment: string | null } {
  if (typeof window === "undefined") return { purchase: null, payment: null };
  const query = new URLSearchParams(window.location.search);
  const raw = query.get("purchase");
  const interval: BillingInterval = query.get("interval") === "annual" ? "annual" : "monthly";
  const purchase = raw && ["essencial", "profissional", "avancado"].includes(raw)
    ? { planCode: raw as "essencial" | "profissional" | "avancado", interval }
    : null;
  return { purchase, payment: query.get("stripe") };
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

function formatMoney(cents: number | null | undefined, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL" }).format((cents ?? 0) / 100);
}

function paymentStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "active": return "Ativo";
    case "trialing": return "Em teste";
    case "past_due": return "Pagamento em atraso";
    case "unpaid": return "Não pago";
    case "incomplete": return "Pagamento pendente";
    case "incomplete_expired": return "Pagamento expirado";
    case "canceled": return "Cancelado";
    case "paused": return "Pausado";
    default: return status ? "Em processamento" : "Sem cobrança recorrente";
  }
}

function invoiceStatusLabel(status: string | null | undefined) {
  if (status === "paid") return "Pago";
  if (status === "open") return "Em aberto";
  if (status === "void") return "Cancelado";
  if (status === "uncollectible") return "Não recebido";
  if (status === "draft") return "Em preparação";
  return status ? "Processando" : "—";
}

function idempotency(storeId: string, planCode: string, interval: string) {
  const key = `comandiva:plan-checkout:${storeId}:${planCode}:${interval}`;
  if (typeof sessionStorage === "undefined") return `${key}:${crypto.randomUUID()}`;
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
  }
  return `${key}:${value}`.slice(0, 160);
}

function clearIntentUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("purchase");
  url.searchParams.delete("interval");
  url.searchParams.delete("stripe");
  url.searchParams.delete("session_id");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function planName(access: StoreBillingAccess, plans: Awaited<ReturnType<typeof listPublicPlans>>) {
  if (!access.plan_code) return "Não configurado";
  return plans.find((plan) => plan.code === access.plan_code)?.name ?? access.plan_code;
}

function StorePlanPage() {
  const plans = Route.useLoaderData();
  const { storeId, selectedStore } = useStoreScope();
  const billingQuery = useStoreBillingAccess(storeId);

  const getDetail = useServerFn(getMyStorePlanBillingDetail);
  const createCheckout = useServerFn(createStorePlanCheckout);
  const createPortal = useServerFn(createStoreBillingPortal);
  const changePlan = useServerFn(changeStorePlan);
  const cancelPlan = useServerFn(cancelStorePlanAtPeriodEnd);
  const resumePlan = useServerFn(resumeStorePlan);

  const [detail, setDetail] = useState<StorePlanBillingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const query = useMemo(() => queryIntent(), []);
  const handledIntent = useRef(false);

  const loadDetail = useCallback(async () => {
    if (!storeId) return null;
    setDetailLoading(true);
    try {
      const value = await getDetail({ data: { storeId } });
      setDetail(value);
      setDetailError(null);
      return value;
    } catch {
      setDetailError("Não foi possível carregar os detalhes da assinatura.");
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, [getDetail, storeId]);

  useEffect(() => { queueMicrotask(() => void loadDetail()); }, [loadDetail]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadDetail(), billingQuery.refetch()]);
  }, [loadDetail, billingQuery]);

  const startCheckout = useCallback(async (planCode: "essencial" | "profissional" | "avancado", interval: BillingInterval) => {
    if (!storeId) return;
    setBusyPlan(planCode);
    setNotice(null);
    try {
      const result = await createCheckout({ data: { storeId, planCode, billingInterval: interval, idempotencyKey: idempotency(storeId, planCode, interval) } });
      window.location.assign(result.checkoutUrl);
    } catch {
      setNotice("Não foi possível abrir o pagamento deste plano agora. Tente novamente.");
      setBusyPlan(null);
    }
  }, [createCheckout, storeId]);

  const selectPlan = useCallback(async (planCode: string, interval: BillingInterval) => {
    if (!storeId || !detail) return;
    setNotice(null);

    if (planCode === "gratis") {
      if (detail.subscription.provider_status && !["canceled", "incomplete_expired"].includes(detail.subscription.provider_status)) {
        setActionBusy("cancel");
        try {
          const result = await cancelPlan({ data: { storeId } });
          setNotice(`Cancelamento agendado. Seu plano continua ativo${result.effectiveAt ? ` até ${formatDate(result.effectiveAt)}` : " até o fim do período atual"}.`);
          await refreshAll();
        } catch {
          setNotice("Não foi possível agendar o cancelamento agora.");
        } finally {
          setActionBusy(null);
        }
      }
      return;
    }

    const paid = planCode as "essencial" | "profissional" | "avancado";
    if (!detail.subscription.provider_status || ["canceled", "incomplete_expired"].includes(detail.subscription.provider_status) || detail.plan.code === "gratis") {
      await startCheckout(paid, interval);
      return;
    }

    setBusyPlan(paid);
    try {
      const result = await changePlan({ data: { storeId, planCode: paid, billingInterval: interval } });
      setNotice(result.action === "downgrade"
        ? `Mudança agendada para ${formatDate(result.effectiveAt) ?? "o fim do período atual"}.`
        : "Upgrade solicitado. Os novos recursos serão liberados após a confirmação do pagamento.");
      await refreshAll();
    } catch {
      setNotice("Não foi possível alterar o plano agora.");
    } finally {
      setBusyPlan(null);
    }
  }, [storeId, detail, cancelPlan, changePlan, refreshAll, startCheckout]);

  useEffect(() => {
    if (!storeId || !detail || handledIntent.current) return;
    handledIntent.current = true;

    if (query.payment === "cancelled") {
      queueMicrotask(() => setNotice("Pagamento cancelado. Nenhum plano pago foi ativado."));
      clearIntentUrl();
      return;
    }

    if (query.payment === "success") {
      queueMicrotask(() => setConfirming(true));
      let stopped = false;
      let tries = 0;
      const run = async () => {
        while (!stopped && tries < 12) {
          tries += 1;
          const value = await loadDetail();
          const status = value?.subscription.provider_status;
          if (status && ["active", "trialing", "past_due", "unpaid"].includes(status)) {
            setConfirming(false);
            setNotice(status === "active" || status === "trialing" ? "Assinatura confirmada." : "A assinatura foi localizada, mas existe uma pendência de cobrança.");
            clearIntentUrl();
            await billingQuery.refetch();
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }
        if (!stopped) {
          setConfirming(false);
          setNotice("O pagamento foi recebido e ainda está sendo confirmado. Esta tela será atualizada assim que a confirmação terminar.");
        }
      };
      void run();
      return () => { stopped = true; };
    }

    if (query.purchase) {
      const same = detail.plan.code === query.purchase.planCode && ["active", "trialing"].includes(detail.subscription.provider_status ?? "");
      if (same) {
        queueMicrotask(() => setNotice("Esse plano já está ativo nesta loja."));
        clearIntentUrl();
        return;
      }
      void selectPlan(query.purchase.planCode, query.purchase.interval);
    }
  }, [storeId, detail, query.payment, query.purchase, loadDetail, billingQuery, selectPlan]);

  if (!storeId) return <div className="mx-auto max-w-4xl px-4 py-8"><ErrorState kind="unexpected" title="Escolha uma loja" description="Selecione a loja para consultar o plano e as cobranças." /></div>;
  if (billingQuery.isLoading && !detail) return <div className="mx-auto max-w-7xl px-4 py-8"><div className="h-52 animate-pulse rounded-[28px] border bg-muted/55" /></div>;
  if (billingQuery.error || !billingQuery.data) return <div className="mx-auto max-w-4xl px-4 py-8"><ErrorState kind="network" title="Não foi possível consultar sua assinatura" description="Tente novamente em instantes." onRetry={() => void refreshAll()} /></div>;

  const access = billingQuery.data;
  const stage = STAGE_COPY[access.stage];
  const price = detail?.price;
  const subscription = detail?.subscription;
  const nextDate = formatDate(subscription?.current_period_end ?? subscription?.current_period_end_at);
  const trialEnd = formatDate(subscription?.trial_ends_at);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand">Conta e plano</p>
            {selectedStore ? <Badge variant="outline">{selectedStore.name}</Badge> : null}
          </div>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight">{planName(access, plans)}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Veja sua assinatura da Comandiva, próximas cobranças, histórico e opções de plano.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={stage.variant}>{stage.label}</Badge>
          <Button variant="outline" disabled={actionBusy === "portal" || !detail?.subscription.provider_status} onClick={async () => {
            setActionBusy("portal");
            try {
              const result = await createPortal({ data: { storeId } });
              window.location.assign(result.url);
            } catch {
              setNotice("Não foi possível abrir a gestão da assinatura agora.");
            } finally {
              setActionBusy(null);
            }
          }}><CreditCard className="size-4" /> Gerenciar assinatura</Button>
        </div>
      </header>

      {confirming ? <div className="flex items-center gap-3 rounded-2xl border border-brand/20 bg-brand-soft p-4 text-sm font-semibold"><RefreshCw className="size-5 animate-spin" /> Confirmando sua assinatura…</div> : null}
      {notice ? <div className="rounded-2xl border border-border bg-card p-4 text-sm font-semibold">{notice}</div> : null}
      {detailError ? <div className="rounded-2xl border border-danger/20 bg-danger-soft p-4 text-sm text-danger">{detailError}</div> : null}

      <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader><div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-xl bg-brand-soft"><ShieldCheck className="size-5 text-brand" /></span><div><CardTitle>{stage.label}</CardTitle><CardDescription className="mt-1">{stage.description}</CardDescription></div></div></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Info label="Valor" value={price ? price.amount_cents === 0 ? "R$ 0/mês" : `${formatMoney(price.amount_cents, price.currency)}/${price.billing_interval === "annual" ? "ano" : "mês"}` : "Sem cobrança"} />
              <Info label="Cobrança" value={paymentStatusLabel(subscription?.provider_status)} />
              <Info label="Próxima data" value={trialEnd ? `Teste até ${trialEnd}` : nextDate ?? "—"} />
              <Info label="Renovação" value={subscription?.cancel_at_period_end ? "Cancelamento agendado" : subscription?.provider_status ? "Automática" : "—"} />
            </div>

            {detail?.pending_change ? <div className="mt-4 rounded-xl border border-brand/20 bg-brand-soft p-4 text-sm"><strong>Mudança agendada:</strong> {detail.pending_change.plan_name}{detail.pending_change.effective_at ? ` em ${formatDate(detail.pending_change.effective_at)}` : " no fim do período atual"}.</div> : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {subscription?.cancel_at_period_end ? (
                <Button disabled={actionBusy === "resume"} onClick={async () => {
                  setActionBusy("resume");
                  try { await resumePlan({ data: { storeId } }); setNotice("Renovação reativada."); await refreshAll(); }
                  catch { setNotice("Não foi possível reativar a renovação agora."); }
                  finally { setActionBusy(null); }
                }}>Manter assinatura</Button>
              ) : subscription?.provider_status && !["canceled", "incomplete_expired"].includes(subscription.provider_status) && detail?.plan.code !== "gratis" ? (
                <Button variant="outline" disabled={actionBusy === "cancel"} onClick={async () => {
                  setActionBusy("cancel");
                  try { const result = await cancelPlan({ data: { storeId } }); setNotice(`Cancelamento agendado${result.effectiveAt ? ` para ${formatDate(result.effectiveAt)}` : " para o fim do período atual"}.`); await refreshAll(); }
                  catch { setNotice("Não foi possível agendar o cancelamento agora."); }
                  finally { setActionBusy(null); }
                }}>Cancelar renovação</Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="size-5 text-brand" /> Último pagamento</CardTitle><CardDescription>Resumo da cobrança mais recente da assinatura.</CardDescription></CardHeader>
          <CardContent>
            {subscription?.last_paid ? <div><p className="font-display text-3xl font-black">{formatMoney(subscription.last_paid.amount_cents, subscription.last_paid.currency)}</p><p className="mt-1 text-sm text-muted-foreground">{formatDate(subscription.last_paid.paid_at) ?? "Data não disponível"}</p></div> : <p className="text-sm text-muted-foreground">Nenhum pagamento confirmado ainda.</p>}
            {subscription?.last_payment_failure_at ? <p className="mt-4 rounded-xl border border-warning/25 bg-warning-soft p-3 text-sm">Houve uma falha recente de cobrança. Use “Gerenciar assinatura” para atualizar a forma de pagamento.</p> : null}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-5 text-brand" /> Histórico de cobranças</CardTitle><CardDescription>Mensalidades e cobranças da assinatura da Comandiva.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {detail?.invoices?.length ? detail.invoices.map((invoice) => (
            <div key={invoice.id} className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-semibold">{formatMoney(invoice.amount_cents, invoice.currency)}</p><p className="text-xs text-muted-foreground">Criada em {formatDate(invoice.created_at) ?? "—"}{invoice.due_at ? ` · vence ${formatDate(invoice.due_at)}` : ""}</p></div>
              <Badge variant={invoice.provider_status === "paid" || invoice.status === "paid" ? "success" : "outline"}>{invoiceStatusLabel(invoice.provider_status ?? invoice.status)}</Badge>
            </div>
          )) : <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma cobrança registrada.</p>}
        </CardContent>
      </Card>

      <section aria-labelledby="compare-plans-title">
        <div className="mx-auto max-w-3xl text-center"><p className="text-xs font-black uppercase tracking-[.18em] text-brand">Alterar plano</p><h2 id="compare-plans-title" className="mt-2 font-display text-3xl font-black tracking-[-.04em]">Planos Comandiva</h2><p className="mt-2 text-sm text-muted-foreground">Upgrades são liberados após a confirmação do pagamento. Downgrades entram no fim do período atual.</p></div>
        <PlanCatalog plans={plans} context="panel" currentPlanCode={access.plan_code} busyPlanCode={busyPlan} onSelectPlan={(code, interval) => void selectPlan(code, interval)} className="mt-7" />
      </section>

      {detailLoading ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw className="size-3 animate-spin" /> Atualizando dados da conta…</p> : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-surface-muted/35 p-3"><p className="text-[11px] font-bold uppercase tracking-[.1em] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}