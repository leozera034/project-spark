import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CreditCard, ShieldCheck, Sparkles } from "lucide-react";

import { useAuth } from "@/auth/useAuth";
import { PlanCatalog } from "@/components/billing/PlanCatalog";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Badge } from "@/components/ui/badge";
import { listPublicPlans } from "@/lib/marketing.functions";
import type { StoreBillingAccess, StoreBillingStage } from "@/lib/store-billing.functions";
import { useStoreBillingAccess } from "@/store/billing/store-billing.queries";

// The TanStack route tree is regenerated from files during the Vite build.
// @ts-ignore -- this new path is absent from the committed generated tree until that build runs.
export const Route = createFileRoute("/app/loja/plano")({
  loader: () => listPublicPlans(),
  head: () => ({
    meta: [
      { title: "Plano e assinatura | Comandiva" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: StorePlanPage,
});

type StageCopy = {
  label: string;
  description: string;
  variant: "success" | "warning" | "danger" | "outline" | "brand";
};

const STAGE_COPY: Record<StoreBillingStage, StageCopy> = {
  billing_unconfigured: {
    label: "Configuração pendente",
    description: "A configuração comercial desta loja ainda precisa ser concluída.",
    variant: "warning",
  },
  complimentary: {
    label: "Cortesia ativa",
    description: "Sua loja está usando um período de cortesia concedido pela equipe Comandiva.",
    variant: "brand",
  },
  free: {
    label: "Plano gratuito",
    description: "A loja está operando no plano gratuito, sem cobrança recorrente.",
    variant: "outline",
  },
  trial: {
    label: "Período de teste",
    description: "Seu teste está ativo e nenhuma cobrança paga é feita automaticamente nesta fase.",
    variant: "brand",
  },
  full: {
    label: "Assinatura ativa",
    description: "A assinatura está regular e os recursos previstos no plano permanecem liberados.",
    variant: "success",
  },
  notice: {
    label: "Pagamento pendente",
    description: "Existe uma pendência de cobrança, mas a operação ainda está no estágio de aviso.",
    variant: "warning",
  },
  restricted_growth: {
    label: "Crescimento restrito",
    description: "Recursos de crescimento estão pausados até a regularização da cobrança.",
    variant: "warning",
  },
  restricted_writes: {
    label: "Alterações restritas",
    description: "Algumas alterações administrativas estão pausadas enquanto a cobrança permanece pendente.",
    variant: "warning",
  },
  suspended_orders: {
    label: "Novos pedidos pausados",
    description: "Novos pedidos estão temporariamente suspensos; pedidos existentes continuam preservados.",
    variant: "danger",
  },
  trial_expired: {
    label: "Teste encerrado",
    description: "O período de teste terminou e a conta está seguindo a política de fallback configurada.",
    variant: "outline",
  },
};

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function planName(access: StoreBillingAccess, plans: Awaited<ReturnType<typeof listPublicPlans>>) {
  if (!access.plan_code) return "Não configurado";
  return plans.find((plan) => plan.code === access.plan_code)?.name ?? access.plan_code;
}

function StorePlanPage() {
  const plans = Route.useLoaderData();
  const { authContext } = useAuth();
  const storeId = authContext?.store_ids?.[0] ?? null;
  const billingQuery = useStoreBillingAccess(storeId);

  if (!storeId) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <ErrorState
          kind="unexpected"
          title="Nenhuma loja vinculada"
          description="Sua conta precisa estar vinculada a uma loja antes de consultar plano e assinatura."
        />
      </div>
    );
  }

  if (billingQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="h-52 animate-pulse rounded-[28px] border border-border bg-muted/55" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: Math.max(plans.length, 4) }).map((_, index) => (
            <div key={index} className="h-[520px] animate-pulse rounded-[28px] border border-border bg-muted/45" />
          ))}
        </div>
      </div>
    );
  }

  if (billingQuery.error || !billingQuery.data) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <ErrorState
          kind="network"
          title="Não foi possível consultar sua assinatura"
          description="Nenhuma informação comercial foi alterada. Tente carregar novamente."
          onRetry={() => void billingQuery.refetch()}
        />
      </div>
    );
  }

  const access = billingQuery.data;
  const stage = STAGE_COPY[access.stage];
  const dateRows = [
    { label: "Fim do teste", value: formatDate(access.trial_ends_at) },
    { label: "Fim da cortesia", value: formatDate(access.complimentary_until) },
    { label: "Fim da tolerância", value: formatDate(access.grace_until) },
    { label: "Fim do período atual", value: formatDate(access.current_period_end) },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#4B1D6D] p-5 text-white shadow-e2 sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-[#FF6A4D]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 size-72 rounded-full bg-white/[.07] blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-extrabold">
              <CreditCard className="size-3.5 text-[#FFB4A2]" /> Plano e assinatura
            </span>
            <h1 className="mt-5 font-display text-3xl font-black tracking-[-.045em] sm:text-4xl">
              {planName(access, plans)}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
              Consulte seu estágio comercial e compare o catálogo real da Comandiva sem qualquer alteração automática de plano.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <Badge variant={stage.variant}>{stage.label}</Badge>
            {access.overdue_days > 0 ? (
              <span className="text-xs font-semibold text-white/65">
                {access.overdue_days} dia{access.overdue_days === 1 ? "" : "s"} de pendência
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <article className="panel p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-soft-foreground">
              <ShieldCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[.12em] text-muted-foreground">Situação atual</p>
              <h2 className="mt-1 font-display text-xl font-black text-foreground">{stage.label}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{stage.description}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {dateRows.length > 0 ? (
              dateRows.map((item) => (
                <div key={item.label} className="rounded-xl border border-border bg-muted/35 p-3.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <CalendarDays className="size-3.5" /> {item.label}
                  </div>
                  <p className="mt-1.5 text-sm font-extrabold text-foreground">{item.value}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-border bg-muted/35 p-3.5 sm:col-span-2">
                <p className="text-sm text-muted-foreground">Não há uma data comercial adicional para exibir neste estágio.</p>
              </div>
            )}
          </div>
        </article>

        <article className="panel p-5 sm:p-6">
          <span className="grid size-11 place-items-center rounded-xl bg-success-soft text-success">
            <Sparkles className="size-5" />
          </span>
          <h2 className="mt-4 font-display text-lg font-black text-foreground">Sem cobrança surpresa</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            A contratação online ainda não está ativa. Os botões de troca de plano permanecem bloqueados e nenhuma mudança abaixo gera cobrança ou altera sua assinatura.
          </p>
          <p className="mt-4 rounded-xl border border-brand/15 bg-brand-soft/60 p-3 text-xs font-semibold leading-5 text-brand-soft-foreground">
            Quando o pagamento online estiver pronto, a confirmação de preço e período acontecerá antes de qualquer contratação.
          </p>
        </article>
      </section>

      <section className="mt-9" aria-labelledby="compare-plans-title">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[.18em] text-brand">Comparar planos</p>
          <h2 id="compare-plans-title" className="mt-3 font-display text-3xl font-black tracking-[-.04em] text-foreground sm:text-4xl">
            Preços e recursos do catálogo atual
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Os valores abaixo vêm da mesma fonte usada no site público. Se o catálogo estiver indisponível, nenhum preço de exemplo será mostrado.
          </p>
        </div>

        <PlanCatalog
          plans={plans}
          context="panel"
          currentPlanCode={access.plan_code}
          className="mt-7"
        />
      </section>
    </div>
  );
}
