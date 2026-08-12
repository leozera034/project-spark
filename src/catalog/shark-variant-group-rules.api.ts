import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

export type VariantGroupRule = {
  product_variant_id: string;
  option_group_id: string;
  min_selections: number | null;
  max_selections: number | null;
  included_selections: number | null;
  updated_at?: string;
};

export async function listVariantGroupRules(storeId: string, productId: string): Promise<VariantGroupRule[]> {
  const result = await rpc("list_product_variant_group_rules", {
    _store_id: storeId,
    _product_id: productId,
  });
  if (result.error) throw new Error(result.error.message);
  return Array.isArray(result.data) ? result.data as VariantGroupRule[] : [];
}

export async function saveVariantGroupRule(params: {
  storeId: string;
  productId: string;
  variantId: string;
  groupId: string;
  minSelections: number | null;
  maxSelections: number | null;
  includedSelections: number | null;
}): Promise<VariantGroupRule> {
  const result = await rpc("upsert_product_variant_group_rule", {
    _store_id: params.storeId,
    _product_id: params.productId,
    _product_variant_id: params.variantId,
    _option_group_id: params.groupId,
    _min_selections: params.minSelections,
    _max_selections: params.maxSelections,
    _included_selections: params.includedSelections,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data as VariantGroupRule;
}
