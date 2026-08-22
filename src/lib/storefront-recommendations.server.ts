import { z } from "zod";

import { slugSchema } from "@/lib/storefront.server";

export const storefrontRecommendationInputSchema = z.object({
  slug: slugSchema,
  productIds: z.array(z.string().uuid()).max(20).default([]),
});

export type StorefrontRecommendationResult = {
  productIds: string[];
  source: "copurchase" | "bestseller_fallback";
};

export async function loadStorefrontRecommendations(
  rawSlug: string,
  rawProductIds: string[],
): Promise<StorefrontRecommendationResult> {
  const input = storefrontRecommendationInputSchema.parse({
    slug: rawSlug,
    productIds: Array.from(new Set(rawProductIds)).slice(0, 20),
  });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("storefront_product_recommendations", {
    _slug: input.slug,
    _product_ids: input.productIds,
  });

  if (error) {
    console.error("[storefront] recommendations rpc failed", error.message);
    throw new Error("recommendations_unavailable");
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  const productIds = Array.isArray(payload.product_ids)
    ? payload.product_ids.filter((id): id is string => typeof id === "string").slice(0, 6)
    : [];
  const source = payload.source === "copurchase" ? "copurchase" : "bestseller_fallback";

  return { productIds, source };
}
