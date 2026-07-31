import { supabase } from "@/integrations/supabase/client";

import type {
  AdvancedBuilder,
  ConfigurationPreview,
  ConfigurationReport,
  MeasurementUnit,
  OptionGroup,
  OptionItem,
  OptionSelectionType,
  PreviewSelection,
  PriceEffect,
  PricingStrategy,
  ProductSaleMode,
  ProductVariant,
  VariantOptionPrice,
} from "./advanced-types";

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("NOT_FOUND");
  return result.data as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

/* ---------------- Construtor ---------------- */

export async function getAdvancedBuilder(
  storeId: string,
  productId: string,
): Promise<AdvancedBuilder> {
  return unwrap<AdvancedBuilder>(
    await rpc("get_product_advanced_builder", { _store_id: storeId, _product_id: productId }),
  );
}

export async function validateConfiguration(
  storeId: string,
  productId: string,
): Promise<ConfigurationReport> {
  return unwrap<ConfigurationReport>(
    await rpc("validate_product_configuration", { _store_id: storeId, _product_id: productId }),
  );
}

/** O preço nunca é calculado no navegador: só exibimos o que o servidor devolveu. */
export async function previewConfiguration(params: {
  storeId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  selections: PreviewSelection[];
}): Promise<ConfigurationPreview> {
  return unwrap<ConfigurationPreview>(
    await rpc("calculate_product_configuration_preview", {
      _store_id: params.storeId,
      _product_id: params.productId,
      _variant_id: params.variantId,
      _quantity: params.quantity,
      _selections: params.selections,
    }),
  );
}

/* ---------------- Modo de venda ---------------- */

export async function updateSaleMode(params: {
  storeId: string;
  productId: string;
  saleMode: ProductSaleMode;
  measurementUnit: MeasurementUnit;
  minimumQuantity: number;
  quantityStep: number;
  expectedUpdatedAt: string;
}): Promise<unknown> {
  return unwrap(
    await rpc("update_product_sale_mode", {
      _store_id: params.storeId,
      _product_id: params.productId,
      _sale_mode: params.saleMode,
      _measurement_unit: params.measurementUnit,
      _minimum_quantity: params.minimumQuantity,
      _quantity_step: params.quantityStep,
      _expected_updated_at: params.expectedUpdatedAt,
    }),
  );
}

/* ---------------- Variações ---------------- */

export async function createVariant(params: {
  storeId: string;
  productId: string;
  name: string;
  price: number;
  packageQuantity: number | null;
  packageUnit: MeasurementUnit | null;
  isDefault: boolean;
}): Promise<ProductVariant> {
  return unwrap<ProductVariant>(
    await rpc("create_product_variant", {
      _store_id: params.storeId,
      _product_id: params.productId,
      _name: params.name,
      _price: params.price,
      _package_quantity: params.packageQuantity,
      _package_unit: params.packageUnit,
      _is_default: params.isDefault,
    }),
  );
}

export async function updateVariant(params: {
  storeId: string;
  id: string;
  name: string;
  price: number;
  packageQuantity: number | null;
  packageUnit: MeasurementUnit | null;
  expectedUpdatedAt: string;
}): Promise<ProductVariant> {
  return unwrap<ProductVariant>(
    await rpc("update_product_variant", {
      _store_id: params.storeId,
      _id: params.id,
      _name: params.name,
      _price: params.price,
      _package_quantity: params.packageQuantity,
      _package_unit: params.packageUnit,
      _expected_updated_at: params.expectedUpdatedAt,
    }),
  );
}

export async function setDefaultVariant(
  storeId: string,
  id: string,
  expectedUpdatedAt: string,
): Promise<ProductVariant> {
  return unwrap<ProductVariant>(
    await rpc("set_default_product_variant", {
      _store_id: storeId,
      _id: id,
      _expected_updated_at: expectedUpdatedAt,
    }),
  );
}

export async function setVariantActive(
  storeId: string,
  id: string,
  isActive: boolean,
  expectedUpdatedAt: string,
): Promise<ProductVariant> {
  return unwrap<ProductVariant>(
    await rpc("set_product_variant_active", {
      _store_id: storeId,
      _id: id,
      _is_active: isActive,
      _expected_updated_at: expectedUpdatedAt,
    }),
  );
}

export async function archiveVariant(
  storeId: string,
  id: string,
  archived: boolean,
  expectedUpdatedAt: string,
): Promise<ProductVariant> {
  return unwrap<ProductVariant>(
    await rpc("archive_product_variant", {
      _store_id: storeId,
      _id: id,
      _archived: archived,
      _expected_updated_at: expectedUpdatedAt,
    }),
  );
}

export async function reorderVariants(
  storeId: string,
  productId: string,
  ids: string[],
): Promise<ProductVariant[]> {
  return unwrap<ProductVariant[]>(
    await rpc("reorder_product_variants", {
      _store_id: storeId,
      _product_id: productId,
      _ids: ids,
    }),
  );
}

/* ---------------- Grupos de opções ---------------- */

export async function listOptionGroups(
  storeId: string | null,
  includeArchived = false,
): Promise<OptionGroup[]> {
  return unwrap<OptionGroup[]>(
    await rpc("list_option_groups", {
      _store_id: storeId,
      _include_archived: includeArchived,
    }),
  );
}

export async function getOptionGroup(storeId: string, id: string): Promise<OptionGroup> {
  return unwrap<OptionGroup>(await rpc("get_option_group", { _store_id: storeId, _id: id }));
}

export interface OptionGroupInput {
  name: string;
  description: string;
  selectionType: OptionSelectionType;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  pricingStrategy: PricingStrategy;
  priceEffect: PriceEffect;
  portionCount: number | null;
}

