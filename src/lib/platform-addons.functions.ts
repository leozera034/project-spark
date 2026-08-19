import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;
type FunctionError = { context?: Response; message?: string };

function rpcCaller(client: { rpc: unknown }): RpcCaller {
  return client.rpc as RpcCaller;
}

async function edgeErrorCode(error: unknown): Promise<string> {
  const response = (error as FunctionError | null)?.context;
  if (typeof Response !== "undefined" && response instanceof Response) {
    try {
      const payload = (await response.clone().json()) as { error?: unknown };
      if (typeof payload?.error === "string" && /^[a-z0-9_]{2,100}$/i.test(payload.error)) {
        return payload.error;
      }
    } catch {
      // Provider/internal details stay hidden from the admin UI.
    }
  }
  return "operation_failed";
}

function publicProviderSyncError(code: string): Error {
  if (code === "forbidden") return new Error("FORBIDDEN");
  if (code === "provider_not_configured") return new Error("MERCADO_PAGO_TEST_NOT_CONFIGURED");
  if (code === "provider_unreachable") return new Error("MERCADO_PAGO_UNREACHABLE");
  if (code === "provider_plan_create_failed") return new Error("MERCADO_PAGO_PLAN_CREATE_FAILED");
  if (code === "provider_plan_update_failed") return new Error("MERCADO_PAGO_PLAN_UPDATE_FAILED");
  if (code === "provider_plan_validation_failed") return new Error("MERCADO_PAGO_PLAN_VALIDATION_FAILED");
  if (code === "rate_limited") return new Error("RATE_LIMITED");
  return new Error("MERCADO_PAGO_SYNC_FAILED");
}

export type AddonAvailability = "planned" | "beta" | "available" | "retired";
export type AddonBillingInterval = "monthly" | "annual";
export type AddonBillingModel = "flat" | "metered" | "hybrid";

export interface PlatformAddonPrice {
  id: string;
  amount_cents: number;
  currency: string;
  trial_days: number;
  metering_metric_code: string | null;
  included_units: number | null;
  hard_limit_units: number | null;
  overage_unit_amount_micros: number | null;
  is_active: boolean;
  provider_ready: boolean;
  provider_status: string | null;
}

export interface PlatformAddonOffer {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  billing_model: AddonBillingModel;
  availability_status: AddonAvailability;
  is_active: boolean;
  sort_order: number;
  monthly_price: PlatformAddonPrice | null;
  annual_price: PlatformAddonPrice | null;
  active_subscriptions: number;
}

export interface PlatformAddonOfferCatalog {
  provider: "mercado_pago";
  items: PlatformAddonOffer[];
}

export interface PlatformAddonProviderSyncResult {
  environment: "test";
  provider: "mercado_pago";
  created: boolean;
  plan: {
    id: string;
    status: string | null;
    initPoint: string | null;
  };
}

const addonIdSchema = z.string().uuid();
const availabilitySchema = z.enum(["planned", "beta", "available", "retired"]);
const intervalSchema = z.enum(["monthly", "annual"]);

export const listPlatformAddonOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await rpcCaller(context.supabase)("admin_list_addon_offers");
    if (error) throw error;
    return data as PlatformAddonOfferCatalog;
  });

export const updatePlatformAddonCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      addonId: addonIdSchema,
      availabilityStatus: availabilitySchema,
      isActive: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("admin_update_addon_catalog", {
      _addon_id: data.addonId,
      _availability_status: data.availabilityStatus,
      _is_active: data.isActive,
    });
    if (result.error) throw result.error;
    return result.data as Record<string, unknown>;
  });

export const upsertPlatformAddonPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      addonId: addonIdSchema,
      billingInterval: intervalSchema,
      amountCents: z.number().int().min(0).max(100_000_000),
      trialDays: z.number().int().min(0).max(365).default(0),
      meteringMetricCode: z.string().trim().max(120).nullable().optional(),
      includedUnits: z.number().min(0).nullable().optional(),
      hardLimitUnits: z.number().min(0).nullable().optional(),
      overageUnitAmountMicros: z.number().int().min(0).nullable().optional(),
      isActive: z.boolean().default(true),
    }).superRefine((value, ctx) => {
      if (
        value.includedUnits != null &&
        value.hardLimitUnits != null &&
        value.hardLimitUnits < value.includedUnits
      ) {
        ctx.addIssue({ code: "custom", message: "O hard limit não pode ser menor que a franquia." });
      }
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("admin_upsert_addon_price", {
      _addon_id: data.addonId,
      _billing_interval: data.billingInterval,
      _amount_cents: data.amountCents,
      _trial_days: data.trialDays,
      _metering_metric_code: data.meteringMetricCode ?? null,
      _included_units: data.includedUnits ?? null,
      _hard_limit_units: data.hardLimitUnits ?? null,
      _overage_unit_amount_micros: data.overageUnitAmountMicros ?? null,
      _is_active: data.isActive,
    });
    if (result.error) throw result.error;
    return result.data as Record<string, unknown>;
  });

export const syncPlatformAddonPriceWithMercadoPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ addonPriceId: addonIdSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.functions.invoke(
      "comandiva-billing?action=sync_addon_price",
      { body: { addonPriceId: data.addonPriceId } },
    );
    if (result.error) throw publicProviderSyncError(await edgeErrorCode(result.error));

    const parsed = z.object({
      ok: z.literal(true),
      environment: z.literal("test"),
      provider: z.literal("mercado_pago"),
      created: z.boolean(),
      plan: z.object({
        id: z.string().min(1).max(200),
        status: z.string().nullable(),
        initPoint: z.string().url().nullable(),
      }),
    }).safeParse(result.data);
    if (!parsed.success) throw new Error("MERCADO_PAGO_SYNC_FAILED");
    return parsed.data satisfies PlatformAddonProviderSyncResult;
  });
