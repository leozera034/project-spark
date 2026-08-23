import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface StorePushReadiness {
  provider: "fcm";
  push_core_ready: boolean;
  project_id: string | null;
  credentials_configured: boolean;
  cloud_messaging_api_enabled: boolean;
  validate_only_verified: boolean;
  ready_for_send: boolean;
  active_tokens: number;
  fresh_tokens: number;
  last_health_at: string | null;
  last_validate_only_at: string | null;
  last_error_code: string | null;
}

const storeIdSchema = z.string().uuid();
const readinessSchema = z.object({
  provider: z.literal("fcm"),
  push_core_ready: z.boolean(),
  project_id: z.string().nullable(),
  credentials_configured: z.boolean(),
  cloud_messaging_api_enabled: z.boolean(),
  validate_only_verified: z.boolean(),
  ready_for_send: z.boolean(),
  active_tokens: z.number().int().nonnegative(),
  fresh_tokens: z.number().int().nonnegative(),
  last_health_at: z.string().nullable(),
  last_validate_only_at: z.string().nullable(),
  last_error_code: z.string().nullable(),
});

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;

function rpcCaller(client: { rpc: unknown }): RpcCaller {
  return client.rpc as unknown as RpcCaller;
}

export const getStorePushReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ storeId: storeIdSchema }).parse(value))
  .handler(async ({ data, context }) => {
    const rpc = rpcCaller(context.supabase);

    // Authorize tenant access before triggering a provider health check.
    const before = await rpc("get_my_store_push_readiness", { _store_id: data.storeId });
    if (before.error) throw before.error;

    await context.supabase.functions.invoke("comandiva-push-readiness").catch(() => undefined);

    const after = await rpc("get_my_store_push_readiness", { _store_id: data.storeId });
    if (after.error) throw after.error;

    return readinessSchema.parse(after.data) satisfies StorePushReadiness;
  });
