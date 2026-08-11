import { createServerFn } from "@tanstack/react-start";

/**
 * Planos comerciais reais, lidos da tabela pública `plans`.
 * Nenhum valor é inventado na landing: o que aparece na página é
 * exatamente o que está cadastrado como plano ativo.
 */
export type PublicPlan = {
  code: string;
  name: string;
  description: string | null;
  monthly_price: number;
  max_orders_month: number | null;
  max_team_members: number | null;
  max_couriers: number | null;
};

export const listPublicPlans = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPlan[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("plans")
        .select(
          "code, name, description, monthly_price, max_orders_month, max_team_members, max_couriers",
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("[marketing] falha ao listar planos", error);
        return [];
      }
      return (data ?? []).map((plan) => ({
        code: plan.code,
        name: plan.name,
        description: plan.description,
        monthly_price: Number(plan.monthly_price),
        max_orders_month: plan.max_orders_month,
        max_team_members: plan.max_team_members,
        max_couriers: plan.max_couriers,
      }));
    } catch (error) {
      console.error("[marketing] planos indisponíveis", error);
      return [];
    }
  },
);
