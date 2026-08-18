import { Link } from "@tanstack/react-router";
import { Check, Minus, Sparkles } from "lucide-react";
import { useState } from "react";

import type { PublicPlan, PublicPlanPrice } from "@/lib/marketing.functions";
import { cn } from "@/lib/utils";

type BillingInterval = "monthly" | "annual";
type CatalogContext = "marketing" | "panel";

export type PlanCatalogProps = {
  plans: PublicPlan[];
  context?: CatalogContext;
  currentPlanCode?: string | null;
  className?: string;
};

const FEATURE_LABELS: Array<{
  key: string;
  label: string;
}> = [
  { key: "catalog", label: "Cardápio digital" },
  { key: "orders", label: "Gestão de pedidos" },
  { key: "pickup", label: "Pedidos para retirada" },
  { key: "delivery", label: "Operação de entrega" },
  { key: "tracking", label: "Acompanhamento de pedidos" },
  { key: "thermal_print", label: "Impressão térmica" },
  { key: "kds", label: "Tela de cozinha (KDS)" },
  { key: "growth", label: "Recursos de crescimento" },
  { key: "priority_support", label: "Suporte prioritário" },
];

const REPORT_LABELS: Record<string, string> = {
  basic: "Relatórios básicos",
  standard: "Relatórios completos",
  advanced: "Relatórios avançados",
};

function priceFor(plan: PublicPlan, interval: BillingInterval): PublicPlanPrice | null {
  const exact = plan.prices.find((price) => price.billing_interval === interval) ?? null;
  if (exact) return exact;

  if (interval === "annual") {
    const monthly = plan.prices.find((price) => price.billing_interval === "monthly") ?? null;
    if (monthly?.amount_cents === 0) return monthly;
  }

  return null;
}

function formatMoney(amountCents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
  }).format(amountCents / 100);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function plural(value: number, singular: string, pluralValue: string) {
  return `${formatCount(value)} ${value === 1 ? singular : pluralValue}`;
}

function limitRows(plan: PublicPlan) {
  return [
    plan.max_orders_month === null
      ? "Pedidos mensais ilimitados"
      : `Até ${plural(plan.max_orders_month, "pedido/mês", "pedidos/mês")}`,
    plan.max_team_members === null
      ? "Equipe sem limite cadastrado"
      : `Até ${plural(plan.max_team_members, "membro da equipe", "membros da equipe")}`,
    plan.max_couriers === null
      ? "Entregadores sem limite cadastrado"
      : `Até ${plural(plan.max_couriers, "entregador", "entregadores")}`,
  ];
}

function annualBenefit(plan: PublicPlan) {
  const monthly = plan.prices.find((price) => price.billing_interval === "monthly") ?? null;
  const annual = plan.prices.find((price) => price.billing_interval === "annual") ?? null;
  if (!monthly || !annual || monthly.amount_cents <= 0) return null;

  const fullYearCents = monthly.amount_cents * 12;
  const savingsCents = fullYearCents - annual.amount_cents;
  if (savingsCents <= 0) return null;

  const savedMonths = savingsCents / monthly.amount_cents;
  const roundedMonths = Math.round(savedMonths);
  if (roundedMonths > 0 && Math.abs(savedMonths - roundedMonths) < 0.01) {
    return `${roundedMonths} ${roundedMonths === 1 ? "mês grátis" : "meses grátis"}`;
  }

  const percentage = Math.round((savingsCents / fullYearCents) * 100);
  return percentage > 0 ? `${percentage}% de economia` : null;
}

function trialDays(plan: PublicPlan) {
  return plan.prices.reduce((maximum, price) => Math.max(maximum, price.trial_days || 0), 0);
}

