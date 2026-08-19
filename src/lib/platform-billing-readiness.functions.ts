import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;

function rpcCaller(client: { rpc: unknown }): RpcCaller {
  return client.rpc as RpcCaller;
}

export interface PlatformBillingProviderReadiness {
  provider: "mercado_pago";
  environment: "test";
  initialized: boolean;
  token_configured: boolean;
  token_connected: boolean;
  token_checked_at: string | null;
  token_upstream_status: number | null;
  webhook_secret_configured: boolean;
  webhook_secret_checked_at: string | null;
  webhook_delivery_verified: boolean;
  last_valid_webhook_at: string | null;
  last_valid_webhook_event_type: string | null;
  last_error: string | null;
  ready_for_checkout: boolean;
  probe_ok: boolean;
}

export const getPlatformBillingProviderReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const rpc = rpcCaller(context.supabase);

    // Authorize before triggering any provider-side health probe.
    const before = await rpc("admin_get_billing_provider_readiness", {
      _provider: "mercado_pago",
      _environment: "test",
    });
    if (before.error) throw before.error;

    const probe = await context.supabase.functions.invoke("comandiva-billing-readiness");

    // The probe persists failures as readiness state too, so always re-read the
    // canonical database row even when the Edge invocation returns a non-2xx.
    const after = await rpc("admin_get_billing_provider_readiness", {
      _provider: "mercado_pago",
      _environment: "test",
    });
    if (after.error) throw after.error;

    return {
      ...(after.data as Omit<PlatformBillingProviderReadiness, "probe_ok">),
      probe_ok: !probe.error,
    } satisfies PlatformBillingProviderReadiness;
  });
