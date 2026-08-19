import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const storeIdSchema = z.string().uuid();
const planCodeSchema = z.enum(["gratis", "essencial", "profissional", "avancado"]);
const paidPlanCodeSchema = planCodeSchema.exclude(["gratis"]);
const billingIntervalSchema = z.enum(["monthly", "annual"]);

type FunctionError = { context?: Response; message?: string };

export type StorePlanBillingDetail = {
  store_id: string;
  plan: {
    id: string;
    code: string;
    name: string;
    features: Record<string, unknown>;
    max_orders_month: number | null;
    max_team_members: number | null;
    max_couriers: number | null;
  };
  price: null | {
    id: string;
    amount_cents: number;
    currency: string;
    billing_interval: "monthly" | "annual";
    trial_days: number;
  };
  subscription: {
    status: string;
    provider_status: string | null;
    billing_provider: string | null;
    current_period_end: string | null;
    trial_ends_at: string | null;
    grace_until: string | null;
    cancel_at_period_end: boolean;
    last_invoice_id: string | null;
    last_invoice_status: string | null;
    last_payment_failure_at: string | null;
  };
  pending_change: null | {
    plan_code: string;
    plan_name: string;
    effective_at: string | null;
  };
  invoices: Array<{
    id: string;
    invoice_id: string | null;
    status: string;
    provider_status: string | null;
    amount_cents: number;
    currency: string;
    paid_at: string | null;
    due_at: string | null;
    created_at: string;
  }>;
};

export type PlanLifecycleResult = {
  ok: true;
  action: "upgrade" | "downgrade" | "cancel" | "resume";
  scheduled?: boolean;
  effectiveAt?: string | null;
  providerStatus?: string | null;
};

async function edgeErrorCode(error: unknown) {
  const response = (error as FunctionError | null)?.context;
  if (typeof Response !== "undefined" && response instanceof Response) {
    try {
      const payload = (await response.clone().json()) as { error?: unknown };
      if (typeof payload?.error === "string" && /^[a-z0-9_]{2,100}$/i.test(payload.error)) {
        return payload.error;
      }
    } catch {
      // Intentionally collapse provider details into a stable internal error code.
    }
  }
  return "operation_failed";
}

function checkoutError(code: string) {
  switch (code) {
    case "forbidden": return new Error("FORBIDDEN");
    case "account_email_required": return new Error("ACCOUNT_EMAIL_REQUIRED");
    case "active_subscription_exists": return new Error("ACTIVE_SUBSCRIPTION_EXISTS");
    case "free_plan_requires_no_checkout": return new Error("FREE_PLAN_REQUIRES_NO_CHECKOUT");
    case "plan_checkout_not_ready": return new Error("PLAN_CHECKOUT_NOT_READY");
    case "stripe_checkout_create_failed": return new Error("STRIPE_CHECKOUT_REJECTED");
    case "stripe_not_configured": return new Error("STRIPE_NOT_CONFIGURED");
    case "rate_limited": return new Error("RATE_LIMITED");
    default: return new Error("PLAN_CHECKOUT_FAILED");
  }
}

function lifecycleError(code: string) {
  switch (code) {
    case "forbidden": return new Error("FORBIDDEN");
    case "plan_change_not_ready": return new Error("PLAN_CHANGE_NOT_READY");
    case "target_plan_not_found": return new Error("TARGET_PLAN_NOT_FOUND");
    case "same_plan": return new Error("SAME_PLAN");
    case "stripe_subscription_update_failed": return new Error("STRIPE_SUBSCRIPTION_UPDATE_FAILED");
    case "stripe_schedule_create_failed": return new Error("STRIPE_SCHEDULE_CREATE_FAILED");
    case "stripe_cancel_failed": return new Error("STRIPE_CANCEL_FAILED");
    case "stripe_resume_failed": return new Error("STRIPE_RESUME_FAILED");
    case "rate_limited": return new Error("RATE_LIMITED");
    default: return new Error("PLAN_LIFECYCLE_FAILED");
  }
}

