import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({ storeId: z.string().uuid() });

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;

export type StripeConnectStatus = {
  connected: boolean;
  stripe_account_id?: string | null;
  details_submitted?: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  country?: string | null;
  business_type?: string | null;
  requirements_currently_due?: string[];
  application_fee_bps?: number;
  updated_at?: string | null;
};

export type StripeRuntimeReadiness = {
  secret_key_configured?: boolean;
  publishable_key_configured?: boolean;
  webhook_secret_configured?: boolean;
  connect_enabled?: boolean;
  provider_connected?: boolean;
  ready_for_billing?: boolean;
  ready_for_connect?: boolean;
  ready_for_webhooks?: boolean;
  checked_at?: string | null;
  last_error?: string | null;
};

export type StripeConnectOnboardingResult = {
  ok: boolean;
  alreadyReady?: boolean;
  accountId?: string;
  onboardingUrl?: string;
  expiresAt?: number;
  error?: string;
  providerMessage?: string | null;
};

export const getStripeConnectStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const rpc = context.supabase.rpc as unknown as RpcCaller;
    const result = await rpc("get_my_store_stripe_connect_status", { _store_id: data.storeId });
    if (result.error) throw result.error;
    return result.data as StripeConnectStatus;
  });

export const getStripeRuntimeReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const rpc = context.supabase.rpc as unknown as RpcCaller;
    const result = await rpc("get_stripe_runtime_readiness");
    if (result.error) throw result.error;
    return result.data as StripeRuntimeReadiness;
  });

export const beginStripeConnectOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.functions.invoke("comandiva-stripe-onboarding", {
      body: { storeId: data.storeId },
    });
    if (error) throw error;
    const payload = result as StripeConnectOnboardingResult;
    if (!payload?.ok) throw new Error(payload?.providerMessage || payload?.error || "Não foi possível iniciar o cadastro Stripe.");
    return payload;
  });