export async function createOptionGroup(
  storeId: string,
  input: OptionGroupInput,
): Promise<OptionGroup> {
  return unwrap<OptionGroup>(
    await rpc("create_option_group", {
      _store_id: storeId,
      _name: input.name,
      _description: input.description,
      _selection_type: input.selectionType,
      _is_required: input.isRequired,
      _min_selections: input.minSelections,
      _max_selections: input.maxSelections,
      _pricing_strategy: input.pricingStrategy,
      _price_effect: input.priceEffect,
      _portion_count: input.portionCount,
    }),
  );
}

export async function updateOptionGroup(
  storeId: string,
  id: string,
  input: OptionGroupInput,
  expectedUpdatedAt: string,
): Promise<OptionGroup> {
  return unwrap<OptionGroup>(
    await rpc("update_option_group", {
      _store_id: storeId,
      _id: id,
      _name: input.name,
      _description: input.description,
      _selection_type: input.selectionType,
      _is_required: input.isRequired,
      _min_selections: input.minSelections,
      _max_selections: input.maxSelections,
      _pricing_strategy: input.pricingStrategy,
      _price_effect: input.priceEffect,
      _portion_count: input.portionCount,
      _expected_updated_at: expectedUpdatedAt,
    }),
  );
}

export async function setOptionGroupActive(
  storeId: string,
  id: string,
  isActive: boolean,
  expectedUpdatedAt: string,
): Promise<OptionGroup> {
  return unwrap<OptionGroup>(
    await rpc("set_option_group_active", {
      _store_id: storeId,
      _id: id,
      _is_active: isActive,
      _expected_updated_at: expectedUpdatedAt,
    }),
  );
}

export async function archiveOptionGroup(
  storeId: string,
  id: string,
  archived: boolean,
  expectedUpdatedAt: string,
): Promise<OptionGroup> {
  return unwrap<OptionGroup>(
    await rpc("archive_option_group", {
      _store_id: storeId,
      _id: id,
      _archived: archived,
      _expected_updated_at: expectedUpdatedAt,
    }),
  );
}

/* ---------------- Itens ---------------- */

export async function createOptionItem(params: {
  storeId: string;
  groupId: string;
  name: string;
  additionalPrice: number;
  description: string;
  maxQuantity: number;
}): Promise<OptionItem> {
  return unwrap<OptionItem>(
    await rpc("create_option_item", {
      _store_id: params.storeId,
      _option_group_id: params.groupId,
      _name: params.name,
      _additional_price: params.additionalPrice,
      _description: params.description,
      _max_quantity: params.maxQuantity,
    }),
  );
}

export async function updateOptionItem(params: {
  storeId: string;
  id: string;
  name: string;
  additionalPrice: number;
  description: string;
  maxQuantity: number;
  expectedUpdatedAt: string;
}): Promise<OptionItem> {
  return unwrap<OptionItem>(
    await rpc("update_option_item", {
      _store_id: params.storeId,
      _id: params.id,
      _name: params.name,
      _additional_price: params.additionalPrice,
      _description: params.description,
      _max_quantity: params.maxQuantity,
      _expected_updated_at: params.expectedUpdatedAt,
    }),
  );
}

export async function setOptionItemActive(
  storeId: string,
  id: string,
  isActive: boolean,
  expectedUpdatedAt: string,
): Promise<OptionItem> {
  return unwrap<OptionItem>(
    await rpc("set_option_item_active", {
      _store_id: storeId,
      _id: id,
      _is_active: isActive,
      _expected_updated_at: expectedUpdatedAt,
    }),
  );
}

export async function archiveOptionItem(
  storeId: string,
  id: string,
  archived: boolean,
  expectedUpdatedAt: string,
): Promise<OptionItem> {
  return unwrap<OptionItem>(
    await rpc("archive_option_item", {
      _store_id: storeId,
      _id: id,
      _archived: archived,
      _expected_updated_at: expectedUpdatedAt,
    }),
  );
}

export async function reorderOptionItems(
  storeId: string,
  groupId: string,
  ids: string[],
): Promise<OptionGroup> {
  return unwrap<OptionGroup>(
    await rpc("reorder_option_items", {
      _store_id: storeId,
      _option_group_id: groupId,
      _ids: ids,
    }),
  );
}

/* ---------------- Vínculo produto x grupo ---------------- */

export async function attachOptionGroup(
  storeId: string,
  productId: string,
  groupId: string,
): Promise<unknown> {
  return unwrap(
    await rpc("attach_option_group_to_product", {
      _store_id: storeId,
      _product_id: productId,
      _option_group_id: groupId,
    }),
  );
}

export async function detachOptionGroup(
  storeId: string,
  productId: string,
  groupId: string,
): Promise<unknown> {
  return unwrap(
    await rpc("detach_option_group_from_product", {
      _store_id: storeId,
      _product_id: productId,
      _option_group_id: groupId,
    }),
  );
}

export async function reorderProductOptionGroups(
  storeId: string,
  productId: string,
  linkIds: string[],
): Promise<unknown> {
  return unwrap(
    await rpc("reorder_product_option_groups", {
      _store_id: storeId,
      _product_id: productId,
      _ids: linkIds,
    }),
  );
}

/* ---------------- Preços por variação ---------------- */

export async function replaceVariantOptionPrices(
  storeId: string,
  productId: string,
  prices: VariantOptionPrice[],
): Promise<{ saved: number }> {
  return unwrap<{ saved: number }>(
    await rpc("replace_variant_option_prices", {
      _store_id: storeId,
      _product_id: productId,
      _prices: prices,
    }),
  );
}
