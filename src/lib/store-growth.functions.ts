import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;

function rpcCaller(client: { rpc: unknown }): RpcCaller {
  return client.rpc as RpcCaller;
}

export type GrowthSegment = "novos" | "recorrentes" | "vip" | "inativos";

export interface StoreGrowthSummary {
  customers: number;
  newCustomers30d: number;
  repeatCustomers: number;
  vipCustomers: number;
  inactiveCustomers: number;
  orders30d: number;
  revenue30d: number;
  avgTicket30d: number;
}

export interface CustomerInsight {
  id: string;
  first_name: string;
  phone: string;
  orders_count: number;
  last_order_at: string | null;
  created_at: string;
  lifetime_value: number;
  segment: GrowthSegment;
}

export interface RevenuePoint {
  day: string;
  orders: number;
  revenue: number;
  avg_ticket: number;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  audience: "todos" | GrowthSegment;
  channel: "whatsapp";
  message: string;
  status: "rascunho" | "pronta" | "arquivada";
  created_at: string;
  updated_at: string;
}

export interface AutomationRule {
  id: string;
  event_code: "novo_cliente" | "pedido_concluido" | "cliente_inativo_30d" | "cliente_vip";
  action_code: "sugerir_whatsapp" | "criar_tarefa";
  name: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const storeIdSchema = z.object({ storeId: z.string().uuid() });

export const getStoreGrowthSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => storeIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("get_store_growth_summary", { _store_id: data.storeId });
    if (result.error) throw result.error;
    return result.data as StoreGrowthSummary;
  });

export const listStoreCustomerInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    storeId: z.string().uuid(),
    search: z.string().max(120).optional(),
    segment: z.enum(["novos", "recorrentes", "vip", "inativos"]).optional(),
    limit: z.number().int().min(1).max(200).optional(),
    offset: z.number().int().min(0).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("list_store_customer_insights", {
      _store_id: data.storeId,
      _search: data.search,
      _segment: data.segment,
      _limit: data.limit ?? 100,
      _offset: data.offset ?? 0,
    });
    if (result.error) throw result.error;
    return result.data as { total: number; items: CustomerInsight[] };
  });

export const getStoreRevenueSeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ storeId: z.string().uuid(), days: z.number().int().min(7).max(90).default(30) }).parse(d))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("get_store_revenue_series", { _store_id: data.storeId, _days: data.days });
    if (result.error) throw result.error;
    return (result.data ?? []) as RevenuePoint[];
  });

export const listStoreMarketingCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => storeIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("list_store_marketing_campaigns", { _store_id: data.storeId });
    if (result.error) throw result.error;
    return (result.data ?? []) as MarketingCampaign[];
  });

export const saveStoreMarketingCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    storeId: z.string().uuid(),
    id: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(2).max(120),
    audience: z.enum(["todos", "novos", "recorrentes", "vip", "inativos"]),
    message: z.string().trim().min(1).max(1200),
    status: z.enum(["rascunho", "pronta", "arquivada"]).default("rascunho"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("save_store_marketing_campaign", {
      _store_id: data.storeId,
      _id: data.id ?? null,
      _name: data.name,
      _audience: data.audience,
      _message: data.message,
      _status: data.status,
    });
    if (result.error) throw result.error;
    return { id: result.data as string };
  });

export const listStoreAutomationRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => storeIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("list_store_automation_rules", { _store_id: data.storeId });
    if (result.error) throw result.error;
    return (result.data ?? []) as AutomationRule[];
  });

export const saveStoreAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    storeId: z.string().uuid(),
    id: z.string().uuid().nullable().optional(),
    eventCode: z.enum(["novo_cliente", "pedido_concluido", "cliente_inativo_30d", "cliente_vip"]),
    name: z.string().trim().min(2).max(120),
    enabled: z.boolean(),
    config: z.record(z.string(), z.unknown()).default({}),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("save_store_automation_rule", {
      _store_id: data.storeId,
      _id: data.id ?? null,
      _event_code: data.eventCode,
      _name: data.name,
      _enabled: data.enabled,
      _config: data.config,
    });
    if (result.error) throw result.error;
    return { id: result.data as string };
  });