function featureRows(plan: PublicPlan) {
  const rows = FEATURE_LABELS.map(({ key, label }) => ({
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

export function PlanCatalog({
  plans,
  context = "marketing",
  currentPlanCode = null,
  className,
}: PlanCatalogProps) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const marketing = context === "marketing";
  const hasAnnual = plans.some((plan) =>
    plan.prices.some((price) => price.billing_interval === "annual"),
  );

  if (plans.length === 0) {
    return (
      <div
        className={cn(
          "rounded-[28px] border p-6 text-center sm:p-8",
          marketing
            ? "border-[#4B1D6D]/10 bg-white text-[#4B1D6D]"
            : "border-border bg-card text-foreground",
          className,
        )}
      >
        <p className="font-display text-xl font-extrabold">Planos temporariamente indisponíveis</p>
        <p className={cn("mx-auto mt-2 max-w-xl text-sm leading-6", marketing ? "text-[#706675]" : "text-muted-foreground")}> 
          Não vamos exibir valores de exemplo enquanto o catálogo comercial não estiver disponível.
        </p>
        {marketing ? (
          <Link
            to="/criar-loja"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#FF6A4D] px-5 text-sm font-extrabold text-white transition hover:bg-[#F15C40]"
          >
            Criar minha loja
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex justify-center">
        <div
          role="group"
          aria-label="Período de cobrança"
          className={cn(
            "inline-flex rounded-2xl border p-1",
            marketing ? "border-[#4B1D6D]/10 bg-white" : "border-border bg-muted/50",
          )}
        >
          <button
            type="button"
            aria-pressed={interval === "monthly"}
            onClick={() => setInterval("monthly")}
            className={cn(
              "min-h-10 rounded-xl px-4 text-sm font-extrabold transition",
              interval === "monthly"
                ? marketing
                  ? "bg-[#4B1D6D] text-white shadow-sm"
                  : "bg-background text-foreground shadow-sm"
                : marketing
                  ? "text-[#6F6573] hover:text-[#4B1D6D]"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            Mensal
          </button>
          <button
            type="button"
            aria-pressed={interval === "annual"}
            disabled={!hasAnnual}
            onClick={() => setInterval("annual")}
            className={cn(
              "min-h-10 rounded-xl px-4 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-40",
              interval === "annual"
                ? marketing
                  ? "bg-[#4B1D6D] text-white shadow-sm"
                  : "bg-background text-foreground shadow-sm"
                : marketing
                  ? "text-[#6F6573] hover:text-[#4B1D6D]"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            Anual
          </button>
        </div>
      </div>

      <div className="mt-8 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const selectedPrice = priceFor(plan, interval);
          const monthlyPrice = plan.prices.find((price) => price.billing_interval === "monthly") ?? null;
          const benefit = annualBenefit(plan);
          const trial = trialDays(plan);
          const highlighted = plan.code === "profissional";
          const current = currentPlanCode === plan.code;
          const isFree = selectedPrice?.amount_cents === 0;
          const annualEquivalent =
            interval === "annual" && selectedPrice && selectedPrice.billing_interval === "annual"
              ? Math.round(selectedPrice.amount_cents / 12)
              : null;

          return (
            <article
              key={plan.code}
              className={cn(
                "relative flex min-w-0 flex-col overflow-hidden rounded-[28px] border p-5 shadow-sm sm:p-6",
                marketing
                  ? highlighted
                    ? "border-[#4B1D6D]/35 bg-[#4B1D6D] text-white shadow-[0_22px_55px_rgba(75,29,109,.18)]"
                    : "border-[#4B1D6D]/10 bg-white text-[#2A2030]"
                  : highlighted
                    ? "border-brand/30 bg-card shadow-e2"
                    : "border-border bg-card",
                current && !marketing && "ring-2 ring-brand/35 ring-offset-2 ring-offset-background",
              )}
            >
              <div className="flex min-h-7 flex-wrap items-center gap-2">
                {highlighted ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[.08em]",
                      marketing ? "bg-[#FF8068] text-white" : "bg-brand-soft text-brand-soft-foreground",
                    )}
                  >
                    <Sparkles className="size-3" /> Mais escolhido
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
                      marketing && highlighted
                        ? "bg-white/12 text-white"
                        : marketing
                          ? "bg-[#FFF0EA] text-[#D94F37]"
                          : "bg-success-soft text-success",
                    )}
                  >
                    {benefit}
                  </span>
                ) : null}
              </div>

              <h3 className={cn("mt-5 font-display text-2xl font-black tracking-[-.035em]", !marketing && "text-foreground")}> 
                {plan.name}
              </h3>
              <p
                className={cn(
                  "mt-2 min-h-12 text-sm leading-6",
                  marketing ? (highlighted ? "text-white/70" : "text-[#776D7B]") : "text-muted-foreground",
                )}
              >
                {plan.description || "Plano comercial Comandiva."}
              </p>

              <div className="mt-6 min-h-[88px]">
                {!selectedPrice ? (
                  <>
                    <p className={cn("text-lg font-black", marketing && highlighted ? "text-white" : marketing ? "text-[#4B1D6D]" : "text-foreground")}> 
                      Preço indisponível
                    </p>
                    <p className={cn("mt-1 text-xs", marketing && highlighted ? "text-white/60" : marketing ? "text-[#7B707F]" : "text-muted-foreground")}> 
                      Consulte novamente quando o catálogo estiver atualizado.
                    </p>
                  </>
                ) : isFree ? (
                  <>
                    <p className={cn("font-display text-4xl font-black tracking-[-.05em]", marketing && highlighted ? "text-white" : marketing ? "text-[#4B1D6D]" : "text-foreground")}> 
                      Grátis
                    </p>
                    <p className={cn("mt-1 text-xs", marketing && highlighted ? "text-white/60" : marketing ? "text-[#7B707F]" : "text-muted-foreground")}> 
                      Sem cobrança recorrente.
                    </p>
                  </>
                ) : interval === "annual" && annualEquivalent !== null ? (
                  <>
                    <div className="flex flex-wrap items-end gap-x-1.5">
                      <span className={cn("font-display text-4xl font-black tracking-[-.05em]", marketing && highlighted ? "text-white" : marketing ? "text-[#4B1D6D]" : "text-foreground")}> 
                        {formatMoney(annualEquivalent, selectedPrice.currency)}
                      </span>
                      <span className={cn("pb-1 text-xs font-bold", marketing && highlighted ? "text-white/60" : marketing ? "text-[#7B707F]" : "text-muted-foreground")}>/mês</span>
                    </div>
                    <p className={cn("mt-1 text-xs", marketing && highlighted ? "text-white/60" : marketing ? "text-[#7B707F]" : "text-muted-foreground")}> 
                      {formatMoney(selectedPrice.amount_cents, selectedPrice.currency)} cobrados no ano
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-end gap-x-1.5">
                      <span className={cn("font-display text-4xl font-black tracking-[-.05em]", marketing && highlighted ? "text-white" : marketing ? "text-[#4B1D6D]" : "text-foreground")}> 
                        {formatMoney(selectedPrice.amount_cents, selectedPrice.currency)}
                      </span>
                      <span className={cn("pb-1 text-xs font-bold", marketing && highlighted ? "text-white/60" : marketing ? "text-[#7B707F]" : "text-muted-foreground")}>/mês</span>
                    </div>
                    {monthlyPrice && interval === "monthly" ? (
                      <p className={cn("mt-1 text-xs", marketing && highlighted ? "text-white/60" : marketing ? "text-[#7B707F]" : "text-muted-foreground")}>Cobrança mensal, sem preço estimado.</p>
                    ) : null}
                  </>
                )}
              </div>

              <div className={cn("mt-5 border-t pt-5", marketing && highlighted ? "border-white/12" : marketing ? "border-[#4B1D6D]/10" : "border-border")}> 
                <p className={cn("text-[11px] font-black uppercase tracking-[.12em]", marketing && highlighted ? "text-white/55" : marketing ? "text-[#8A7CA8]" : "text-muted-foreground")}>Limites</p>
                <ul className="mt-3 space-y-2.5">
                  {limitRows(plan).map((item) => (
                    <li key={item} className="flex gap-2 text-xs leading-5">
                      <Check className={cn("mt-0.5 size-3.5 shrink-0", marketing && highlighted ? "text-[#FFB09E]" : marketing ? "text-[#FF6A4D]" : "text-brand")} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5 flex-1">
                <p className={cn("text-[11px] font-black uppercase tracking-[.12em]", marketing && highlighted ? "text-white/55" : marketing ? "text-[#8A7CA8]" : "text-muted-foreground")}>Recursos</p>
                <ul className="mt-3 space-y-2.5">
                  {featureRows(plan).map((item) => (
                    <li key={item.label} className={cn("flex gap-2 text-xs leading-5", !item.enabled && (marketing && highlighted ? "text-white/38" : marketing ? "text-[#A79EAA]" : "text-muted-foreground/55"))}> 
                      {item.enabled ? (
                        <Check className={cn("mt-0.5 size-3.5 shrink-0", marketing && highlighted ? "text-[#FFB09E]" : marketing ? "text-[#FF6A4D]" : "text-brand")} />
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
                  <Link
                    to="/criar-loja"
                    className={cn(
                      "inline-flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-center text-sm font-black transition",
                      highlighted
                        ? "bg-[#FF6A4D] text-white hover:bg-[#F15C40]"
                        : "bg-[#4B1D6D] text-white hover:bg-[#3E175A]",
                    )}
                  >
                    {trial > 0 ? `Testar ${trial} dias grátis` : "Começar agora"}
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className={cn(
                      "min-h-12 w-full cursor-not-allowed rounded-xl border px-4 text-sm font-bold",
                      current
                        ? "border-success/25 bg-success-soft text-success"
                        : "border-border bg-muted/60 text-muted-foreground",
                    )}
                  >
                    {current ? "Plano atual" : "Contratação online em ativação"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
