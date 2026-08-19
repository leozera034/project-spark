import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SmartDeliveryProvider = "openrouteservice" | "google_maps";
export type SmartDeliveryLocationSource =
  | "unverified"
  | "manual_browser"
  | "manual_admin"
  | "google_geocoding"
  | "openrouteservice_geocoding";

export interface StoreSmartDeliveryReadiness {
  static_neighborhood_eta_available: boolean;
  static_neighborhood_count: number;
  store_coordinates_set: boolean;
  store_location_source: SmartDeliveryLocationSource;
  geocoded_customer_addresses: number;
  smart_delivery_entitled: boolean;
  provider: SmartDeliveryProvider;
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

export type SmartDeliveryOverallStatus = "ready" | "partial" | "paused" | "blocked";
export type SmartDeliveryMetricCode = "routes.compute" | "geocoding.address";

export interface SmartDeliveryUsageItem {
  provider: SmartDeliveryProvider;
  metric_code: SmartDeliveryMetricCode;
  period_start: string;
  period_end: string;
  quantity: number;
  included_units: number | null;
  hard_limit_units: number | null;
  warn_percent: number | null;
  critical_percent: number | null;
  limit_action: string | null;
  provider_cost_micros: number;
  customer_charge_micros: number;
  next_unit_allowed: boolean;
}

export interface SmartDeliveryRecentIssue {
  job_type: "geocode_address" | "compute_delivery_route";
  status: "retry" | "failed" | "cancelled";
  attempts: number;
  max_attempts: number;
  error_code: string | null;
  updated_at: string;
}

export interface StoreSmartDeliveryControlCenter {
  store_id: string;
  overall_status: SmartDeliveryOverallStatus;
  smart_delivery_entitled: boolean;
  store: {
    coordinates_set: boolean;
    location_source: SmartDeliveryLocationSource;
    local_approximation_ready: boolean;
  };
  control: {
    is_paused: boolean;
    pause_reason: string | null;
    paused_at: string | null;
    version: number;
  };
  provider: {
    code: SmartDeliveryProvider;
    api_key_configured: boolean;
    billing_confirmed: boolean;
    routes_api_enabled: boolean;
    geocoding_api_enabled: boolean;
    global_kill_switch_enabled: boolean;
    routes_provider_ready: boolean;
    geocoding_provider_ready: boolean;
    last_health_at: string | null;
    last_error_code: string | null;
  };
  capabilities: {
    routes_ready: boolean;
    geocoding_ready: boolean;
  };
  usage: {
    period_start: string;
    period_end: string;
    items: SmartDeliveryUsageItem[];
  };
  cost_tracking: {
    provider_cost_micros: number;
    customer_charge_micros: number;
    reconciliation_pending: boolean;
  };
  jobs: {
    queued: number;
    processing: number;
    retry: number;
    completed: number;
    failed: number;
    cancelled: number;
    oldest_pending_at: string | null;
    stale_processing: number;
    recent_issues: SmartDeliveryRecentIssue[];
  };
  diagnostics: string[];
}

export interface StoreSmartDeliveryPauseResult {
  store_id: string;
  is_paused: boolean;
  pause_reason: string | null;
  paused_at: string | null;
  version: number;
  cancelled_pending_jobs: number;
}

const storeIdSchema = z.string().uuid();
const smartDeliveryProviderSchema = z.enum(["openrouteservice", "google_maps"]);
const smartDeliveryLocationSourceSchema = z.enum([
  "unverified",
  "manual_browser",
  "manual_admin",
  "google_geocoding",
  "openrouteservice_geocoding",
]);

const readinessSchema = z.object({
  static_neighborhood_eta_available: z.boolean(),
  static_neighborhood_count: z.number().int().nonnegative(),
  store_coordinates_set: z.boolean(),
  store_location_source: smartDeliveryLocationSourceSchema,
  geocoded_customer_addresses: z.number().int().nonnegative(),
  smart_delivery_entitled: z.boolean(),
  provider: smartDeliveryProviderSchema,
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

const usageItemSchema = z.object({
  provider: smartDeliveryProviderSchema,
  metric_code: z.enum(["routes.compute", "geocoding.address"]),
  period_start: z.string(),
  period_end: z.string(),
  quantity: z.number().nonnegative(),
  included_units: z.number().nonnegative().nullable(),
  hard_limit_units: z.number().nonnegative().nullable(),
  warn_percent: z.number().int().min(0).max(100).nullable(),
  critical_percent: z.number().int().min(0).max(100).nullable(),
  limit_action: z.string().nullable(),
  provider_cost_micros: z.number().int().nonnegative(),
  customer_charge_micros: z.number().int().nonnegative(),
  next_unit_allowed: z.boolean(),
});

const recentIssueSchema = z.object({
  job_type: z.enum(["geocode_address", "compute_delivery_route"]),
  status: z.enum(["retry", "failed", "cancelled"]),
  attempts: z.number().int().nonnegative(),
  max_attempts: z.number().int().positive(),
  error_code: z.string().nullable(),
  updated_at: z.string(),
});

const controlCenterSchema = z.object({
  store_id: z.string().uuid(),
  overall_status: z.enum(["ready", "partial", "paused", "blocked"]),
  smart_delivery_entitled: z.boolean(),
  store: z.object({
    coordinates_set: z.boolean(),
    location_source: smartDeliveryLocationSourceSchema,
    local_approximation_ready: z.boolean(),
  }),
  control: z.object({
    is_paused: z.boolean(),
    pause_reason: z.string().nullable(),
    paused_at: z.string().nullable(),
    version: z.number().int().nonnegative(),
  }),
  provider: z.object({
    code: smartDeliveryProviderSchema,
    api_key_configured: z.boolean(),
    billing_confirmed: z.boolean(),
    routes_api_enabled: z.boolean(),
    geocoding_api_enabled: z.boolean(),
    global_kill_switch_enabled: z.boolean(),
    routes_provider_ready: z.boolean(),
    geocoding_provider_ready: z.boolean(),
    last_health_at: z.string().nullable(),
    last_error_code: z.string().nullable(),
  }),
  capabilities: z.object({
    routes_ready: z.boolean(),
    geocoding_ready: z.boolean(),
  }),
  usage: z.object({
    period_start: z.string(),
    period_end: z.string(),
    items: z.array(usageItemSchema),
  }),
  cost_tracking: z.object({
    provider_cost_micros: z.number().int().nonnegative(),
    customer_charge_micros: z.number().int().nonnegative(),
    reconciliation_pending: z.boolean(),
  }),
  jobs: z.object({
    queued: z.number().int().nonnegative(),
    processing: z.number().int().nonnegative(),
    retry: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
    oldest_pending_at: z.string().nullable(),
    stale_processing: z.number().int().nonnegative(),
    recent_issues: z.array(recentIssueSchema),
  }),
  diagnostics: z.array(z.string()),
});

const pauseResultSchema = z.object({
  store_id: z.string().uuid(),
  is_paused: z.boolean(),
  pause_reason: z.string().nullable(),
  paused_at: z.string().nullable(),
  version: z.number().int().positive(),
  cancelled_pending_jobs: z.number().int().nonnegative(),
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

export const getStoreSmartDeliveryControlCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ storeId: storeIdSchema }).parse(value))
  .handler(async ({ data, context }) => {
    const { invokePediuBackendAction } = await import("@/integrations/supabase/client.server");
    const payload = await invokePediuBackendAction<StoreSmartDeliveryControlCenter>(
      { action: "get_smart_delivery_control_center", input: { storeId: data.storeId } },
      { accessToken: context.accessToken },
    );
    return controlCenterSchema.parse(payload) satisfies StoreSmartDeliveryControlCenter;
  });

export const setStoreSmartDeliveryPause = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z.object({
      storeId: storeIdSchema,
      paused: z.boolean(),
      reason: z.string().trim().max(240).nullable().optional(),
    }).parse(value),
  )
  .handler(async ({ data, context }) => {
    const { invokePediuBackendAction } = await import("@/integrations/supabase/client.server");
    const payload = await invokePediuBackendAction<StoreSmartDeliveryPauseResult>(
      {
        action: "set_smart_delivery_pause",
        input: { storeId: data.storeId, paused: data.paused, reason: data.paused ? data.reason ?? null : null },
      },
      { accessToken: context.accessToken },
    );
    return pauseResultSchema.parse(payload) satisfies StoreSmartDeliveryPauseResult;
  });
