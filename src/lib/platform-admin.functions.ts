import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

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

export const getPlatformHealth = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await (supabase.rpc as any)("get_platform_health_summary");
  if (error) throw error;
  return data as PlatformHealthSummary;
});

export const getPlatformBilling = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await (supabase.rpc as any)("get_platform_billing_summary");
  if (error) throw error;
  return data as PlatformBillingSummary;
});

export const getPlatformRecentErrors = createServerFn({ method: "GET" })
  .validator((d: { limit?: number }) => z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(d))
  .handler(async ({ data: input }) => {
    const { data, error } = await (supabase.rpc as any)("get_platform_recent_errors", {
      _limit: input.limit ?? 20,
    });
    if (error) throw error;
    return data as PlatformErrorItem[];
  });

export const listPlatformStores = createServerFn({ method: "GET" })
  .validator((d: { search?: string; status?: string; limit?: number; offset?: number }) => d)
  .handler(async ({ data: input }) => {
    const { data, error } = await (supabase.rpc as any)("list_platform_stores", {
      _search: input.search,
      _status: input.status,
      _limit: input.limit || 50,
      _offset: input.offset || 0,
    });
    if (error) throw error;
    return data as { items: PlatformStoreItem[]; total: number };
  });

export const adminSuspendStore = createServerFn({ method: "POST" })
  .validator((d: { storeId: string; reason: string }) =>
    z.object({ storeId: z.string().uuid(), reason: z.string().trim().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await (supabase.rpc as any)("admin_suspend_store", {
      _store_id: data.storeId,
      _reason: data.reason,
    });
    if (error) throw error;
    return { success: true };
  });

export const adminReactivateStore = createServerFn({ method: "POST" })
  .validator((d: { storeId: string }) => z.object({ storeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await (supabase.rpc as any)("admin_reactivate_store", {
      _store_id: data.storeId,
    });
    if (error) throw error;
    return { success: true };
  });
