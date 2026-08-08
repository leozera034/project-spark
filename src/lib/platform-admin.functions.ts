import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

/**
 * Indicadores globais de saúde do SaaS.
 */
export interface PlatformHealthSummary {
  totalStores: number;
  activeStores: number;
  suspendedStores: number;
  ordersLast24h: number;
  activeCouriers: number;
  generatedAt: string;
}

/**
 * Loja no diretório administrativo.
 */
export interface PlatformStoreItem {
  id: string;
  name: string;
  slug: string;
  status: "em_implantacao" | "ativa" | "suspensa_manual" | "suspensa_pagamento" | "inativa";
  total_orders: number;
  created_at: string;
}

export const getPlatformHealth = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await (supabase.rpc as any)("get_platform_health_summary");
  if (error) throw error;
  return data as PlatformHealthSummary;
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
    z.object({ storeId: z.string().uuid(), reason: z.string().min(1) }).parse(d),
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
