/**
 * Motor avançado do catálogo / SHARK.
 * A categoria da loja fornece defaults; o comportamento final é do produto.
 */

export type ProductSaleMode = "unit" | "measured" | "fixed_package";
export type MeasurementUnit = "unit" | "kg" | "g" | "l" | "ml";
export type OptionSelectionType = "unica" | "multipla" | "quantidade";
export type PricingStrategy = "sum" | "highest_price" | "average_price";
export type PriceEffect = "additive" | "replace_base";
export type ProductType =
  | "simple"
  | "variant"
  | "buildable"
  | "flavors"
  | "multi_flavor"
  | "combo"
  | "kit"
  | "sized"
  | "measured"
  | string;

export type ProductCapabilities = Record<string, boolean | number | string | null>;
export type ProductPricingRules = {
  multi_flavor_pricing?: "highest" | "average" | "proportional" | "fixed_size";
  [key: string]: unknown;
};

export type OptionGroupRole =
  | "generic"
  | "size"
  | "flavor"
  | "crust"
  | "dough"
  | "addon"
  | "removal"
  | "cream"
  | "fruit"
  | "topping"
  | "protein"
  | "side"
  | "bread"
  | "doneness"
  | "sauce"
  | "beverage"
  | "container"
  | "portion"
  | "ice"
  | "combo_step"
  | string;

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  price: number;
  is_default: boolean;
  is_active: boolean;
  is_archived: boolean;
  sort_order: number;
  package_quantity: number | null;
  package_unit: MeasurementUnit | null;
  max_flavors: number | null;
  flavor_parts: number | null;
  updated_at: string;
}

export interface OptionItem {
  id: string;
  option_group_id: string;
  name: string;
  description: string | null;
  additional_price: number;
  max_quantity: number;
  is_active: boolean;
  is_archived: boolean;
  sort_order: number;
  updated_at: string;
  linked_product_id?: string | null;
  linked_variant_id?: string | null;
  inventory_quantity?: number | null;
  metadata?: Record<string, unknown>;
}

export interface OptionGroup {
  id: string;
  name: string;
  description: string | null;
  role: OptionGroupRole;
  selection_type: OptionSelectionType;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  included_selections: number;
  pricing_strategy: PricingStrategy;
  price_effect: PriceEffect;
  portion_count: number | null;
  configuration: Record<string, unknown>;
  is_active: boolean;
  is_archived: boolean;
  sort_order: number;
  updated_at: string;
  linked_product_count: number;
  items: OptionItem[];
}

export interface LinkedOptionGroup extends OptionGroup {
  link_id: string;
  link_sort_order: number;
  link_is_active: boolean;
}

export interface VariantOptionPrice {
  variant_id: string;
  item_id: string;
  price: number;
}

export interface ConfigurationReport {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AdvancedBuilder {
  product: {
    id: string;
    name: string;
    base_price: number;
    is_active: boolean;
    is_archived: boolean;
    updated_at: string;
    sale_mode: ProductSaleMode;
    measurement_unit: MeasurementUnit;
    minimum_quantity: number;
    quantity_step: number;
    product_type?: ProductType;
    capabilities?: ProductCapabilities;
    pricing_rules?: ProductPricingRules;
    engine_version?: number;
  };
  variants: ProductVariant[];
  groups: LinkedOptionGroup[];
  variant_option_prices: VariantOptionPrice[];
  validation: ConfigurationReport;
  can: { view: boolean; create: boolean; update: boolean; archive: boolean };
}

export interface PreviewSelection {
  group_id: string;
  items: { item_id: string; quantity: number }[];
}

export interface PreviewBreakdownRow {
  group_id: string;
  group_name: string;
  role?: OptionGroupRole;
  pricing_strategy: PricingStrategy;
  price_effect: PriceEffect | string;
  included_selections?: number;
  selected_items: number;
  selected_quantity: number;
  value: number;
}

export interface ConfigurationPreview {
  product_id: string;
  product_type?: ProductType;
  engine_version?: number;
  variant_id: string | null;
  sale_mode: ProductSaleMode;
  measurement_unit: MeasurementUnit;
  quantity: number;
  base_price: number;
  base_total: number;
  replacement_group_total: number | null;
  additive_groups_total: number;
  final_unit_price: number;
  final_total: number | null;
  breakdown: PreviewBreakdownRow[];
  validation_errors: string[];
}
