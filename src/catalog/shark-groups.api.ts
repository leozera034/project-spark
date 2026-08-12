import { supabase } from "@/integrations/supabase/client";
import type { OptionGroup, OptionGroupRole, OptionItem } from "./advanced-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("NOT_FOUND");
  return result.data as T;
}

export type ComboCatalogCandidate = {
  id: string;
  name: string;
  base_price: number;
  has_variants: boolean;
  is_available: boolean;
  is_sold_out: boolean;
  variants: Array<{ id: string; name: string; price: number; is_default: boolean }>;
};

export type StarterDraft = {
  group_id: string;
  link_id: string;
  key: string;
  name: string;
  role: OptionGroupRole;
};

export async function createProductStarterGroupDrafts(
  storeId: string,
  productId: string,
): Promise<{ created: StarterDraft[]; created_count: number }> {
  return unwrap(await rpc("create_product_starter_group_drafts", {
    _store_id: storeId,
    _product_id: productId,
  }));
}

export async function updateOptionGroupEngine(params: {
  storeId: string;
  id: string;
  role: OptionGroupRole;
  includedSelections: number;
  configuration?: Record<string, unknown>;
}): Promise<OptionGroup> {
  return unwrap<OptionGroup>(await rpc("update_option_group_engine", {
    _store_id: params.storeId,
    _id: params.id,
    _role: params.role,
    _included_selections: params.includedSelections,
    _configuration: params.configuration ?? {},
  }));
}

export async function updateOptionItemEngine(params: {
  storeId: string;
  id: string;
  linkedProductId?: string | null;
  linkedVariantId?: string | null;
  inventoryQuantity?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<OptionItem> {
  return unwrap<OptionItem>(await rpc("update_option_item_engine", {
    _store_id: params.storeId,
    _id: params.id,
    _linked_product_id: params.linkedProductId ?? null,
    _linked_variant_id: params.linkedVariantId ?? null,
    _inventory_quantity: params.inventoryQuantity ?? null,
    _metadata: params.metadata ?? {},
  }));
}

export async function createProductOptionGroupFromTemplate(params: {
  storeId: string;
  productId: string;
  name: string;
  role: OptionGroupRole;
  required: boolean;
  min: number;
  max: number;
  included?: number;
  selectionType?: "unica" | "multipla" | "quantidade";
  portionCount?: number | null;
  configuration?: Record<string, unknown>;
}): Promise<{ group_id: string; link_id: string }> {
  return unwrap(await rpc("create_product_option_group_from_template", {
    _store_id: params.storeId,
    _product_id: params.productId,
    _name: params.name,
    _role: params.role,
    _required: params.required,
    _min: params.min,
    _max: params.max,
    _included: params.included ?? 0,
    _selection_type: params.selectionType ?? "multipla",
    _portion_count: params.portionCount ?? null,
    _configuration: params.configuration ?? {},
  }));
}

export async function listComboCatalogCandidates(storeId: string, excludeProductId: string): Promise<ComboCatalogCandidate[]> {
  return unwrap<ComboCatalogCandidate[]>(await rpc("list_combo_catalog_candidates", {
    _store_id: storeId,
    _exclude_product_id: excludeProductId,
  }));
}

export async function createComboChoice(params: {
  storeId: string;
  groupId: string;
  name: string;
  linkedProductId: string;
  linkedVariantId?: string | null;
  priceDifference: number;
}): Promise<OptionItem> {
  return unwrap<OptionItem>(await rpc("create_combo_choice", {
    _store_id: params.storeId,
    _group_id: params.groupId,
    _name: params.name,
    _linked_product_id: params.linkedProductId,
    _linked_variant_id: params.linkedVariantId ?? null,
    _price_difference: params.priceDifference,
  }));
}

export const GROUP_ROLE_LABELS: Record<string, string> = {
  generic: "Genérico",
  size: "Tamanho",
  flavor: "Sabor",
  crust: "Borda",
  dough: "Massa",
  addon: "Adicional",
  removal: "Remoção de ingrediente",
  cream: "Creme",
  fruit: "Fruta",
  topping: "Cobertura / complemento",
  protein: "Proteína",
  side: "Acompanhamento",
  bread: "Pão",
  doneness: "Ponto da carne",
  sauce: "Molho",
  beverage: "Bebida",
  container: "Copo / casquinha",
  combo_step: "Etapa de combo",
};
