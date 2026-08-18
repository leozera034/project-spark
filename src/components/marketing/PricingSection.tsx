import { CreditCard, ShieldCheck, Sparkles } from "lucide-react";

import { PlanCatalog } from "@/components/billing/PlanCatalog";
import { Reveal } from "@/components/motion/Reveal";
import type { PublicPlan } from "@/lib/marketing.functions";

export function PricingSection({ plans }: { plans: PublicPlan[] }) {
  const maximumTrialDays = plans.reduce(
    (maximum, plan) =>
      Math.max(
        maximum,
        ...plan.prices.map((price) => Number(price.trial_days) || 0),
      ),
    0,
  );

  return (
    <section id="planos" className="relative overflow-hidden bg-[#FFF6F1] py-24 sm:py-28">
      <div className="pointer-events-none absolute -left-40 top-10 size-[30rem] rounded-full bg-[#FF6A4D]/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 size-[30rem] rounded-full bg-[#8A7CA8]/12 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[.22em] text-[#FF6A4D]">Planos Comandiva</p>
          <h2 className="mt-4 text-balance font-display text-4xl font-extrabold tracking-[-.04em] text-[#291F2E] sm:text-5xl lg:text-6xl">
            Escolha o nível certo para sua operação
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#706675]">
            Compare limites e recursos com preços carregados diretamente do nosso catálogo comercial.
            Nada de valor escondido ou preço diferente entre site e sistema.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {maximumTrialDays > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4B1D6D]/10 bg-white px-3 py-2 text-xs font-extrabold text-[#4B1D6D] shadow-sm">
                <Sparkles className="size-3.5 text-[#FF6A4D]" /> Teste de até {maximumTrialDays} dias sem cartão
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4B1D6D]/10 bg-white px-3 py-2 text-xs font-extrabold text-[#4B1D6D] shadow-sm">
              <ShieldCheck className="size-3.5 text-[#FF6A4D]" /> Sem comissão por pedido
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4B1D6D]/10 bg-white px-3 py-2 text-xs font-extrabold text-[#4B1D6D] shadow-sm">
              <CreditCard className="size-3.5 text-[#FF6A4D]" /> Cobrança online em ativação
            </span>
          </div>
        </Reveal>

        <Reveal delay={80} className="mt-10">
          <PlanCatalog plans={plans} context="marketing" />
        </Reveal>

        <Reveal delay={120} className="mx-auto mt-7 max-w-3xl text-center">
          <p className="text-sm leading-6 text-[#706675]">
            Você pode iniciar o teste sem cartão. Nenhuma contratação paga será cobrada enquanto a cobrança online não estiver ativa e apresentada claramente no painel.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
