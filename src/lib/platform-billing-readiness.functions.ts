import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcResult={data:unknown;error:unknown}; type RpcCaller=(fn:string,args?:Record<string,unknown>)=>Promise<RpcResult>;
function rpcCaller(client:{rpc:unknown}):RpcCaller{return client.rpc as RpcCaller}

export interface PlatformBillingProviderReadiness {
  provider:"stripe";
  secret_key_configured:boolean;
  publishable_key_configured:boolean;
  webhook_secret_configured:boolean;
  connect_enabled:boolean;
  provider_connected:boolean;
  ready_for_billing:boolean;
  ready_for_connect:boolean;
  ready_for_webhooks:boolean;
  checked_at:string|null;
  last_error:string|null;
  probe_ok:boolean;
}

export const getPlatformBillingProviderReadiness=createServerFn({method:"GET"})
  .middleware([requireSupabaseAuth])
  .handler(async({context})=>{
    const rpc=rpcCaller(context.supabase);
    const probe=await context.supabase.functions.invoke("comandiva-stripe?action=provider_health");
    const after=await rpc("get_stripe_runtime_readiness");
    if(after.error)throw after.error;
    return {provider:"stripe",...(after.data as Omit<PlatformBillingProviderReadiness,"provider"|"probe_ok">),probe_ok:!probe.error} satisfies PlatformBillingProviderReadiness;
  });
