import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;

function rpcCaller(client: { rpc: unknown }): RpcCaller {
  return client.rpc as RpcCaller;
}

export interface StoreWhatsAppReadiness {
  assisted_available: boolean;
  automatic_entitled: boolean;
  provider_connected: boolean;
  provider: "meta_whatsapp" | "360dialog_whatsapp" | "twilio_whatsapp" | null;
  templates_total: number;
  templates_approved: number;
  ready_for_automatic: boolean;
}

export interface StoreMessageTemplate {
  id: string;
  code: string;
  name: string;
  channel: "whatsapp";
  purpose: "transactional" | "marketing";
  body: string;
  provider_template_name: string | null;
  provider_language: string;
  provider_status: "draft" | "pending" | "approved" | "rejected";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const storeIdSchema = z.object({ storeId: z.string().uuid() });

export const getStoreWhatsAppReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("get_store_whatsapp_readiness", {
      _store_id: data.storeId,
    });
    if (result.error) throw result.error;
    return result.data as StoreWhatsAppReadiness;
  });

export const listStoreMessageTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("list_store_message_templates", {
      _store_id: data.storeId,
    });
    if (result.error) throw result.error;
    return (result.data ?? []) as StoreMessageTemplate[];
  });

export const saveStoreMessageTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      storeId: z.string().uuid(),
      id: z.string().uuid().nullable().optional(),
      code: z.string().trim().min(2).max(80).regex(/^[a-z0-9_.-]+$/),
      name: z.string().trim().min(2).max(120),
      purpose: z.enum(["transactional", "marketing"]),
      body: z.string().trim().min(1).max(4096),
      providerTemplateName: z.string().trim().max(512).nullable().optional(),
      providerLanguage: z.string().trim().min(2).max(20).default("pt_BR"),
      isActive: z.boolean().default(true),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("save_store_message_template", {
      _store_id: data.storeId,
      _id: data.id ?? null,
      _code: data.code,
      _name: data.name,
      _purpose: data.purpose,
      _body: data.body,
      _provider_template_name: data.providerTemplateName ?? null,
      _provider_language: data.providerLanguage,
      _provider_status: "draft",
      _is_active: data.isActive,
    });
    if (result.error) throw result.error;
    return { id: result.data as string };
  });

export const setCustomerWhatsAppMarketingConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      storeId: z.string().uuid(),
      customerId: z.string().uuid(),
      optedIn: z.boolean(),
      source: z.string().trim().min(1).max(80).default("manual"),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("set_customer_whatsapp_marketing_consent", {
      _store_id: data.storeId,
      _customer_id: data.customerId,
      _opted_in: data.optedIn,
      _source: data.source,
    });
    if (result.error) throw result.error;
    return { ok: result.data === true };
  });
