import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;

function rpcCaller(client: { rpc: unknown }): RpcCaller {
  return client.rpc as RpcCaller;
}

export interface StoreWhatsAppConsentSummary {
  total_customers: number;
  opted_in: number;
  opted_out: number;
  not_recorded: number;
  latest_change_at: string | null;
}

export interface StoreWhatsAppConsentEntry {
  customer_id: string;
  customer_name: string;
  phone: string;
  opted_in: boolean;
  source: string;
  captured_at: string | null;
  revoked_at: string | null;
  updated_at: string;
}

export interface StoreWhatsAppMessageHistoryEntry {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  recipient_e164: string;
  purpose: "transactional" | "marketing";
  provider: string;
  status: "queued" | "sending" | "sent" | "delivered" | "read" | "failed" | "cancelled";
  queued_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  error_code: string | null;
  error_message: string | null;
}

export interface StoreWhatsAppUsageItem {
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
  limit_action: string | null;
}

export interface StoreWhatsAppUsageSummary {
  period_start: string;
  items: StoreWhatsAppUsageItem[];
}

const storeIdSchema = z.object({ storeId: z.string().uuid() });

export const getStoreWhatsAppConsentSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("get_store_whatsapp_consent_summary", {
      _store_id: data.storeId,
    });
    if (result.error) throw result.error;
    return result.data as StoreWhatsAppConsentSummary;
  });

export const listStoreWhatsAppConsents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ storeId: z.string().uuid(), limit: z.number().int().min(1).max(100).default(20) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("list_store_whatsapp_consents", {
      _store_id: data.storeId,
      _limit: data.limit,
    });
    if (result.error) throw result.error;
    return (result.data ?? []) as StoreWhatsAppConsentEntry[];
  });

export const listStoreWhatsAppMessageHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ storeId: z.string().uuid(), limit: z.number().int().min(1).max(200).default(50) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("list_store_whatsapp_message_history", {
      _store_id: data.storeId,
      _limit: data.limit,
    });
    if (result.error) throw result.error;
    return (result.data ?? []) as StoreWhatsAppMessageHistoryEntry[];
  });

export const getStoreWhatsAppUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("get_my_store_usage_summary", {
      _store_id: data.storeId,
      _period_start: null,
    });
    if (result.error) throw result.error;

    const raw = (result.data ?? { period_start: "", items: [] }) as StoreWhatsAppUsageSummary;
    return {
      period_start: raw.period_start,
      items: (raw.items ?? []).filter((item) => item.feature_code === "whatsapp_automation"),
    } satisfies StoreWhatsAppUsageSummary;
  });
