import type { PublicProductDetail } from "@/lib/storefront.server";

export type SharkPublicVariant = PublicProductDetail["variants"][number] & {
  flavor_parts: number | null;
};

export type SharkPublicProductDetail = Omit<PublicProductDetail, "variants"> & {
  variants: SharkPublicVariant[];
  combo_available_choice_ids: string[];
};

export async function augmentProductWithSharkFlavorStructure(
  slug: string,
  productId: string,
  detail: PublicProductDetail,
): Promise<SharkPublicProductDetail> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [flavorResponse, comboResponse] = await Promise.all([
    (supabaseAdmin.rpc as any)("storefront_variant_flavor_structure", {
      _slug: slug,
      _product_id: productId,
    }),
    (supabaseAdmin.rpc as any)("storefront_combo_available_choices", {
      _slug: slug,
      _product_id: productId,
    }),
  ]);

  if (flavorResponse?.error) {
    console.warn("[storefront] shark flavor structure unavailable; continuing with legacy limits", flavorResponse.error.message);
  }
  if (comboResponse?.error) {
    console.warn("[storefront] shark combo availability unavailable; continuing with projected choices", comboResponse.error.message);
  }

  const rows = Array.isArray(flavorResponse?.data) ? flavorResponse.data as Array<Record<string, unknown>> : [];
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  const comboAvailable = Array.isArray(comboResponse?.data)
    ? comboResponse.data.map((id: unknown) => String(id))
    : detail.option_groups
        .filter((group) => group.role === "combo_step")
        .flatMap((group) => group.items.map((item) => item.id));

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
    combo_available_choice_ids: comboAvailable,
  };
}
