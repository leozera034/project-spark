import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

export type DeliveryPricingMode = "neighborhood" | "fixed" | "radius";

export type DeliveryRadiusBand = {
  id?: string;
  max_distance_km: number;
  delivery_fee: number;
  min_order_amount: number | null;
  eta_minutes: number | null;
  is_active: boolean;
  sort_order?: number;
};

export type DeliveryPricingConfig = {
  store_id: string;
  mode: DeliveryPricingMode;
  fixed_fee: number;
  fixed_min_order_amount: number | null;
  fixed_eta_minutes: number | null;
  radius_bands: DeliveryRadiusBand[];
};

export type DeliveryNeighborhoodDistanceCandidate = {
  name: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  sampleCount: number;
  lastSeenAt: string | null;
  existingNeighborhoodId: string | null;
  existingFee: number | null;
  existingActive: boolean | null;
  source: "customer_history";
};

export type DeliveryNeighborhoodDistancePayload = {
  storeLocationReady: boolean;
  storeLatitude: number | null;
  storeLongitude: number | null;
  items: DeliveryNeighborhoodDistanceCandidate[];
};

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("NOT_FOUND");
  return result.data as T;
}

export async function fetchDeliveryPricingConfig(storeId: string): Promise<DeliveryPricingConfig> {
  return unwrap<DeliveryPricingConfig>(await rpc("get_store_delivery_pricing_config", { _store_id: storeId }));
}

export async function updateDeliveryPricingConfig(input: {
  storeId: string;
  mode: DeliveryPricingMode;
  fixedFee: number;
  fixedMinOrderAmount: number | null;
  fixedEtaMinutes: number | null;
}): Promise<DeliveryPricingConfig> {
  return unwrap<DeliveryPricingConfig>(await rpc("update_store_delivery_pricing_config", {
    _store_id: input.storeId,
    _mode: input.mode,
    _fixed_fee: input.fixedFee,
    _fixed_min_order_amount: input.fixedMinOrderAmount,
    _fixed_eta_minutes: input.fixedEtaMinutes,
  }));
}

export async function replaceDeliveryRadiusBands(
  storeId: string,
  bands: DeliveryRadiusBand[],
): Promise<DeliveryPricingConfig> {
  return unwrap<DeliveryPricingConfig>(await rpc("replace_store_delivery_radius_bands", {
    _store_id: storeId,
    _bands: bands.map((band) => ({
      max_distance_km: band.max_distance_km,
      delivery_fee: band.delivery_fee,
      min_order_amount: band.min_order_amount,
      eta_minutes: band.eta_minutes,
      is_active: band.is_active,
    })),
  }));
}

export async function fetchDeliveryNeighborhoodDistanceCandidates(storeId: string): Promise<DeliveryNeighborhoodDistancePayload> {
  return unwrap<DeliveryNeighborhoodDistancePayload>(await rpc("list_delivery_neighborhood_distance_candidates", { _store_id: storeId }));
}

export async function bulkUpsertDeliveryNeighborhoods(input: {
  storeId: string;
  items: Array<{ name: string; deliveryFee: number; minimumOrderAmount: number | null; estimatedMinutes: number }>;
}): Promise<{ ok: boolean; saved: number }> {
  return unwrap<{ ok: boolean; saved: number }>(await rpc("bulk_upsert_store_neighborhoods", {
    _store_id: input.storeId,
    _items: input.items,
  }));
}
