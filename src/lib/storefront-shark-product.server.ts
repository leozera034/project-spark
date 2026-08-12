import type { PublicProductDetail } from "@/lib/storefront.server";

export type SharkPublicVariant = PublicProductDetail["variants"][number] & {
  flavor_parts: number | null;
};

export type SharkVariantGroupRule = {
  product_variant_id: string;
  option_group_id: string;
  min_selections: number | null;
  max_selections: number | null;
  included_selections: number | null;
};

export type SharkPublicProductDetail = Omit<PublicProductDetail, "variants"> & {
  variants: SharkPublicVariant[];
  combo_available_choice_ids: string[];
  variant_group_rules: SharkVariantGroupRule[];
};

export async function augmentProductWithSharkFlavorStructure(
  slug: string,
  productId: string,
  detail: PublicProductDetail,
): Promise<SharkPublicProductDetail> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [flavorResponse, comboResponse, groupRulesResponse] = await Promise.all([
    (supabaseAdmin.rpc as any)("storefront_variant_flavor_structure", {
      _slug: slug,
      _product_id: productId,
    }),
    (supabaseAdmin.rpc as any)("storefront_combo_available_choices", {
      _slug: slug,
      _product_id: productId,
    }),
    (supabaseAdmin.rpc as any)("storefront_variant_group_rules", {
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
  if (groupRulesResponse?.error) {
    console.warn("[storefront] shark variant group rules unavailable; continuing with group defaults", groupRulesResponse.error.message);
  }

  const rows = Array.isArray(flavorResponse?.data) ? flavorResponse.data as Array<Record<string, unknown>> : [];
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  const comboAvailable = Array.isArray(comboResponse?.data)
    ? comboResponse.data.map((id: unknown) => String(id))
    : detail.option_groups
        .filter((group) => group.role === "combo_step")
        .flatMap((group) => group.items.map((item) => item.id));

  const variantGroupRules: SharkVariantGroupRule[] = Array.isArray(groupRulesResponse?.data)
    ? (groupRulesResponse.data as Array<Record<string, unknown>>).map((row) => ({
        product_variant_id: String(row.product_variant_id),
        option_group_id: String(row.option_group_id),
        min_selections: row.min_selections == null ? null : Number(row.min_selections),
        max_selections: row.max_selections == null ? null : Number(row.max_selections),
        included_selections: row.included_selections == null ? null : Number(row.included_selections),
      }))
    : [];

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
    variant_group_rules: variantGroupRules,
  };
}
