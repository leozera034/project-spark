import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StoreBillingStage =
  | "billing_unconfigured"
  | "complimentary"
  | "free"
  | "trial"
  | "full"
  | "notice"
  | "restricted_growth"
  | "restricted_writes"
  | "suspended_orders"
  | "trial_expired";

export interface StoreBillingAccess {
  stage: StoreBillingStage;
  plan_code: string | null;
  subscription_status: string | null;
  overdue_days: number;
  trial_ends_at?: string | null;
  complimentary_until?: string | null;
  grace_until?: string | null;
  current_period_end?: string | null;
  can_accept_new_orders: boolean;
  can_process_existing_orders: boolean;
  can_manage_catalog: boolean;
  can_use_growth: boolean;
  can_manage_billing: boolean;
  can_login: boolean;
}

const inputSchema = z.object({ storeId: z.string().uuid() });

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;

export const getMyStoreBillingAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const rpc = context.supabase.rpc as RpcCaller;
    const result = await rpc("get_my_store_billing_access", { _store_id: data.storeId });
    if (result.error) throw result.error;
    return result.data as StoreBillingAccess;
  });
