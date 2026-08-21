import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({ storeId: z.string().uuid() });

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;

export type WhatsAppAddonProvisioning = {
  request_id?: string | null;
  status: "not_requested" | "awaiting_payment" | "paid" | "provisioning" | "awaiting_customer" | "active" | "degraded" | "suspended" | "cancelled" | "failed";
  provider?: string | null;
  onboarding_url?: string | null;
  requested_at?: string | null;
  paid_at?: string | null;
  activated_at?: string | null;
  last_error?: string | null;
};

export const getWhatsAppAddonProvisioning = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const rpc = context.supabase.rpc as unknown as RpcCaller;
    const result = await rpc("get_whatsapp_addon_provisioning", { _store_id: data.storeId });
    if (result.error) throw result.error;
    return result.data as WhatsAppAddonProvisioning;
  });
