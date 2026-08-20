import { supabase } from "@/integrations/supabase/client";

export type ProductStarterTemplate = {
  type: string;
  label: string;
  capabilities: Record<string, boolean>;
};

export type StoreCategoryProfile = {
  id?: string;
  code?: string;
  name?: string;
  product_templates?: ProductStarterTemplate[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("NOT_FOUND");
  return result.data as T;
}

export async function getStoreCategoryProfile(storeId: string): Promise<StoreCategoryProfile | null> {
  const { data, error } = await rpc("get_store_category_profile", { _store_id: storeId });
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as StoreCategoryProfile;
}

export async function applyProductStarterTemplate(params: {
  storeId: string;
  productId: string;
  template: ProductStarterTemplate;
}): Promise<void> {
  const { error } = await rpc("update_product_engine_profile", {
    _store_id: params.storeId,
    _product_id: params.productId,
    _product_type: params.template.type,
    _capabilities: params.template.capabilities ?? {},
    _pricing_rules: {},
  });
  if (error) throw new Error(error.message);
}

export const FALLBACK_PRODUCT_TEMPLATES: ProductStarterTemplate[] = [
  { type: "simple", label: "Produto simples", capabilities: {} },
  { type: "combo", label: "Combo", capabilities: { combo_steps: true } },
  { type: "variant", label: "Produto com tamanhos ou variações", capabilities: { variants: true } },
  { type: "measured", label: "Produto por peso ou volume", capabilities: { measured: true } },
];
