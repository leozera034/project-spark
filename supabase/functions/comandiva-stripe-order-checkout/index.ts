import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const STRIPE_API = "https://api.stripe.com";
const APP_ORIGIN = "https://shark-cardapio.lovable.app";
const TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 32 * 1024;
const INTEGRATION_IDENTIFIER = "comandiva_orders_qxmvbrta";
const ORDER_CHECKOUT_TTL_SECONDS = 31 * 60;
type J = Record<string, unknown>;
function obj(v: unknown): J { return v && typeof v === "object" && !Array.isArray(v) ? v as J : {}; }
function str(v: unknown): string | null { return typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null; }
function int(v: unknown): number | null { const n = Number(v); return Number.isInteger(n) ? n : null; }
function parseKeys(raw:string|undefined):Record<string,string>{try{return raw?JSON.parse(raw):{}}catch{return{}}}
function keyAwareFetch(apiKey:string):typeof fetch{return(input,init)=>{const h=new Headers(typeof Request!=="undefined"&&input instanceof Request?input.headers:undefined);if(init?.headers)new Headers(init.headers).forEach((v,k)=>h.set(k,v));if(apiKey.startsWith("sb_")&&h.get("Authorization")===`Bearer ${apiKey}`)h.delete("Authorization");h.set("apikey",apiKey);return fetch(input,{...init,headers:h})}}
function admin(){const url=Deno.env.get("SUPABASE_URL"),m=parseKeys(Deno.env.get("SUPABASE_SECRET_KEYS")),key=m.default??Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!url||!key)throw new Error("backend_configuration_missing");return createClient(url,key,{global:{fetch:keyAwareFetch(key)},auth:{persistSession:false,autoRefreshToken:false}})}
function allowedOrigin(req:Request){const o=req.headers.get("origin")??"";return o===APP_ORIGIN||/^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(o)?o:APP_ORIGIN}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":allowedOrigin(req),"access-control-allow-headers":"content-type","access-control-allow-methods":"POST, OPTIONS",vary:"Origin"}})}
async function readBody(req:Request):Promise<J|null>{const len=Number(req.headers.get("content-length")??0);if(Number.isFinite(len)&&len>MAX_BODY_BYTES)return null;try{return obj(await req.json())}catch{return null}}
async function rateLimit(key:string,limit:number,windowSeconds:number){const {data,error}=await admin().rpc("consume_edge_rate_limit",{_key:key,_limit:limit,_window_seconds:windowSeconds} as never);return !error&&data===true}
function form(data:Record<string,string|number|boolean|null|undefined>){const p=new URLSearchParams();for(const [k,v] of Object.entries(data))if(v!==null&&v!==undefined)p.set(k,String(v));return p}
async function stripe(data:URLSearchParams,idempotencyKey:string){const sk=Deno.env.get("STRIPE_SECRET_KEY")?.trim();if(!sk)return{ok:false,status:503,body:{} as J};const h=new Headers({Authorization:`Bearer ${sk}`,"content-type":"application/x-www-form-urlencoded","Idempotency-Key":idempotencyKey,"Stripe-Version":"2026-06-24.dahlia"});const c=new AbortController(),t=setTimeout(()=>c.abort(),TIMEOUT_MS);try{const r=await fetch(`${STRIPE_API}/v1/checkout/sessions`,{method:"POST",headers:h,body:data.toString(),signal:c.signal});return{ok:r.ok,status:r.status,body:obj(await r.json().catch(()=>({})))};}finally{clearTimeout(t)}}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return json(req,{ok:true});
  if(req.method!=="POST")return json(req,{ok:false,error:"method_not_allowed"},405);
  const body=await readBody(req),action=str(body?.action)??"create_checkout",orderId=str(body?.orderId),trackingToken=str(body?.trackingToken);
  if(!orderId||!trackingToken||trackingToken.length<16)return json(req,{ok:false,error:"invalid_order_reference"},400);
  if(!(await rateLimit(`stripe:order:${action}:${orderId}`,action==="status"?30:8,60)))return json(req,{ok:false,error:"rate_limited"},429);
  const a=admin();
  if(action==="status"){
    const {data,error}=await a.rpc("get_public_order_stripe_payment_status",{_order_id:orderId,_tracking_token:trackingToken} as never);
    if(error||!data)return json(req,{ok:false,error:"order_not_found"},404);
    return json(req,{ok:true,payment:data});
  }
  const {data:ctx,error}=await a.rpc("backend_get_order_stripe_payment_context",{_order_id:orderId,_tracking_token:trackingToken} as never);
  if(error||!ctx)return json(req,{ok:false,error:"order_not_found"},404);
  const c=obj(ctx);if(c.ready!==true)return json(req,{ok:false,error:str(c.reason)??"stripe_not_ready"},409);
  const destination=str(c.stripe_account_id),amount=int(c.amount_cents),platformFee=int(c.platform_fee_cents)??int(c.application_fee_amount)??0,currency=str(c.currency)??"brl",orderNumber=str(c.order_number)??"";
  if(!destination||!amount||amount<=0)return json(req,{ok:false,error:"payment_context_invalid"},409);
  const slug=encodeURIComponent(str(body?.slug)??"");
  const success=`${APP_ORIGIN}/loja/${slug}/pedido-enviado?payment=success`;
  const cancel=`${APP_ORIGIN}/loja/${slug}/pedido-enviado?payment=cancelled`;
  const transferGroup=`comandiva_order_${orderId}`;
  const expiresAt=Math.floor(Date.now()/1000)+ORDER_CHECKOUT_TTL_SECONDS;
  const data=form({
    mode:"payment",
    integration_identifier:INTEGRATION_IDENTIFIER,
    expires_at:expiresAt,
    success_url:success,
    cancel_url:cancel,
    "line_items[0][price_data][currency]":currency,
    "line_items[0][price_data][unit_amount]":amount,
    "line_items[0][price_data][product_data][name]":`Pedido Comandiva #${orderNumber}`,
    "line_items[0][quantity]":1,
    "metadata[comandiva_order_id]":orderId,
    "metadata[comandiva_store_id]":str(c.store_id)??"",
    "metadata[comandiva_destination_account]":destination,
    "metadata[comandiva_platform_fee_cents]":platformFee,
    "metadata[comandiva_charge_pattern]":"separate",
    "payment_intent_data[transfer_group]":transferGroup,
    "payment_intent_data[metadata][comandiva_order_id]":orderId,
    "payment_intent_data[metadata][comandiva_store_id]":str(c.store_id)??"",
    "payment_intent_data[metadata][comandiva_destination_account]":destination,
    "payment_intent_data[metadata][comandiva_platform_fee_cents]":platformFee,
    "payment_intent_data[metadata][comandiva_charge_pattern]":"separate"
  });
  const up=await stripe(data,`comandiva-order-checkout-separate-${orderId}`);
  if(!up.ok)return json(req,{ok:false,error:"stripe_checkout_create_failed",upstreamStatus:up.status,providerMessage:str(obj(up.body.error).message)},up.status>=500?502:409);
  const url=str(up.body.url),sessionId=str(up.body.id);if(!url||!sessionId)return json(req,{ok:false,error:"stripe_checkout_invalid"},502);
  return json(req,{ok:true,chargePattern:"separate",checkoutUrl:url,checkoutSessionId:sessionId,expiresAt})
});