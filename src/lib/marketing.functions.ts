import { createServerFn } from "@tanstack/react-start";

/**
 * Planos comerciais reais, lidos exclusivamente da fundação externa.
 * Nenhum valor é inventado na landing: se não houver plano ativo cadastrado,
 * a lista fica vazia.
 */
export type PublicPlanPrice = {
  billing_interval: "monthly" | "annual";
  amount_cents: number;
  currency: string;
  trial_days: number;
};

export type PublicPlan = {
  code: string;
  name: string;
  description: string | null;
  monthly_price: number;
  max_orders_month: number | null;
  max_team_members: number | null;
  max_couriers: number | null;
  features: Record<string, boolean | string | number | null>;
  prices: PublicPlanPrice[];
};

type PublicPlanRow = {
  code: string;
  name: string;
  description: string | null;
  monthly_price: number | string;
  max_orders_month: number | null;
  max_team_members: number | null;
  max_couriers: number | null;
  features?: Record<string, boolean | string | number | null> | null;
  prices?: Array<{
    billing_interval: "monthly" | "annual";
    amount_cents: number | string;
    currency: string;
    trial_days: number | string;
  }>;
};

const listPublicPlansServer = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPlan[]> => {
    try {
      const { invokePediuPublicSupport } = await import(
        "@/integrations/supabase/public-support.server"
      );
      const rows = await invokePediuPublicSupport<PublicPlanRow[]>({ action: "plans" });
      return rows.map((plan) => ({
        code: plan.code,
        name: plan.name,
        description: plan.description,
        monthly_price: Number(plan.monthly_price),
        max_orders_month: plan.max_orders_month,
        max_team_members: plan.max_team_members,
        max_couriers: plan.max_couriers,
        features: plan.features ?? {},
        prices: (plan.prices ?? []).map((price) => ({
          billing_interval: price.billing_interval,
          amount_cents: Number(price.amount_cents),
          currency: price.currency,
          trial_days: Number(price.trial_days),
        })),
      }));
    } catch (error) {
      console.error("[marketing] planos indisponíveis", error);
      return [];
    }
  },
);

export async function listPublicPlans(): Promise<PublicPlan[]> {
  try {
    return await listPublicPlansServer();
  } catch (error) {
    console.error("[marketing] ponte de planos indisponível", error);
    return [];
  }
}
