import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AddonAvailabilityStatus = "planned" | "beta" | "available" | "retired";
export type AddonBillingModel = "flat" | "metered" | "hybrid";
export type AddonSubscriptionStatus =
  | "pending"
  | "trial"
  | "active"
  | "past_due"
  | "grace_period"
  | "suspended"
  | "cancelled"
  | "complimentary";

export interface StoreAddonPrice {
  amount_cents: number;
  currency: string;
  included_units: number | null;
  metering_metric_code: string | null;
  hard_limit_units: number | null;
}

export interface StoreAddonSubscription {
  status: AddonSubscriptionStatus;
  current_period_end: string | null;
  trial_ends_at: string | null;
  grace_until: string | null;
  cancel_at_period_end: boolean;
  complimentary_until: string | null;
}

export interface StoreAddon {
  code: string;
  name: string;
  description: string | null;
  category: string;
  billing_model: AddonBillingModel;
  availability_status: AddonAvailabilityStatus;
  sort_order: number;
  features: string[];
  monthly_price: StoreAddonPrice | null;
  subscription: StoreAddonSubscription | null;
}

export interface StoreAddonsResponse {
  items: StoreAddon[];
}

export interface StoreEntitlementsResponse {
  features: string[];
}

export interface StoreUsageItem {
  provider: string;
  feature_code: string;
  metric_code: string;
  period_start: string;
  period_end: string;
  quantity: number;
  included_units: number | null;
  hard_limit_units: number | null;
  warn_percent: number | null;
  critical_percent: number | null;
  limit_action: "block" | "allow_overage" | "notify_only" | null;
}

export interface StoreUsageSummaryResponse {
  period_start: string;
  items: StoreUsageItem[];
}

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;

const storeIdSchema = z.object({ storeId: z.string().uuid() });

export const getMyStoreAddons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const rpc = context.supabase.rpc as RpcCaller;
    const result = await rpc("get_my_store_addons", { _store_id: data.storeId });
    if (result.error) throw result.error;
    return result.data as StoreAddonsResponse;
  });

export const getMyStoreEntitlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const rpc = context.supabase.rpc as RpcCaller;
    const result = await rpc("get_my_store_entitlements", { _store_id: data.storeId });
    if (result.error) throw result.error;
    return result.data as StoreEntitlementsResponse;
  });

export const getMyStoreUsageSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        storeId: z.string().uuid(),
        periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const rpc = context.supabase.rpc as RpcCaller;
    const result = await rpc("get_my_store_usage_summary", {
      _store_id: data.storeId,
      _period_start: data.periodStart ?? null,
    });
    if (result.error) throw result.error;
    return result.data as StoreUsageSummaryResponse;
  });
