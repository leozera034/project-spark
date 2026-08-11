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

export const SALE_MODE_LABELS: Record<ProductSaleMode, string> = {
  unit: "Por unidade",
  measured: "Por peso ou volume",
  fixed_package: "Embalagens de peso fixo",
};

export const MEASUREMENT_LABELS: Record<MeasurementUnit, string> = {
  unit: "unidade",
  kg: "quilo (kg)",
  g: "grama (g)",
  l: "litro (L)",
  ml: "mililitro (ml)",
};

export const MEASUREMENT_SHORT: Record<MeasurementUnit, string> = {
  unit: "un", kg: "kg", g: "g", l: "L", ml: "ml",
};

export const SELECTION_TYPE_LABELS: Record<OptionSelectionType, string> = {
  unica: "Escolha única", multipla: "Escolha múltipla", quantidade: "Escolha por quantidade",
};

export const PRICING_STRATEGY_LABELS: Record<PricingStrategy, string> = {
  sum: "Somar os itens escolhidos",
  highest_price: "Cobrar o item mais caro",
  average_price: "Média proporcional dos itens",
};

export const PRICE_EFFECT_LABELS: Record<PriceEffect, string> = {
  additive: "Somar ao preço do produto", replace_base: "Substituir o preço do produto",
};

export const CONFIGURATION_MESSAGES: Record<string, string> = {
  PRODUCT_NOT_FOUND: "Produto indisponível.",
  PRODUCT_UNAVAILABLE: "Este produto está indisponível.",
  PRODUCT_STOCK_INSUFFICIENT: "Quantidade maior que o estoque disponível.",
  BASE_PRICE_INVALID: "O preço base do produto é inválido.",
  CATEGORY_UNAVAILABLE: "A categoria do produto está inativa ou arquivada.",
  DEFAULT_VARIANT_REQUIRED: "Escolha exatamente uma variação padrão entre as ativas.",
  MEASUREMENT_UNIT_REQUIRED: "Escolha a unidade de medida da venda por peso ou volume.",
  MINIMUM_QUANTITY_INVALID: "A quantidade mínima precisa ser maior que zero.",
  QUANTITY_STEP_INVALID: "O incremento de quantidade precisa ser maior que zero.",
  MEASURED_WITH_VARIANTS: "Venda por peso não aceita variações ativas.",
  PACKAGES_REQUIRED: "Cadastre ao menos uma embalagem ativa.",
  PACKAGE_DETAILS_REQUIRED: "Toda embalagem ativa precisa de quantidade e unidade.",
  MULTIPLE_REPLACE_BASE: "Apenas um grupo pode substituir o preço do produto.",
  GROUP_WITHOUT_ITEMS: "Há grupo obrigatório sem nenhum item ativo.",
  GROUP_MINIMUM_UNREACHABLE: "Um grupo pede mais itens do que os itens ativos disponíveis.",
  GROUP_REQUIRED_WITHOUT_MINIMUM: "Grupo obrigatório precisa de mínimo de pelo menos 1.",
  VARIANT_OPTION_PRICES_INCOMPLETE: "Faltam preços por variação em um grupo que substitui o preço do produto.",
  VARIANT_INVALID: "A variação escolhida não está disponível.",
  VARIANT_REQUIRED: "Escolha uma variação.",
  PACKAGE_REQUIRED: "Escolha uma embalagem.",
  QUANTITY_INVALID: "Quantidade inválida.",
  QUANTITY_BELOW_MINIMUM: "Quantidade abaixo do mínimo do produto.",
  QUANTITY_STEP_INVALID_SEL: "Quantidade fora do incremento permitido.",
  OPTION_INVALID: "Há uma opção escolhida que não está disponível.",
  OPTION_DUPLICATED: "A mesma opção foi escolhida duas vezes.",
  OPTION_QUANTITY_INVALID: "Quantidade de opção inválida.",
  OPTION_QUANTITY_ABOVE_MAX: "Quantidade de opção acima do máximo permitido.",
  OPTION_STOCK_INSUFFICIENT: "Uma opção escolhida está sem estoque suficiente.",
  COMBO_ITEM_UNAVAILABLE: "Uma opção do combo ficou indisponível.",
  PORTIONS_INCOMPLETE: "Complete todas as porções do grupo.",
  SELECTION_BELOW_MINIMUM: "Escolha a quantidade mínima de itens do grupo.",
  SELECTION_ABOVE_MAXIMUM: "Você escolheu itens demais neste grupo.",
};

export function configurationMessage(code: string): string {
  return CONFIGURATION_MESSAGES[code] ?? code;
}

export function describeVariant(variant: ProductVariant): string {
  if (variant.package_quantity && variant.package_unit) return `${variant.name} · ${variant.package_quantity} ${MEASUREMENT_SHORT[variant.package_unit]}`;
  return variant.name;
}
