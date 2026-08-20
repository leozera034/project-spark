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
  | "mercado"
  | "outros";

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
  other_business_type?: string | null;
};

export async function applyCatalogStarterTemplate(
  storeId: string,
  profileCode: StarterTemplateCode,
  otherBusinessType?: string,
): Promise<StarterTemplateResult> {
  // O tipo gerado do Supabase pode ficar uma migration atrás durante deploys.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = supabase.rpc.bind(supabase) as any;
  const { data, error } = await rpc("apply_catalog_starter_template_v2", {
    _store_id: storeId,
    _profile_code: profileCode,
    _other_label: profileCode === "outros" ? otherBusinessType?.trim() || null : null,
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("TEMPLATE_PROVISIONING_FAILED");
  return data as StarterTemplateResult;
}
