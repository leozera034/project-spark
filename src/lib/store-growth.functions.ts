import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;

function rpcCaller(client: { rpc: unknown }): RpcCaller {
  return client.rpc as RpcCaller;
}

export type GrowthSegment = "novos" | "recorrentes" | "vip" | "inativos";

export type AutomationEventCode =
  | "novo_cliente"
  | "pedido_criado"
  | "pedido_aceito"
  | "pedido_em_preparo"
  | "pedido_pronto"
  | "pedido_aguardando_entregador"
  | "pedido_saiu_para_entrega"
  | "pedido_aguardando_retirada"
  | "pedido_entregue"
  | "pedido_retirado"
  | "pedido_recusado"
  | "pedido_cancelado"
  | "pedido_concluido"
  | "cliente_inativo_30d"
  | "cliente_vip";

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
  event_code: AutomationEventCode;
  action_code: "sugerir_whatsapp" | "criar_tarefa" | "send_whatsapp_template";
  name: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AutomationVariableDefinition {
  code: string;
  label: string;
}

export interface AutomationEventDefinition {
  code: AutomationEventCode;
  label: string;
  description: string;
  variables: AutomationVariableDefinition[];
}

export interface AutomationTemplateOption {
  id: string;
  name: string;
  code: string;
  purpose: "transactional" | "marketing";
  provider_template_name: string;
  provider_language: string;
  parameter_count: number;
}

export interface AutomationBuilderCatalog {
  events: AutomationEventDefinition[];
  templates: AutomationTemplateOption[];
}

const storeIdSchema = z.object({ storeId: z.string().uuid() });
const automationEventSchema = z.enum([
  "novo_cliente",
  "pedido_criado",
  "pedido_aceito",
  "pedido_em_preparo",
  "pedido_pronto",
  "pedido_aguardando_entregador",
  "pedido_saiu_para_entrega",
  "pedido_aguardando_retirada",
  "pedido_entregue",
  "pedido_retirado",
  "pedido_recusado",
  "pedido_cancelado",
  "pedido_concluido",
  "cliente_inativo_30d",
  "cliente_vip",
]);

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

export const getStoreAutomationBuilderCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => storeIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("get_store_automation_builder_catalog", { _store_id: data.storeId });
    if (result.error) throw result.error;
    return result.data as AutomationBuilderCatalog;
  });

export const saveStoreAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    storeId: z.string().uuid(),
    id: z.string().uuid().nullable().optional(),
    eventCode: automationEventSchema,
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
