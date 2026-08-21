import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;
type FunctionError = { context?: Response };

export type GoogleBusinessConnectionStatus = "disconnected" | "pending" | "connected" | "degraded" | "disabled";
export type GoogleBusinessOnboardingStatus = "created" | "exchanging" | "connected" | "failed" | "cancelled" | "expired";

export interface StoreGoogleBusinessConnection {
  configured: boolean;
  connected: boolean;
  status: GoogleBusinessConnectionStatus;
  api_healthy: boolean;
  google_user_email: string | null;
  account_count: number;
  selected_account_name: string | null;
  selected_location_name: string | null;
  selected_location_title: string | null;
  token_expires_at: string | null;
  scopes: string[];
  connected_at: string | null;
  last_health_at: string | null;
  last_error: string | null;
  onboarding_session: {
    id: string;
    status: GoogleBusinessOnboardingStatus;
    error_code: string | null;
    error_message: string | null;
    expires_at: string;
    completed_at: string | null;
    created_at: string;
  } | null;
}

export interface StartGoogleBusinessConnectionResult {
  ok: true;
  authorizationUrl: string;
  expiresAt: string;
}

const storeSchema = z.object({ storeId: z.string().uuid() });
const onboardingSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["created", "exchanging", "connected", "failed", "cancelled", "expired"]),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  expires_at: z.string(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
});
const connectionSchema = z.object({
  configured: z.boolean(),
  connected: z.boolean(),
  status: z.enum(["disconnected", "pending", "connected", "degraded", "disabled"]),
  api_healthy: z.boolean(),
  google_user_email: z.string().nullable(),
  account_count: z.number().int().nonnegative(),
  selected_account_name: z.string().nullable(),
  selected_location_name: z.string().nullable(),
  selected_location_title: z.string().nullable(),
  token_expires_at: z.string().nullable(),
  scopes: z.array(z.string()),
  connected_at: z.string().nullable(),
  last_health_at: z.string().nullable(),
  last_error: z.string().nullable(),
  onboarding_session: onboardingSchema.nullable(),
});

function rpcCaller(client: { rpc: unknown }): RpcCaller {
  return client.rpc as RpcCaller;
}

async function edgeErrorCode(error: unknown): Promise<string> {
  const response = (error as FunctionError | null)?.context;
  if (typeof Response !== "undefined" && response instanceof Response) {
    try {
      const payload = (await response.clone().json()) as { error?: unknown };
      if (typeof payload.error === "string" && /^[a-z0-9_]{2,120}$/i.test(payload.error)) return payload.error;
    } catch {
      // Provider details remain server-side.
    }
  }
  return "operation_failed";
}

function publicGoogleBusinessError(code: string): Error {
  if (code === "google_business_runtime_not_configured") return new Error("GOOGLE_BUSINESS_RUNTIME_NOT_CONFIGURED");
  if (code === "google_business_onboarding_start_failed") return new Error("GOOGLE_BUSINESS_ONBOARDING_START_FAILED");
  if (code === "forbidden") return new Error("FORBIDDEN");
  if (code === "unauthorized") return new Error("UNAUTHORIZED");
  return new Error("GOOGLE_BUSINESS_OPERATION_FAILED");
}

export const getStoreGoogleBusinessConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("get_store_google_business_connection", {
      _store_id: data.storeId,
    });
    if (result.error) throw result.error;
    return connectionSchema.parse(result.data) as StoreGoogleBusinessConnection;
  });

export const startStoreGoogleBusinessConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.functions.invoke("comandiva-google-business", {
      body: { action: "start", storeId: data.storeId },
    });
    if (result.error) throw publicGoogleBusinessError(await edgeErrorCode(result.error));

    const parsed = z.object({
      ok: z.literal(true),
      authorizationUrl: z.string().url().refine((value) => {
        try {
          const url = new URL(value);
          return url.protocol === "https:" && url.hostname === "accounts.google.com";
        } catch {
          return false;
        }
      }),
      expiresAt: z.string(),
    }).safeParse(result.data);
    if (!parsed.success) throw new Error("GOOGLE_BUSINESS_OPERATION_FAILED");
    return parsed.data as StartGoogleBusinessConnectionResult;
  });

export const disconnectStoreGoogleBusinessConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("disconnect_store_google_business", {
      _store_id: data.storeId,
    });
    if (result.error) throw result.error;
    if (result.data !== true) throw new Error("GOOGLE_BUSINESS_DISCONNECT_FAILED");
    return { ok: true as const };
  });
