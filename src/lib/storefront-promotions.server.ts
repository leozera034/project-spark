import type { PublicCatalog } from "@/lib/storefront.server";
import { priceInputSchema, type PriceInput } from "@/lib/storefront.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type PublicPromotion = {
  id: string;
  name: string;
  kind: "percentual" | "valor_fixo";
  value: number;
  max_discount_amount: number | null;
  discount_total: number;
  scope: "store" | "category" | "product";
};

export type PromotionalPriceResult = {
  ok: boolean;
  error?: string;
  total?: number;
  original_total?: number;
  discount_total?: number;
  unit_price?: number;
  base_total?: number;
  options_total?: number;
  promotion?: PublicPromotion | null;
  validation_errors?: string[];
};

type PromotionPreview = { product_id: string; promotion: PublicPromotion };

type RpcResult = { data: unknown; error: { message: string } | null };

async function callPromotionRpc(name: string, args: Record<string, unknown>): Promise<RpcResult> {
  const db = await admin();
  // As RPCs promocionais já estão versionadas por migração antes do arquivo
  // gerado de tipos. O cast fica exclusivamente nesta borda server-only.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = db.rpc.bind(db) as any;
  return rpc(name, args) as Promise<RpcResult>;
}

export async function decorateCatalogWithPromotions(
  rawSlug: string,
  catalog: PublicCatalog,
): Promise<PublicCatalog> {
  const { data, error } = await callPromotionRpc("storefront_active_promotions", { _slug: rawSlug });
  if (error || !data) {
    if (error) console.error("[storefront] promotions preview failed", error.message);
    return catalog;
  }

  const payload = data as Record<string, unknown>;
  const previews = ((payload.products ?? []) as PromotionPreview[]).filter(
    (entry) => entry?.product_id && entry?.promotion,
  );
  if (previews.length === 0) return catalog;

  const byProduct = new Map(previews.map((entry) => [entry.product_id, entry.promotion] as const));

  return {
    ...catalog,
    products: catalog.products.map((product) => {
      const promotion = byProduct.get(product.id);
      if (!promotion) return product;

      const discount = Math.max(0, Number(promotion.discount_total ?? 0));
      const currentReference = product.has_variants && product.from_price !== null
        ? Number(product.from_price)
        : Number(product.base_price);
      const promotionalReference = Math.max(0, currentReference - discount);

      // O card recebe um preview de merchandising, mas o cálculo final continua
      // exclusivamente no servidor via storefront_price_with_promotions.
      return {
        ...product,
        original_base_price: Number(product.base_price),
        original_from_price: product.from_price === null ? null : Number(product.from_price),
        promotion_id: promotion.id,
        promotion_name: promotion.name,
        promotion_kind: promotion.kind,
        promotion_value: Number(promotion.value),
        promotion_discount_total: discount,
        promotion_scope: promotion.scope,
        base_price: product.has_variants ? product.base_price : promotionalReference,
        from_price: product.has_variants ? promotionalReference : product.from_price,
      };
    }),
  };
}

export async function computePromotionalPublicPrice(input: PriceInput): Promise<PromotionalPriceResult> {
  const parsed = priceInputSchema.parse(input);
  const { data, error } = await callPromotionRpc("storefront_price_with_promotions", {
    _slug: parsed.slug,
    _product_id: parsed.product_id,
    _variant_id: parsed.variant_id ?? undefined,
    _quantity: parsed.quantity,
    _selections: parsed.selections,
  });

  if (error) {
    console.error("[storefront] promotional price rpc failed", error.message);
    return { ok: false, error: "unavailable" };
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  if (!payload.ok) return { ok: false, error: String(payload.error ?? "invalid_request") };

  const result = (payload.result ?? {}) as Record<string, unknown>;
  const validation = Array.isArray(result.validation_errors)
    ? result.validation_errors.map((code: unknown) => String(code))
    : [];
  if (validation.length > 0 || result.final_total === null || result.final_total === undefined) {
    return { ok: false, error: "invalid_configuration", validation_errors: validation };
  }

  const rawPromotion = result.promotion as Record<string, unknown> | null | undefined;
  const promotion: PublicPromotion | null = rawPromotion
    ? {
        id: String(rawPromotion.id ?? ""),
        name: String(rawPromotion.name ?? "Promoção"),
        kind: String(rawPromotion.kind ?? "percentual") === "valor_fixo" ? "valor_fixo" : "percentual",
        value: Number(rawPromotion.value ?? 0),
        max_discount_amount:
          rawPromotion.max_discount_amount === null || rawPromotion.max_discount_amount === undefined
            ? null
            : Number(rawPromotion.max_discount_amount),
        discount_total: Number(rawPromotion.discount_total ?? result.discount_total ?? 0),
        scope:
          rawPromotion.scope === "product" || rawPromotion.scope === "category"
            ? rawPromotion.scope
            : "store",
      }
    : null;

  return {
    ok: true,
    total: Number(result.final_total ?? 0),
    original_total: Number(result.original_total ?? result.final_total ?? 0),
    discount_total: Number(result.discount_total ?? 0),
    unit_price: Number(result.final_unit_price ?? result.base_price ?? 0),
    base_total: Number(result.base_total ?? 0),
    options_total: Number(result.additive_groups_total ?? 0),
    promotion,
    validation_errors: [],
  };
}
