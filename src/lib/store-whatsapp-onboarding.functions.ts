import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;

type FunctionError = {
  context?: Response;
  message?: string;
};

function rpcCaller(client: { rpc: unknown }): RpcCaller {
  return client.rpc as unknown as RpcCaller;
}

export interface StoreMetaWhatsAppConnection {
  configured: boolean;
  connected: boolean;
  status: "disconnected" | "pending" | "connected" | "degraded" | "disabled";
  waba_id: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  quality_rating: string | null;
  business_id: string | null;
  graph_api_version: string | null;
  webhook_subscribed: boolean;
  template_count: number;
  templates_synced_at: string | null;
  token_expires_at: string | null;
  connected_at: string | null;
  last_health_at: string | null;
  last_error: string | null;
  onboarding_session: {
    id: string;
    status: "created" | "exchanging" | "connected" | "failed" | "cancelled" | "expired";
    error_code: string | null;
    error_message: string | null;
    expires_at: string;
    completed_at: string | null;
    created_at: string;
  } | null;
}

export interface MetaWhatsAppOnboardingStart {
  sessionId: string;
  expiresAt: string;
  appId: string;
  configurationId: string;
  graphApiVersion: string;
  sessionInfoVersion: string;
}

const storeSchema = z.object({ storeId: z.string().uuid() });
const completeSchema = z.object({
  storeId: z.string().uuid(),
  sessionId: z.string().uuid(),
  code: z.string().trim().min(1).max(4096),
  wabaId: z.string().regex(/^\d{5,40}$/),
  phoneNumberId: z.string().regex(/^\d{5,40}$/),
  businessId: z.string().regex(/^\d{5,40}$/).nullable().optional(),
});

async function edgeErrorCode(error: unknown): Promise<string> {
  const candidate = error as FunctionError | null;
  const response = candidate?.context;
  if (typeof Response !== "undefined" && response instanceof Response) {
    try {
      const payload = (await response.clone().json()) as { error?: unknown };
      if (typeof payload?.error === "string" && /^[a-z0-9_]{2,80}$/i.test(payload.error)) {
        return payload.error;
      }
    } catch {
      // Keep provider/internal details hidden from the UI.
    }
  }
  return "operation_failed";
}

function publicOnboardingError(code: string): Error {
  if (code === "meta_app_not_configured") return new Error("META_APP_NOT_CONFIGURED");
  if (code === "onboarding_session_expired") return new Error("META_ONBOARDING_SESSION_EXPIRED");
  if (code === "forbidden") return new Error("FORBIDDEN");
  if (code === "onboarding_unavailable") return new Error("META_ONBOARDING_UNAVAILABLE");
  return new Error("META_ONBOARDING_FAILED");
}

export const getStoreMetaWhatsAppConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("get_store_meta_whatsapp_connection", {
      _store_id: data.storeId,
    });
    if (result.error) throw result.error;
    return result.data as StoreMetaWhatsAppConnection;
  });

export const startStoreMetaWhatsAppOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.functions.invoke("comandiva-whatsapp-onboarding", {
      body: { action: "start", storeId: data.storeId },
    });
    if (result.error) throw publicOnboardingError(await edgeErrorCode(result.error));

    const parsed = z.object({
      ok: z.literal(true),
      sessionId: z.string().uuid(),
      expiresAt: z.string(),
      appId: z.string().regex(/^\d{5,40}$/),
      configurationId: z.string().regex(/^\d{5,40}$/),
      graphApiVersion: z.string().regex(/^v\d{1,3}\.\d{1,2}$/),
      sessionInfoVersion: z.string().min(1).max(10),
    }).safeParse(result.data);

    if (!parsed.success) throw new Error("META_ONBOARDING_FAILED");
    return {
      sessionId: parsed.data.sessionId,
      expiresAt: parsed.data.expiresAt,
      appId: parsed.data.appId,
      configurationId: parsed.data.configurationId,
      graphApiVersion: parsed.data.graphApiVersion,
      sessionInfoVersion: parsed.data.sessionInfoVersion,
    } satisfies MetaWhatsAppOnboardingStart;
  });

export const completeStoreMetaWhatsAppOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => completeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.functions.invoke("comandiva-whatsapp-onboarding", {
      body: {
        action: "complete",
        storeId: data.storeId,
        sessionId: data.sessionId,
        code: data.code,
        wabaId: data.wabaId,
        phoneNumberId: data.phoneNumberId,
        businessId: data.businessId ?? null,
      },
    });
    if (result.error) throw publicOnboardingError(await edgeErrorCode(result.error));

    const parsed = z.object({
      ok: z.literal(true),
      connected: z.literal(true),
      duplicate: z.boolean().optional(),
      wabaId: z.string().optional(),
      phoneNumberId: z.string().optional(),
      displayPhoneNumber: z.string().nullable().optional(),
      verifiedName: z.string().nullable().optional(),
      qualityRating: z.string().nullable().optional(),
      webhookSubscribed: z.boolean().optional(),
      templateCount: z.number().int().nonnegative().optional(),
    }).safeParse(result.data);

    if (!parsed.success) throw new Error("META_ONBOARDING_FAILED");
    return parsed.data;
  });