export const getMyStorePlanBillingDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ storeId: storeIdSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("get_my_store_plan_billing_detail", {
      _store_id: data.storeId,
    } as never);
    if (error) throw error;
    return result as StorePlanBillingDetail;
  });

export const createStorePlanCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      storeId: storeIdSchema,
      planCode: paidPlanCodeSchema,
      billingInterval: billingIntervalSchema,
      idempotencyKey: z.string().trim().min(8).max(160),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const result = await context.supabase.functions.invoke("comandiva-stripe?action=create_plan_checkout", {
      headers: { "x-idempotency-key": data.idempotencyKey },
      body: {
        storeId: data.storeId,
        planCode: data.planCode,
        billingInterval: data.billingInterval,
      },
    });
    if (result.error) throw checkoutError(await edgeErrorCode(result.error));
    const parsed = z.object({
      ok: z.literal(true),
      reused: z.boolean(),
      provider: z.literal("stripe"),
      attemptId: z.string().uuid(),
      checkoutSessionId: z.string().optional(),
      checkoutUrl: z.string().url().refine((value) => value.startsWith("https://")),
      planCode: z.string().optional(),
      billingInterval: billingIntervalSchema.optional(),
      trialDays: z.number().int().nonnegative().optional(),
    }).safeParse(result.data);
    if (!parsed.success) throw new Error("PLAN_CHECKOUT_FAILED");
    return parsed.data;
  });

export const createStoreBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ storeId: storeIdSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.functions.invoke("comandiva-stripe?action=create_billing_portal", {
      body: { storeId: data.storeId },
    });
    if (result.error) {
      const code = await edgeErrorCode(result.error);
      if (code === "billing_customer_missing") throw new Error("BILLING_CUSTOMER_MISSING");
      if (code === "forbidden") throw new Error("FORBIDDEN");
      if (code === "rate_limited") throw new Error("RATE_LIMITED");
      throw new Error("BILLING_PORTAL_FAILED");
    }
    const parsed = z.object({ ok: z.literal(true), url: z.string().url().refine((v) => v.startsWith("https://")) }).safeParse(result.data);
    if (!parsed.success) throw new Error("BILLING_PORTAL_FAILED");
    return parsed.data;
  });

export const changeStorePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    storeId: storeIdSchema,
    planCode: paidPlanCodeSchema,
    billingInterval: billingIntervalSchema,
  }).parse(data))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.functions.invoke("comandiva-stripe?action=change_plan", { body: data });
    if (result.error) throw lifecycleError(await edgeErrorCode(result.error));
    const parsed = z.object({
      ok: z.literal(true),
      action: z.enum(["upgrade", "downgrade"]),
      scheduled: z.boolean().optional(),
      effectiveAt: z.string().nullable().optional(),
      providerStatus: z.string().nullable().optional(),
    }).safeParse(result.data);
    if (!parsed.success) throw new Error("PLAN_LIFECYCLE_FAILED");
    return parsed.data as PlanLifecycleResult;
  });

export const cancelStorePlanAtPeriodEnd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ storeId: storeIdSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.functions.invoke("comandiva-stripe?action=cancel_plan", { body: data });
    if (result.error) throw lifecycleError(await edgeErrorCode(result.error));
    return z.object({
      ok: z.literal(true),
      action: z.literal("cancel"),
      effectiveAt: z.string().nullable().optional(),
    }).parse(result.data) as PlanLifecycleResult;
  });

export const resumeStorePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ storeId: storeIdSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.functions.invoke("comandiva-stripe?action=resume_plan", { body: data });
    if (result.error) throw lifecycleError(await edgeErrorCode(result.error));
    return z.object({ ok: z.literal(true), action: z.literal("resume") }).parse(result.data) as PlanLifecycleResult;
  });
