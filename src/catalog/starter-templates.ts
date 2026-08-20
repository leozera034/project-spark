import { supabase } from "@/integrations/supabase/client";

export type StarterTemplateCode =
  | "pizzaria"
  | "hamburgueria"
  | "acai"
  | "sorveteria"
  | "restaurante"
  | "lanchonete"
  | "pastelaria"
  | "adega"
  | "mercado";

export type StarterTemplateResult = {
  ok: boolean;
  profile: { id: string; code: StarterTemplateCode; name: string };
  created_categories: number;
  created_option_groups: number;
  product_templates: Array<{
    type?: string;
    label?: string;
    capabilities?: Record<string, unknown>;
  }>;
};

export async function applyCatalogStarterTemplate(
  storeId: string,
  profileCode: StarterTemplateCode,
): Promise<StarterTemplateResult> {
  // O tipo gerado do Supabase pode ficar uma migration atrás durante deploys.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = supabase.rpc.bind(supabase) as any;
  const { data, error } = await rpc("apply_catalog_starter_template", {
    _store_id: storeId,
    _profile_code: profileCode,
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("TEMPLATE_PROVISIONING_FAILED");
  return data as StarterTemplateResult;
}
