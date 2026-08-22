import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;
type FunctionError = { context?: Response; message?: string };

export type EvolutionWhatsAppStatus = "disconnected" | "pending" | "connected" | "degraded" | "disabled";

export interface StoreEvolutionWhatsAppConnection {
  configured: boolean;
  connected: boolean;
  status: EvolutionWhatsAppStatus;
  instance_name: string | null;
  display_phone_number: string | null;
  connected_at: string | null;
  last_health_at: string | null;
  last_error: string | null;
  provisioning_request_id: string | null;
  provisioning_status: string;
  paid_subscription: boolean;
  automatic_entitled: boolean;
  can_provision: boolean;
}

export interface EvolutionWhatsAppActionResult {
  ok: true;
  configured?: boolean;
  state?: string;
  connected?: boolean;
  instanceName?: string;
  displayPhoneNumber?: string | null;
  qrCodeDataUrl?: string | null;
  pairingCode?: string | null;
  qrCode?: string | null;
  sent?: boolean;
  providerMessageId?: string;
  recovered?: boolean;
  repairRequired?: boolean;
  reasonCode?: number | null;
}

const storeSchema = z.object({ storeId: z.string().uuid() });
const manualSendSchema = z.object({
  storeId: z.string().uuid(),
  phone: z.string().trim().min(8).max(32),
  message: z.string().trim().min(1).max(4096),
});

function rpcCaller(client: { rpc: unknown }): RpcCaller {
  return client.rpc as RpcCaller;
}

async function edgeErrorCode(error: unknown): Promise<string> {
  const candidate = error as FunctionError | null;
  const response = candidate?.context;
  if (typeof Response !== "undefined" && response instanceof Response) {
    try {
      const payload = (await response.clone().json()) as { error?: unknown };
      if (typeof payload?.error === "string" && /^[a-z0-9_]{2,100}$/i.test(payload.error)) {
        return payload.error;
      }
    } catch {
      // Provider/internal details intentionally stay server-side.
    }
  }
  return "operation_failed";
}

function publicEvolutionError(code: string): Error {
  if (code === "whatsapp_payment_required") return new Error("WHATSAPP_PAYMENT_REQUIRED");
  if (code === "evolution_runtime_not_configured") return new Error("EVOLUTION_RUNTIME_NOT_CONFIGURED");
  if (code === "evolution_instance_create_failed") return new Error("EVOLUTION_INSTANCE_CREATE_FAILED");
  if (code === "evolution_qr_failed") return new Error("EVOLUTION_QR_FAILED");
  if (code === "evolution_status_failed") return new Error("EVOLUTION_STATUS_FAILED");
  if (code === "evolution_disconnect_failed") return new Error("EVOLUTION_DISCONNECT_FAILED");
  if (code === "evolution_send_failed") return new Error("EVOLUTION_SEND_FAILED");
  if (code === "evolution_send_ambiguous") return new Error("EVOLUTION_SEND_AMBIGUOUS");
  if (code === "manual_send_not_ready") return new Error("EVOLUTION_MANUAL_SEND_NOT_READY");
  if (code === "evolution_unreachable") return new Error("EVOLUTION_UNREACHABLE");
  if (code === "forbidden") return new Error("FORBIDDEN");
  if (code === "unauthorized") return new Error("UNAUTHORIZED");
  return new Error("EVOLUTION_OPERATION_FAILED");
}

async function invokeEvolution(
  context: { supabase: { functions: { invoke: (name: string, options: { body: Record<string, unknown> }) => Promise<{ data: unknown; error: unknown }> } } },
  body: Record<string, unknown>,
): Promise<EvolutionWhatsAppActionResult> {
  const result = await context.supabase.functions.invoke("comandiva-evolution-onboarding", { body });
  if (result.error) throw publicEvolutionError(await edgeErrorCode(result.error));
  const parsed = z.object({
    ok: z.literal(true),
    configured: z.boolean().optional(),
    state: z.string().max(80).optional(),
    connected: z.boolean().optional(),
    instanceName: z.string().max(100).optional(),
    displayPhoneNumber: z.string().max(120).nullable().optional(),
    qrCodeDataUrl: z.string().max(3_000_000).nullable().optional(),
    pairingCode: z.string().max(100).nullable().optional(),
    qrCode: z.string().max(20_000).nullable().optional(),
    sent: z.boolean().optional(),
    providerMessageId: z.string().max(512).optional(),
    recovered: z.boolean().optional(),
    repairRequired: z.boolean().optional(),
    reasonCode: z.number().nullable().optional(),
  }).safeParse(result.data);
  if (!parsed.success) throw new Error("EVOLUTION_OPERATION_FAILED");
  return parsed.data;
}

export const getStoreEvolutionWhatsAppConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("get_store_evolution_whatsapp_connection", {
      _store_id: data.storeId,
    });
    if (result.error) throw result.error;
    return result.data as StoreEvolutionWhatsAppConnection;
  });

export const getStoreEvolutionWhatsAppLiveStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeSchema.parse(data))
  .handler(async ({ data, context }) => invokeEvolution(context, { action: "status", storeId: data.storeId }));

export const startStoreEvolutionWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeSchema.parse(data))
  .handler(async ({ data, context }) => invokeEvolution(context, { action: "start", storeId: data.storeId }));

export const refreshStoreEvolutionWhatsAppQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeSchema.parse(data))
  .handler(async ({ data, context }) => invokeEvolution(context, { action: "refresh_qr", storeId: data.storeId }));

export const disconnectStoreEvolutionWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeSchema.parse(data))
  .handler(async ({ data, context }) => invokeEvolution(context, { action: "disconnect", storeId: data.storeId }));

export const sendStoreEvolutionWhatsAppManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => manualSendSchema.parse(data))
  .handler(async ({ data, context }) => invokeEvolution(context, {
    action: "send_manual",
    storeId: data.storeId,
    phone: data.phone,
    message: data.message,
  }));
