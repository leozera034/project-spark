import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;
type FunctionError = { context?: Response; message?: string };

function rpcCaller(client: { rpc: unknown }): RpcCaller {
  return client.rpc as RpcCaller;
}

export interface StoreWhatsAppReadiness {
  assisted_available: boolean;
  automatic_entitled: boolean;
  provider_connected: boolean;
  provider: "evolution_api" | "meta_whatsapp" | "360dialog_whatsapp" | "twilio_whatsapp" | null;
  templates_total: number;
  templates_approved: number;
  templates_ready: number;
  requires_provider_template_approval: boolean;
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
  provider_template_id: string | null;
  provider_language: string;
  provider_status: "draft" | "pending" | "approved" | "rejected";
  provider_category: "UTILITY" | "MARKETING" | "AUTHENTICATION" | null;
  provider_rejection_reason: string | null;
  provider_submission_error: string | null;
  provider_submitted_at: string | null;
  provider_synced_at: string | null;
  provider_status_updated_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MetaTemplateSubmissionResult {
  ok: true;
  skipped?: boolean;
  status: string;
  providerTemplateId?: string | null;
  providerTemplateName?: string | null;
  category?: string | null;
}

export interface MetaTemplateSyncResult {
  ok: true;
  remoteCount: number;
  matchedCount: number;
  syncedAt: string;
}

const storeIdSchema = z.object({ storeId: z.string().uuid() });
const templateActionSchema = z.object({ storeId: z.string().uuid(), templateId: z.string().uuid() });

async function edgeError(error: unknown): Promise<{ code: string; message: string | null }> {
  const candidate = error as FunctionError | null;
  const response = candidate?.context;
  if (typeof Response !== "undefined" && response instanceof Response) {
    try {
      const payload = (await response.clone().json()) as { error?: unknown; message?: unknown };
      const code = typeof payload?.error === "string" && /^[a-z0-9_]{2,80}$/i.test(payload.error)
        ? payload.error
        : "operation_failed";
      const message = typeof payload?.message === "string" ? payload.message.slice(0, 500) : null;
      return { code, message };
    } catch {
      // Provider details stay hidden if the body is not a valid safe JSON error.
    }
  }
  return { code: "operation_failed", message: null };
}

function templateOperationError(code: string, message: string | null): Error {
  if (code === "forbidden") return new Error("FORBIDDEN");
  if (code === "template_variables_invalid") return new Error("TEMPLATE_VARIABLES_INVALID");
  if (code === "template_inactive") return new Error("TEMPLATE_INACTIVE");
  if (code === "meta_template_submission_failed") {
    return new Error(`META_TEMPLATE_SUBMISSION_FAILED${message ? `: ${message}` : ""}`);
  }
  if (code === "meta_template_sync_failed") {
    return new Error(`META_TEMPLATE_SYNC_FAILED${message ? `: ${message}` : ""}`);
  }
  if (code === "template_submission_unavailable") return new Error("META_TEMPLATE_SUBMISSION_UNAVAILABLE");
  if (code === "template_sync_unavailable") return new Error("META_TEMPLATE_SYNC_UNAVAILABLE");
  return new Error("META_TEMPLATE_OPERATION_FAILED");
}

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
      _provider_template_name: null,
      _provider_language: data.providerLanguage,
      _provider_status: "draft",
      _is_active: data.isActive,
    });
    if (result.error) throw result.error;
    return { id: result.data as string };
  });

export const submitStoreMessageTemplateToMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => templateActionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.functions.invoke("comandiva-whatsapp-templates", {
      body: { action: "submit", storeId: data.storeId, templateId: data.templateId },
    });
    if (result.error) {
      const parsed = await edgeError(result.error);
      throw templateOperationError(parsed.code, parsed.message);
    }
    const parsed = z.object({
      ok: z.literal(true),
      skipped: z.boolean().optional(),
      status: z.string().min(1).max(80),
      providerTemplateId: z.string().nullable().optional(),
      providerTemplateName: z.string().nullable().optional(),
      category: z.string().nullable().optional(),
    }).safeParse(result.data);
    if (!parsed.success) throw new Error("META_TEMPLATE_OPERATION_FAILED");
    return parsed.data satisfies MetaTemplateSubmissionResult;
  });

export const syncStoreMetaWhatsAppTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.functions.invoke("comandiva-whatsapp-templates", {
      body: { action: "sync", storeId: data.storeId },
    });
    if (result.error) {
      const parsed = await edgeError(result.error);
      throw templateOperationError(parsed.code, parsed.message);
    }
    const parsed = z.object({
      ok: z.literal(true),
      remoteCount: z.number().int().nonnegative(),
      matchedCount: z.number().int().nonnegative(),
      syncedAt: z.string(),
    }).safeParse(result.data);
    if (!parsed.success) throw new Error("META_TEMPLATE_OPERATION_FAILED");
    return parsed.data satisfies MetaTemplateSyncResult;
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
