import { Check, Minus, Sparkles } from "lucide-react";
import { useState } from "react";

import type { PublicPlan, PublicPlanPrice } from "@/lib/marketing.functions";
import { cn } from "@/lib/utils";

export type BillingInterval = "monthly" | "annual";
type CatalogContext = "marketing" | "panel";

export type PlanCatalogProps = {
  plans: PublicPlan[];
  context?: CatalogContext;
  currentPlanCode?: string | null;
  className?: string;
  busyPlanCode?: string | null;
  onSelectPlan?: (planCode: string, interval: BillingInterval) => void;
};

const FEATURE_LABELS = [
  ["catalog", "Cardápio digital"],
  ["orders", "Gestão de pedidos"],
  ["pickup", "Pedidos para retirada"],
  ["delivery", "Operação de entrega"],
  ["tracking", "Acompanhamento de pedidos"],
  ["thermal_print", "Impressão térmica"],
  ["kds", "Tela de cozinha"],
  ["growth", "Clientes e recursos de crescimento"],
  ["priority_support", "Suporte prioritário"],
] as const;

const REPORT_LABELS: Record<string, string> = {
  basic: "Relatórios básicos",
  standard: "Relatórios completos",
  advanced: "Relatórios avançados",
};

function priceFor(plan: PublicPlan, interval: BillingInterval): PublicPlanPrice | null {
  const exact = plan.prices.find((price) => price.billing_interval === interval) ?? null;
  if (exact) return exact;

  const monthly = plan.prices.find((price) => price.billing_interval === "monthly") ?? null;
  return interval === "annual" && monthly?.amount_cents === 0 ? monthly : null;
}

function money(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
  }).format(cents / 100);
}

