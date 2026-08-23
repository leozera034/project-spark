import { supabase } from "@/integrations/supabase/client";

export type CatalogPromotionKind = "percentual" | "valor_fixo";

export interface CatalogPromotion {
  id: string;
  name: string;
  description: string | null;
  kind: CatalogPromotionKind;
  value: number;
  max_discount_amount: number | null;
  product_id: string | null;
  product_name: string | null;
  category_id: string | null;
  category_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  is_archived: boolean;
  runtime_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CatalogPromotionSimulationItem {
  id: string;
  name: string;
  base_price: number;
  unit_cost: number | null;
  discount: number;
  promotional_price: number;
  margin_percent: number | null;
  has_variants: boolean;
}

export interface CatalogPromotionSimulation {
  products: number;
  products_with_cost: number;
  variant_products: number;
  negative_margin_products: number;
  low_margin_products: number;
  minimum_margin_percent: number | null;
  average_margin_percent: number | null;
  items: CatalogPromotionSimulationItem[];
}

export interface CatalogPromotionActivationResult {
  id: string;
  is_active: boolean;
  updated_at: string;
  negative_margin_products?: number;
  margin_risk_acknowledged?: boolean;
}

// RPCs do catálogo evoluem por migração antes do arquivo de tipos gerado.
// Mantemos esta borda local explícita até a próxima regeneração integral do schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

function unwrap<T>(result: { data: unknown; error: { message?: string } | null }): T {
  if (result.error) throw new Error(result.error.message ?? "PROMOTION_OPERATION_FAILED");
  if (result.data == null) throw new Error("NOT_FOUND");
  return result.data as T;
}

export async function listCatalogPromotions(
  storeId: string,
  includeArchived = false,
): Promise<CatalogPromotion[]> {
  return unwrap<CatalogPromotion[]>(
    await rpc("list_my_catalog_promotions", {
      _store_id: storeId,
      _include_archived: includeArchived,
    }),
  );
}

export async function simulateCatalogPromotion(params: {
  storeId: string;
  kind: CatalogPromotionKind;
  value: number;
  maxDiscountAmount: number | null;
  productId: string | null;
  categoryId: string | null;
}): Promise<CatalogPromotionSimulation> {
  return unwrap<CatalogPromotionSimulation>(
    await rpc("simulate_catalog_promotion", {
      _store_id: params.storeId,
      _kind: params.kind,
      _value: params.value,
      _max_discount_amount: params.maxDiscountAmount,
      _product_id: params.productId,
      _category_id: params.categoryId,
    }),
  );
}

export async function createCatalogPromotion(params: {
  storeId: string;
  name: string;
  description: string;
  kind: CatalogPromotionKind;
  value: number;
  maxDiscountAmount: number | null;
  productId: string | null;
  categoryId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  acknowledgeNegativeMargin?: boolean;
}): Promise<CatalogPromotion> {
  return unwrap<CatalogPromotion>(
    await rpc("create_catalog_promotion_v2", {
      _store_id: params.storeId,
      _name: params.name,
      _description: params.description,
      _kind: params.kind,
      _value: params.value,
      _max_discount_amount: params.maxDiscountAmount,
      _product_id: params.productId,
      _category_id: params.categoryId,
      _starts_at: params.startsAt,
      _ends_at: params.endsAt,
      _is_active: params.isActive,
      _acknowledge_negative_margin: params.acknowledgeNegativeMargin ?? false,
    }),
  );
}

export async function setCatalogPromotionActive(
  storeId: string,
  id: string,
  isActive: boolean,
  expectedUpdatedAt: string,
  acknowledgeNegativeMargin = false,
): Promise<CatalogPromotionActivationResult> {
  const args = {
    _store_id: storeId,
    _id: id,
    _is_active: isActive,
    _expected_updated_at: expectedUpdatedAt,
    _acknowledge_negative_margin: acknowledgeNegativeMargin,
  };
  const first = await rpc("set_catalog_promotion_active_v2", args) as {
    data: unknown;
    error: { message?: string } | null;
  };

  if (
    first.error?.message?.includes("PROMOTION_NEGATIVE_MARGIN_ACK_REQUIRED") &&
    isActive &&
    !acknowledgeNegativeMargin &&
    typeof window !== "undefined"
  ) {
    const accepted = window.confirm(
      "Esta promoção deixa pelo menos um produto abaixo do custo cadastrado. Habilitar mesmo assim? Essa decisão reduz margem e pode gerar prejuízo por venda.",
    );
    if (!accepted) throw new Error("PROMOTION_MARGIN_RISK_CANCELLED");
    return unwrap<CatalogPromotionActivationResult>(
      await rpc("set_catalog_promotion_active_v2", {
        ...args,
        _acknowledge_negative_margin: true,
      }),
    );
  }

  return unwrap<CatalogPromotionActivationResult>(first);
}

export async function archiveCatalogPromotion(
  storeId: string,
  id: string,
  expectedUpdatedAt: string,
): Promise<{ id: string; is_archived: boolean; updated_at: string }> {
  return unwrap(
    await rpc("archive_catalog_promotion", {
      _store_id: storeId,
      _id: id,
      _expected_updated_at: expectedUpdatedAt,
    }),
  );
}
