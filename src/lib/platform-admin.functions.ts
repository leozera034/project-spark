import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PlatformHealthSummary {
  totalStores: number;
  activeStores: number;
  suspendedStores: number;
  ordersLast24h: number;
  activeCouriers: number;
  generatedAt: string;
}

export interface PlatformBillingSummary {
  activeSubscriptions: number;
  courtesySubscriptions: number;
  delinquentSubscriptions: number;
  suspendedSubscriptions: number;
  monthlyRecurringRevenue: number;
  paidCurrentMonth: number;
  generatedAt: string;
}

export interface PlatformErrorItem {
  id: string;
  storeId: string | null;
  message: string | null;
  route: string | null;
  source: string | null;
  boundary: string | null;
  createdAt: string;
}

export interface PlatformStoreItem {
  id: string;
  name: string;
  slug: string;
  status: "em_implantacao" | "ativa" | "suspensa" | "inativa";
  total_orders: number;
  created_at: string;
}

export const getPlatformHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase.rpc as any)("get_platform_health_summary");
    if (error) throw error;
    return data as PlatformHealthSummary;
  });

export const getPlatformBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase.rpc as any)("get_platform_billing_summary");
    if (error) throw error;
    return data as PlatformBillingSummary;
  });

export const getPlatformRecentErrors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(d),
  )
  .handler(async ({ data: input, context }) => {
    const { data, error } = await (context.supabase.rpc as any)("get_platform_recent_errors", {
      _limit: input.limit ?? 20,
    });
    if (error) throw error;
    return data as PlatformErrorItem[];
  });

export const listPlatformStores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().max(120).optional(),
        status: z.string().max(40).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data: input, context }) => {
    const { data, error } = await (context.supabase.rpc as any)("list_platform_stores", {
      _search: input.search,
      _status: input.status,
      _limit: input.limit ?? 50,
      _offset: input.offset ?? 0,
    });
    if (error) throw error;
    return data as { items: PlatformStoreItem[]; total: number };
  });

export const adminSuspendStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ storeId: z.string().uuid(), reason: z.string().trim().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.rpc as any)("admin_suspend_store", {
      _store_id: data.storeId,
      _reason: data.reason,
    });
    if (error) throw error;
    return { success: true };
  });

export const adminReactivateStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ storeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.rpc as any)("admin_reactivate_store", {
      _store_id: data.storeId,
    });
    if (error) throw error;
    return { success: true };
  });
