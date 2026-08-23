import { supabase } from "@/integrations/supabase/client";

export type CatalogProductCategoryPlacement = {
  product_id: string;
  primary_category_id: string;
  additional_category_ids: string[];
  category_ids: string[];
};

// As RPCs de placements evoluem por migração antes do arquivo de tipos gerado.
// O cast fica restrito a esta borda do catálogo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

function unwrap<T>(result: { data: unknown; error: { message?: string } | null }): T {
  if (result.error) throw new Error(result.error.message ?? "CATEGORY_PLACEMENT_OPERATION_FAILED");
  if (result.data == null) throw new Error("NOT_FOUND");
  return result.data as T;
}

export async function listCatalogProductCategoryPlacements(
  storeId: string,
): Promise<CatalogProductCategoryPlacement[]> {
  return unwrap<CatalogProductCategoryPlacement[]>(
    await rpc("list_catalog_product_category_placements", { _store_id: storeId }),
  );
}

export async function setCatalogProductCategoryPlacements(params: {
  storeId: string;
  productId: string;
  categoryIds: string[];
}): Promise<CatalogProductCategoryPlacement> {
  return unwrap<CatalogProductCategoryPlacement>(
    await rpc("set_catalog_product_category_placements", {
      _store_id: params.storeId,
      _product_id: params.productId,
      _category_ids: params.categoryIds,
    }),
  );
}
