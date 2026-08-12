import type { PublicProductDetail } from "@/lib/storefront.server";

export type SharkPublicVariant = PublicProductDetail["variants"][number] & {
  flavor_parts: number | null;
};

export type SharkPublicProductDetail = Omit<PublicProductDetail, "variants"> & {
  variants: SharkPublicVariant[];
};

export async function augmentProductWithSharkFlavorStructure(
  slug: string,
  productId: string,
  detail: PublicProductDetail,
): Promise<SharkPublicProductDetail> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const response = await (supabaseAdmin.rpc as any)("storefront_variant_flavor_structure", {
    _slug: slug,
    _product_id: productId,
  });

  if (response?.error) {
    console.warn("[storefront] shark flavor structure unavailable; continuing with legacy limits", response.error.message);
  }

  const rows = Array.isArray(response?.data) ? response.data as Array<Record<string, unknown>> : [];
  const byId = new Map(rows.map((row) => [String(row.id), row]));

  return {
    ...detail,
    variants: detail.variants.map((variant) => {
      const row = byId.get(variant.id);
      return {
        ...variant,
        max_flavors: row?.max_flavors == null ? variant.max_flavors : Number(row.max_flavors),
        flavor_parts: row?.flavor_parts == null
          ? (variant.max_flavors ?? null)
          : Number(row.flavor_parts),
      };
    }),
  };
}
