import { supabase } from "@/integrations/supabase/client";
import type { ProductVariant } from "./advanced-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

/** @deprecated Use ProductVariant; kept as a source-compatible alias for older callers. */
export type SharkFlavorVariant = ProductVariant;

export async function updateVariantFlavorStructure(params: {
  storeId: string;
  id: string;
  maxFlavors: number | null;
  flavorParts: number | null;
  expectedUpdatedAt: string;
}): Promise<ProductVariant> {
  const result = await rpc("update_variant_flavor_structure", {
    _store_id: params.storeId,
    _id: params.id,
    _max_flavors: params.maxFlavors,
    _flavor_parts: params.flavorParts,
    _expected_updated_at: params.expectedUpdatedAt,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data as ProductVariant;
}

/** Compatibilidade com telas/chamadores antigos. */
export async function updateVariantFlavorLimit(params: {
  storeId: string;
  id: string;
  maxFlavors: number | null;
  expectedUpdatedAt: string;
}): Promise<ProductVariant> {
  const result = await rpc("update_variant_flavor_limit", {
    _store_id: params.storeId,
    _id: params.id,
    _max_flavors: params.maxFlavors,
    _expected_updated_at: params.expectedUpdatedAt,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data as ProductVariant;
}
