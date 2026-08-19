import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface StoreEmailReadiness {
  provider: "resend";
  transactional_core_ready: boolean;
  api_key_configured: boolean;
  sending_domain: string | null;
  domain_verified: boolean;
  webhook_secret_configured: boolean;
  webhook_delivery_verified: boolean;
  ready_for_send: boolean;
  last_health_at: string | null;
  last_valid_webhook_at: string | null;
  last_error: string | null;
}

const storeIdSchema = z.string().uuid();

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;

function rpcCaller(client: { rpc: unknown }): RpcCaller {
  return client.rpc as RpcCaller;
}

export const getStoreEmailReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ storeId: storeIdSchema }).parse(value))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("get_my_store_email_readiness", {
      _store_id: data.storeId,
    });
    if (result.error) throw result.error;

    return z.object({
      provider: z.literal("resend"),
      transactional_core_ready: z.boolean(),
      api_key_configured: z.boolean(),
      sending_domain: z.string().nullable(),
      domain_verified: z.boolean(),
      webhook_secret_configured: z.boolean(),
      webhook_delivery_verified: z.boolean(),
      ready_for_send: z.boolean(),
      last_health_at: z.string().nullable(),
      last_valid_webhook_at: z.string().nullable(),
      last_error: z.string().nullable(),
    }).parse(result.data) satisfies StoreEmailReadiness;
  });