function count(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function limits(plan: PublicPlan) {
  const orders =
    plan.max_orders_month === null
      ? "Pedidos mensais ilimitados"
      : `Até ${count(plan.max_orders_month)} pedidos/mês`;

  const team =
    plan.max_team_members === null
      ? "Equipe sem limite cadastrado"
      : plan.max_team_members === 1
        ? "1 pessoa na equipe"
        : `Até ${count(plan.max_team_members)} pessoas na equipe`;

  const couriers =
    plan.max_couriers === null
      ? "Entregadores sem limite cadastrado"
      : plan.max_couriers === 1
        ? "1 entregador"
        : `Até ${count(plan.max_couriers)} entregadores`;

  return [orders, team, couriers];
}

function annualBenefit(plan: PublicPlan) {
  const monthly = plan.prices.find((price) => price.billing_interval === "monthly");
  const annual = plan.prices.find((price) => price.billing_interval === "annual");
  if (!monthly || !annual || monthly.amount_cents <= 0) return null;

  const saved = monthly.amount_cents * 12 - annual.amount_cents;
  if (saved <= 0) return null;

  const months = saved / monthly.amount_cents;
  const rounded = Math.round(months);
  if (Math.abs(months - rounded) < 0.01 && rounded > 0) {
    return `${rounded} ${rounded === 1 ? "mês grátis" : "meses grátis"}`;
  }

  return `${Math.round((saved / (monthly.amount_cents * 12)) * 100)}% de economia`;
}

function trialDays(plan: PublicPlan) {
  return plan.prices.reduce(
    (maximum, price) => Math.max(maximum, Number(price.trial_days) || 0),
    0,
  );
}

function allFeatures(plan: PublicPlan) {
  const rows = FEATURE_LABELS.map(([key, label]) => ({
    label,
    enabled: plan.features[key] === true,
  }));

  const reports = plan.features.reports;
  if (typeof reports === "string" && reports.trim()) {
    rows.push({
      label: REPORT_LABELS[reports] ?? `Relatórios: ${reports}`,
      enabled: true,
    });
  }

  return rows;
}

function includesPreviousPlan(plan: PublicPlan, previousPlan: PublicPlan | null) {
  if (!previousPlan) return false;

  return FEATURE_LABELS.every(([key]) => {
    const previousEnabled = previousPlan.features[key] === true;
    return !previousEnabled || plan.features[key] === true;
  });
}

function marketingDifferences(plan: PublicPlan, previousPlan: PublicPlan | null) {
  if (!previousPlan) {
    return allFeatures(plan).filter((feature) => feature.enabled).slice(0, 6);
  }

  const rows: Array<{ label: string; enabled: boolean }> = [];

  if (includesPreviousPlan(plan, previousPlan)) {
    rows.push({ label: `Tudo do ${previousPlan.name}`, enabled: true });
  }

  FEATURE_LABELS.forEach(([key, label]) => {
    if (plan.features[key] === true && previousPlan.features[key] !== true) {
      rows.push({ label, enabled: true });
    }
  });

  const currentReports = plan.features.reports;
  const previousReports = previousPlan.features.reports;
  if (
    typeof currentReports === "string" &&
    currentReports.trim() &&
    currentReports !== previousReports
  ) {
    rows.push({
      label: REPORT_LABELS[currentReports] ?? `Relatórios: ${currentReports}`,
      enabled: true,
    });
  }

  return rows.length > 0
    ? rows
    : [{ label: "Mais capacidade para a operação", enabled: true }];
}

type PlanCardProps = {
  plan: PublicPlan;
  previousPlan: PublicPlan | null;
  interval: BillingInterval;
  marketing: boolean;
  currentPlanCode: string | null;
  busyPlanCode: string | null;
  onSelectPlan?: (planCode: string, interval: BillingInterval) => void;
};

function PlanCard({
  plan,
  previousPlan,
  interval,
  marketing,
  currentPlanCode,
  busyPlanCode,
  onSelectPlan,
}: PlanCardProps) {
  const selected = priceFor(plan, interval);
  const trial = trialDays(plan);
  const highlighted = plan.code === "profissional";
  const current = currentPlanCode === plan.code;
  const isFree = selected?.amount_cents === 0;
  const busy = busyPlanCode === plan.code;
  const benefit = annualBenefit(plan);
  const annualEquivalent =
    interval === "annual" && selected?.billing_interval === "annual"
      ? Math.round(selected.amount_cents / 12)
      : null;
  const featureRows = marketing
    ? marketingDifferences(plan, previousPlan)
    : allFeatures(plan);

  const ctaClass = cn(
    "inline-flex min-h-12 w-full items-center justify-center rounded-[14px] px-4 text-center text-sm font-black transition",
    marketing
      ? highlighted
        ? "bg-[#FF681F] text-white hover:bg-[#E95612]"
        : "bg-[#55207A] text-white hover:bg-[#431861]"
      : "bg-brand text-brand-foreground hover:opacity-90",
  );

  return (
    <article
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-[24px] border p-5 sm:p-6",
        marketing
          ? highlighted
            ? "border-[#55207A]/35 bg-white shadow-[0_20px_50px_rgba(27,13,44,.11)]"
            : "border-[#EAE5ED] bg-white shadow-[0_10px_30px_rgba(27,13,44,.035)]"
          : highlighted
            ? "border-brand/30 bg-card shadow-e2"
            : "border-border bg-card",
        current && !marketing && "ring-2 ring-brand/35 ring-offset-2 ring-offset-background",
      )}
    >
      {highlighted && marketing ? (
        <div className="absolute inset-x-0 top-0 h-1 bg-[#FF681F]" />
      ) : null}

      <div className="flex min-h-7 flex-wrap items-center gap-2">
        {highlighted ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[.08em]",
              marketing
                ? "bg-[#FFF0E8] text-[#C94A0E]"
                : "bg-brand-soft text-brand-soft-foreground",
            )}
          >
            <Sparkles className="size-3" /> Recomendado
          </span>
        ) : null}
        {current && !marketing ? (
          <span className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-black uppercase tracking-[.08em] text-success">
            Plano atual
          </span>
        ) : null}
        {interval === "annual" && benefit ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-black",
              marketing
                ? "bg-[#F4FBF7] text-[#17663A]"
                : "bg-success-soft text-success",
            )}
          >
            {benefit}
          </span>
        ) : null}
      </div>

      <h3
        className={cn(
          "mt-5 font-display text-2xl font-black tracking-[-.035em]",
          marketing ? "text-[#17131C]" : "text-foreground",
        )}
      >
        {plan.name}
      </h3>
      <p
        className={cn(
          "mt-2 min-h-12 text-sm leading-6",
          marketing ? "text-[#69626E]" : "text-muted-foreground",
        )}
      >
        {plan.description || "Plano comercial Comandiva."}
      </p>

      <div className="mt-6 min-h-[86px]">
        {!selected ? (
          <>
            <p className="text-lg font-black">Preço indisponível</p>
            <p className="mt-1 text-xs opacity-60">Consulte novamente quando o catálogo estiver atualizado.</p>
          </>
        ) : isFree ? (
          <>
            <p className="font-display text-4xl font-black tracking-[-.05em]">R$ 0</p>
            <p className="mt-1 text-xs opacity-60">Sem cobrança recorrente.</p>
          </>
        ) : annualEquivalent !== null ? (
          <>
            <div className="flex items-end gap-1.5">
              <span className="font-display text-4xl font-black tracking-[-.05em]">
                {money(annualEquivalent, selected.currency)}
              </span>
              <span className="pb-1 text-xs font-bold opacity-60">/mês</span>
            </div>
            <p className="mt-1 text-xs opacity-60">
              {money(selected.amount_cents, selected.currency)} cobrados no ano
            </p>
          </>
        ) : (
          <>
            <div className="flex items-end gap-1.5">
              <span className="font-display text-4xl font-black tracking-[-.05em]">
                {money(selected.amount_cents, selected.currency)}
              </span>
              <span className="pb-1 text-xs font-bold opacity-60">/mês</span>
            </div>
            <p className="mt-1 text-xs opacity-60">Cobrança mensal.</p>
          </>
        )}
      </div>

      <div
        className={cn(
          "mt-5 border-t pt-5",
          marketing ? "border-[#EAE5ED]" : "border-border",
        )}
      >
        <p className="text-[11px] font-black uppercase tracking-[.12em] opacity-55">
          Capacidade
        </p>
        <ul className="mt-3 space-y-2.5">
          {limits(plan).map((item) => (
            <li key={item} className="flex gap-2 text-xs leading-5">
              <Check className="mt-0.5 size-3.5 shrink-0 text-[#188653]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex-1">
        <p className="text-[11px] font-black uppercase tracking-[.12em] opacity-55">
          {marketing ? "O que este plano inclui" : "Recursos"}
        </p>
        <ul className="mt-3 space-y-2.5">
          {featureRows.map((item) => (
            <li
              key={item.label}
              className={cn(
                "flex gap-2 text-xs leading-5",
                !item.enabled && "opacity-40",
              )}
            >
              {item.enabled ? (
                <Check className="mt-0.5 size-3.5 shrink-0 text-[#188653]" />
              ) : (
                <Minus className="mt-0.5 size-3.5 shrink-0" />
              )}
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        {marketing ? (
          <a
            href={`/criar-loja?plan=${encodeURIComponent(plan.code)}&interval=${interval}`}
            className={ctaClass}
          >
            {isFree
              ? "Criar loja grátis"
              : trial > 0
                ? `Testar ${trial} dias grátis`
                : `Escolher ${plan.name}`}
          </a>
        ) : (
          <button
            type="button"
            disabled={current || busy || !onSelectPlan || !selected}
            onClick={() => onSelectPlan?.(plan.code, interval)}
            className={cn(
              ctaClass,
              "disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-muted disabled:text-muted-foreground",
            )}
          >
            {current
              ? "Plano atual"
              : busy
                ? "Processando…"
                : isFree
                  ? "Plano gratuito"
                  : "Selecionar plano"}
          </button>
        )}
      </div>
    </article>
  );
}

export function PlanCatalog({
  plans,
  context = "marketing",
  currentPlanCode = null,
  className,
  busyPlanCode = null,
  onSelectPlan,
}: PlanCatalogProps) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [mobilePlanCode, setMobilePlanCode] = useState(
    () => plans.find((plan) => plan.code === "profissional")?.code ?? plans[0]?.code ?? "",
  );
  const [compareAllMobile, setCompareAllMobile] = useState(false);
  const marketing = context === "marketing";
  const hasAnnual = plans.some((plan) =>
    plan.prices.some((price) => price.billing_interval === "annual"),
  );

  if (!plans.length) {
    return (
      <div
        className={cn(
          "rounded-[24px] border p-6 text-center sm:p-8",
          marketing
            ? "border-[#EAE5ED] bg-white text-[#55207A]"
            : "border-border bg-card text-foreground",
          className,
        )}
      >
        <p className="font-display text-xl font-extrabold">Planos temporariamente indisponíveis</p>
        <p
          className={cn(
            "mx-auto mt-2 max-w-xl text-sm leading-6",
            marketing ? "text-[#69626E]" : "text-muted-foreground",
          )}
        >
          Não exibimos valores de exemplo quando o catálogo comercial não está disponível.
        </p>
        {marketing ? (
          <a
            href="/criar-loja"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[#FF681F] px-5 text-sm font-extrabold text-white"
          >
            Criar minha loja grátis
          </a>
        ) : null}
      </div>
    );
  }

  const selectedMobilePlan =
    plans.find((plan) => plan.code === mobilePlanCode) ??
    plans.find((plan) => plan.code === "profissional") ??
    plans[0];

  const renderPlan = (plan: PublicPlan, index: number) => (
    <PlanCard
      key={plan.code}
      plan={plan}
      previousPlan={index > 0 ? plans[index - 1] : null}
      interval={interval}
      marketing={marketing}
      currentPlanCode={currentPlanCode}
      busyPlanCode={busyPlanCode}
      onSelectPlan={onSelectPlan}
    />
  );

  return (
    <div className={className}>
      <div className="flex justify-center">
        <div
          role="group"
          aria-label="Período de cobrança"
          className={cn(
            "inline-flex rounded-[14px] border p-1",
            marketing ? "border-[#EAE5ED] bg-white" : "border-border bg-muted/50",
          )}
        >
          {(["monthly", "annual"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={interval === value}
              disabled={value === "annual" && !hasAnnual}
              onClick={() => setInterval(value)}
              className={cn(
                "min-h-10 rounded-xl px-5 text-sm font-extrabold transition disabled:opacity-40",
                interval === value
                  ? marketing
                    ? "bg-[#55207A] text-white shadow-sm"
                    : "bg-background text-foreground shadow-sm"
                  : marketing
                    ? "text-[#69626E] hover:text-[#55207A]"
                    : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "monthly" ? "Mensal" : "Anual"}
            </button>
          ))}
        </div>
      </div>

      {marketing ? (
        <>
          <div className="mt-6 flex gap-2 overflow-x-auto pb-1 md:hidden">
            {plans.map((plan) => (
              <button
                key={plan.code}
                type="button"
                aria-pressed={selectedMobilePlan.code === plan.code && !compareAllMobile}
                onClick={() => {
                  setMobilePlanCode(plan.code);
                  setCompareAllMobile(false);
                }}
                className={cn(
                  "min-h-11 shrink-0 rounded-full border px-4 text-sm font-extrabold transition",
                  selectedMobilePlan.code === plan.code && !compareAllMobile
                    ? "border-[#55207A] bg-[#55207A] text-white"
                    : "border-[#EAE5ED] bg-white text-[#55207A]",
                )}
              >
                {plan.name}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 md:hidden">
            {compareAllMobile
              ? plans.map((plan, index) => renderPlan(plan, index))
              : renderPlan(
                  selectedMobilePlan,
                  Math.max(
                    0,
                    plans.findIndex((plan) => plan.code === selectedMobilePlan.code),
                  ),
                )}
          </div>

          <button
            type="button"
            onClick={() => setCompareAllMobile((value) => !value)}
            className="mx-auto mt-4 flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-extrabold text-[#55207A] underline decoration-[#55207A]/25 underline-offset-4 md:hidden"
          >
            {compareAllMobile ? "Ver apenas o plano selecionado" : "Comparar todos os planos"}
          </button>

          <div className="mt-8 hidden items-stretch gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan, index) => renderPlan(plan, index))}
          </div>
        </>
      ) : (
        <div className="mt-8 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan, index) => renderPlan(plan, index))}
        </div>
      )}
    </div>
  );
}
