import { supabase } from "@/integrations/supabase/client";
import type { ProductCapabilities, ProductPricingRules, ProductType } from "./advanced-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

export type CategoryProfile = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  default_capabilities: ProductCapabilities;
  product_templates: Array<{
    type: ProductType;
    label: string;
    capabilities: ProductCapabilities;
  }>;
};

export type ProductEngineProfile = {
  product_id: string;
  product_type: ProductType;
  capabilities: ProductCapabilities;
  pricing_rules: ProductPricingRules;
  engine_version: number;
  category_profile: CategoryProfile | null;
};

export type ProductInventory = {
  managed: boolean;
  quantity: number | null;
  low_stock_threshold: number;
  is_low: boolean;
  is_empty: boolean;
  updated_at: string;
};

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function getStoreCategoryProfile(storeId: string): Promise<CategoryProfile | null> {
  return unwrap<CategoryProfile | null>(await rpc("get_store_category_profile", { _store_id: storeId }));
}

export async function setStoreCategoryProfile(storeId: string, profileId: string): Promise<CategoryProfile> {
  return unwrap<CategoryProfile>(await rpc("set_store_category_profile", { _store_id: storeId, _profile_id: profileId }));
}

export async function getProductEngineProfile(storeId: string, productId: string): Promise<ProductEngineProfile> {
  return unwrap<ProductEngineProfile>(await rpc("get_product_engine_profile", { _store_id: storeId, _product_id: productId }));
}

export async function updateProductEngineProfile(params: {
  storeId: string;
  productId: string;
  productType: ProductType;
  capabilities: ProductCapabilities;
  pricingRules?: ProductPricingRules;
}): Promise<ProductEngineProfile> {
  return unwrap<ProductEngineProfile>(await rpc("update_product_engine_profile", {
    _store_id: params.storeId,
    _product_id: params.productId,
    _product_type: params.productType,
    _capabilities: params.capabilities,
    _pricing_rules: params.pricingRules ?? {},
  }));
}

export async function getProductInventory(storeId: string, productId: string): Promise<ProductInventory> {
  return unwrap<ProductInventory>(await rpc("get_product_inventory", {
    _store_id: storeId,
    _product_id: productId,
  }));
}

export async function updateProductInventory(params: {
  storeId: string;
  productId: string;
  managed: boolean;
  quantity: number | null;
  lowStockThreshold: number;
  expectedUpdatedAt: string;
}): Promise<ProductInventory> {
  return unwrap<ProductInventory>(await rpc("update_product_inventory_v2", {
    _store_id: params.storeId,
    _product_id: params.productId,
    _managed: params.managed,
    _quantity: params.quantity,
    _low_stock_threshold: params.lowStockThreshold,
    _expected_updated_at: params.expectedUpdatedAt,
  }));
}

export const PRODUCT_TYPE_LABELS: Array<{ type: ProductType; label: string; description: string }> = [
  { type: "simple", label: "Simples", description: "Um preço e poucas escolhas." },
  { type: "variant", label: "Com variações", description: "Tamanhos, volumes ou versões." },
  { type: "buildable", label: "Montável", description: "Cliente monta com grupos de escolhas." },
  { type: "flavors", label: "Com sabores", description: "Escolha de sabor e adicionais." },
  { type: "multi_flavor", label: "Vários sabores", description: "Porções e regra de preço por sabor." },
  { type: "combo", label: "Combo", description: "Etapas obrigatórias com produtos permitidos." },
  { type: "kit", label: "Kit", description: "Pacote ou conjunto de itens." },
  { type: "measured", label: "Peso / volume", description: "Venda por kg, g, L ou ml." },
];

export const CAPABILITY_LABELS: Record<string, string> = {
  sizes: "Tamanhos",
  variants: "Variações",
  flavors: "Sabores",
  multi_flavor: "Vários sabores",
  option_groups: "Grupos de escolha",
  included_choices: "Escolhas incluídas grátis",
  add_ons: "Adicionais",
  removals: "Remoção de ingredientes",
  crust: "Bordas",
  dough: "Massas",
  doneness: "Ponto da carne",
  bread: "Pães",
  sauces: "Molhos",
  sides: "Acompanhamentos",
  beverages: "Bebidas",
  creams: "Cremes",
  fruits: "Frutas",
  toppings: "Coberturas",
  proteins: "Proteínas",
  containers: "Copo / casquinha",
  portions: "Porções",
  combo_steps: "Etapas de combo",
  stock: "Controle de estoque",
  measured: "Peso / volume",
  packages: "Embalagens",
  kits: "Kits",
  volume: "Volumes",
};

export function recommendedCapabilities(profile: CategoryProfile | null, type: ProductType): ProductCapabilities {
  const template = profile?.product_templates.find((item) => item.type === type);
  return { ...(template?.capabilities ?? {}) };
}
