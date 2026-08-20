import { Check, Sparkles } from "lucide-react";

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
    <section id="planos" className="bg-[#FCFAF8] py-20 sm:py-24">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#FF681F]">Planos Comandiva</p>
          <h2 className="mt-4 text-balance font-display text-3xl font-extrabold tracking-[-.04em] text-[#1B0D2C] sm:text-4xl lg:text-5xl">
            Planos simples, com limites claros.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#69626E]">
            Escolha pelo tamanho da sua operação. Primeiro você vê preço, capacidade e o que realmente muda de um plano para o outro.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#55207A]/10 bg-white px-3 py-2 text-xs font-extrabold text-[#55207A] shadow-sm">
              <Check className="size-3.5 text-[#188653]" /> Comece com R$ 0
            </span>
            {maximumTrialDays > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#55207A]/10 bg-white px-3 py-2 text-xs font-extrabold text-[#55207A] shadow-sm">
                <Sparkles className="size-3.5 text-[#FF681F]" /> Até {maximumTrialDays} dias grátis em plano elegível
              </span>
            ) : null}
          </div>
        </Reveal>

        <Reveal delay={80} className="mt-10">
          <PlanCatalog plans={plans} context="marketing" />
        </Reveal>

        <Reveal delay={120} className="mx-auto mt-6 max-w-3xl text-center">
          <p className="text-sm leading-6 text-[#69626E]">
            Os valores, limites e recursos exibidos aqui são carregados do catálogo comercial atual do Comandiva.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
