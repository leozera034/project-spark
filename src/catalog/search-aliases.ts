import { supabase } from "@/integrations/supabase/client";

export type CatalogProductSearchAliases = {
  product_id: string;
  name: string;
  category_id: string;
  category_name: string | null;
  search_aliases: string[];
  updated_at: string;
};

export type CatalogProductSearchAliasPage = {
  items: CatalogProductSearchAliases[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

// As RPCs de aliases são versionadas por migração antes dos tipos gerados.
// O cast fica restrito a esta borda do catálogo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

function unwrap<T>(result: { data: unknown; error: { message?: string } | null }): T {
  if (result.error) throw new Error(result.error.message ?? "SEARCH_ALIAS_OPERATION_FAILED");
  if (result.data == null) throw new Error("NOT_FOUND");
  return result.data as T;
}

export async function searchCatalogProductSearchAliases(params: {
  storeId: string;
  search: string;
  limit?: number;
  offset?: number;
}): Promise<CatalogProductSearchAliasPage> {
  return unwrap<CatalogProductSearchAliasPage>(
    await rpc("search_catalog_product_search_aliases", {
      _store_id: params.storeId,
      _search: params.search,
      _limit: params.limit ?? 50,
      _offset: params.offset ?? 0,
    }),
  );
}

export async function updateCatalogProductSearchAliases(params: {
  storeId: string;
  productId: string;
  aliases: string[];
}): Promise<CatalogProductSearchAliases> {
  return unwrap<CatalogProductSearchAliases>(
    await rpc("update_catalog_product_search_aliases", {
      _store_id: params.storeId,
      _product_id: params.productId,
      _aliases: params.aliases,
    }),
  );
}
