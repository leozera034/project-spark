import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface StoreSmartDeliveryReadiness {
  static_neighborhood_eta_available: boolean;
  static_neighborhood_count: number;
  store_coordinates_set: boolean;
  store_location_source: "unverified" | "manual_browser" | "manual_admin" | "google_geocoding";
  geocoded_customer_addresses: number;
  smart_delivery_entitled: boolean;
  provider: "google_maps";
  api_key_configured: boolean;
  billing_confirmed: boolean;
  routes_api_enabled: boolean;
  geocoding_api_enabled: boolean;
  kill_switch_enabled: boolean;
  provider_ready: boolean;
  local_approximation_ready: boolean;
  ready_for_smart_routes: boolean;
  last_health_at: string | null;
  last_error_code: string | null;
}

export interface StoreDeliveryEstimatePreview {
  available: boolean;
  reason?: string;
  source?: string;
  provider?: string;
  travel_mode?: "drive" | "two_wheeler" | "bicycle" | "walk";
  straight_line_meters?: number;
  distance_meters?: number;
  duration_seconds?: number;
  is_approximate?: boolean;
  smart_delivery_entitled?: boolean;
  provider_ready?: boolean;
  provider_route_available?: boolean;
}

const storeIdSchema = z.string().uuid();
const readinessSchema = z.object({
  static_neighborhood_eta_available: z.boolean(),
  static_neighborhood_count: z.number().int().nonnegative(),
  store_coordinates_set: z.boolean(),
  store_location_source: z.enum(["unverified", "manual_browser", "manual_admin", "google_geocoding"]),
  geocoded_customer_addresses: z.number().int().nonnegative(),
  smart_delivery_entitled: z.boolean(),
  provider: z.literal("google_maps"),
  api_key_configured: z.boolean(),
  billing_confirmed: z.boolean(),
  routes_api_enabled: z.boolean(),
  geocoding_api_enabled: z.boolean(),
  kill_switch_enabled: z.boolean(),
  provider_ready: z.boolean(),
  local_approximation_ready: z.boolean(),
  ready_for_smart_routes: z.boolean(),
  last_health_at: z.string().nullable(),
  last_error_code: z.string().nullable(),
});

const previewSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  source: z.string().optional(),
  provider: z.string().optional(),
  travel_mode: z.enum(["drive", "two_wheeler", "bicycle", "walk"]).optional(),
  straight_line_meters: z.number().int().nonnegative().optional(),
  distance_meters: z.number().int().nonnegative().optional(),
  duration_seconds: z.number().int().nonnegative().optional(),
  is_approximate: z.boolean().optional(),
  smart_delivery_entitled: z.boolean().optional(),
  provider_ready: z.boolean().optional(),
  provider_route_available: z.boolean().optional(),
});

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;

function rpcCaller(client: { rpc: unknown }): RpcCaller {
  return client.rpc as RpcCaller;
}

export const getStoreSmartDeliveryReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ storeId: storeIdSchema }).parse(value))
  .handler(async ({ data, context }) => {
    const rpc = rpcCaller(context.supabase);
    const result = await rpc("get_my_store_smart_delivery_readiness", { _store_id: data.storeId });
    if (result.error) throw result.error;
    return readinessSchema.parse(result.data) satisfies StoreSmartDeliveryReadiness;
  });

export const previewStoreDeliveryEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z.object({
      storeId: storeIdSchema,
      destinationLatitude: z.number().min(-90).max(90),
      destinationLongitude: z.number().min(-180).max(180),
      travelMode: z.enum(["drive", "two_wheeler", "bicycle", "walk"]).default("two_wheeler"),
    }).parse(value),
  )
  .handler(async ({ data, context }) => {
    const rpc = rpcCaller(context.supabase);
    const result = await rpc("preview_store_delivery_estimate", {
      _store_id: data.storeId,
      _destination_latitude: data.destinationLatitude,
      _destination_longitude: data.destinationLongitude,
      _travel_mode: data.travelMode,
    });
    if (result.error) throw result.error;
    return previewSchema.parse(result.data) satisfies StoreDeliveryEstimatePreview;
  });
