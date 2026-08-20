import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const STRIPE_API = "https://api.stripe.com";
const APP_ORIGIN = "https://shark-cardapio.lovable.app";
const MAX_BODY_BYTES = 32 * 1024;
const TIMEOUT_MS = 10_000;

type J = Record<string, unknown>;
type User = { id: string; email: string | null };

function obj(v: unknown): J { return v && typeof v === "object" && !Array.isArray(v) ? v as J : {}; }
function str(v: unknown): string | null { return typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null; }
function int(v: unknown): number | null { const n = Number(v); return Number.isInteger(n) ? n : null; }
function parseKeys(raw: string | undefined): Record<string,string> { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
function keyAwareFetch(apiKey: string): typeof fetch { return (input, init) => { const h = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined); if (init?.headers) new Headers(init.headers).forEach((v,k)=>h.set(k,v)); if (apiKey.startsWith("sb_") && h.get("Authorization") === `Bearer ${apiKey}`) h.delete("Authorization"); h.set("apikey", apiKey); return fetch(input,{...init,headers:h}); }; }
function admin() { const url=Deno.env.get("SUPABASE_URL"), modern=parseKeys(Deno.env.get("SUPABASE_SECRET_KEYS")), key=modern.default??Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if(!url||!key) throw new Error("backend_configuration_missing"); return createClient(url,key,{global:{fetch:keyAwareFetch(key)},auth:{persistSession:false,autoRefreshToken:false}}); }
function allowedOrigin(req: Request){ const o=req.headers.get("origin")??""; if(o===APP_ORIGIN||/^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(o)) return o; return APP_ORIGIN; }
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":allowedOrigin(req),"access-control-allow-headers":"content-type, authorization, apikey, x-idempotency-key","access-control-allow-methods":"POST, OPTIONS",vary:"Origin"}})}
async function readBody(req:Request):Promise<J|null>{const len=Number(req.headers.get("content-length")??0);if(Number.isFinite(len)&&len>MAX_BODY_BYTES)return null;try{return obj(await req.json())}catch{return null}}
async function currentUser(req:Request):Promise<User|null>{const raw=req.headers.get("authorization")?.trim()??"";const m=/^Bearer\s+(.+)$/i.exec(raw);if(!m)return null;const {data,error}=await admin().auth.getUser(m[1]);if(error||!data.user)return null;return{id:data.user.id,email:data.user.email?.trim().toLowerCase()||null}}
async function rateLimit(key:string,limit:number,windowSeconds:number){const {data,error}=await admin().rpc("consume_edge_rate_limit",{_key:key,_limit:limit,_window_seconds:windowSeconds} as never);return !error&&data===true}
function secret(){return Deno.env.get("STRIPE_SECRET_KEY")?.trim()||null}
function form(data:Record<string,string|number|boolean|null|undefined>){const p=new URLSearchParams();for(const [k,v] of Object.entries(data)){if(v!==null&&v!==undefined)p.set(k,String(v))}return p}
async function stripe(path:string,init:{method?:string;data?:URLSearchParams;idempotencyKey?:string}={}){const sk=secret();if(!sk)return{ok:false,status:503,body:{error:{message:"stripe_not_configured"}} as J};const h=new Headers({Authorization:`Bearer ${sk}`});if(init.data)h.set("content-type","application/x-www-form-urlencoded");if(init.idempotencyKey)h.set("Idempotency-Key",init.idempotencyKey);const c=new AbortController(),t=setTimeout(()=>c.abort(),TIMEOUT_MS);try{const r=await fetch(`${STRIPE_API}${path}`,{method:init.method??"GET",headers:h,body:init.data?.toString(),signal:c.signal});const b=obj(await r.json().catch(()=>({})));return{ok:r.ok,status:r.status,body:b}}finally{clearTimeout(t)}}
async function authorizeManager(actorId:string,storeId:string){const {data,error}=await admin().rpc("backend_authorize_store_manager",{_actor_user_id:actorId,_store_id:storeId} as never);return !error&&data===true}
async function ensureBillingCustomer(storeId:string,email:string){const a=admin();const {data:existing}=await a.rpc("backend_get_stripe_billing_customer",{_store_id:storeId} as never);const current=str(obj(existing).stripe_customer_id);if(current)return current;const data=form({email,"metadata[comandiva_store_id]":storeId});const up=await stripe("/v1/customers",{method:"POST",data,idempotencyKey:`comandiva-stripe-customer-${storeId}`});if(!up.ok)throw new Error(`customer_create_${up.status}`);const id=str(up.body.id);if(!id)throw new Error("customer_invalid");await a.rpc("backend_upsert_stripe_billing_customer",{_store_id:storeId,_stripe_customer_id:id,_email:email} as never);return id}

async function createCheckout(req:Request){
  const u=await currentUser(req); if(!u)return json(req,{ok:false,error:"unauthorized"},401); if(!u.email)return json(req,{ok:false,error:"account_email_required"},409);
  const b=await readBody(req),storeId=str(b?.storeId),orderId=str(b?.orderId),idem=req.headers.get("x-idempotency-key")?.trim()??"";
  if(!storeId||!orderId||idem.length<8||idem.length>160)return json(req,{ok:false,error:"invalid_checkout_request"},400);
  if(!await authorizeManager(u.id,storeId))return json(req,{ok:false,error:"forbidden"},403);
  if(!(await rateLimit(`stripe:professional-service:${u.id}:${storeId}`,6,60)))return json(req,{ok:false,error:"rate_limited"},429);

  const a=admin();
  const {data:order,error}=await a.from("professional_service_orders")
    .select("id,store_id,service_id,status,price_cents,currency,stripe_checkout_session_id,checkout_url,professional_services(name,code)")
    .eq("id",orderId).eq("store_id",storeId).maybeSingle();
  if(error||!order)return json(req,{ok:false,error:"service_order_not_found"},404);
  const o=obj(order); const status=str(o.status);
  if(status==="paid"||status==="in_progress"||status==="delivered")return json(req,{ok:false,error:"service_order_already_paid"},409);
  if(status!=="requested"&&status!=="awaiting_payment")return json(req,{ok:false,error:"service_order_not_payable"},409);
  const amount=int(o.price_cents),currency=(str(o.currency)??"brl").toLowerCase(); if(!amount||amount<=0)return json(req,{ok:false,error:"service_order_price_invalid"},409);

  const existingSession=str(o.stripe_checkout_session_id);
  if(existingSession){
    const existing=await stripe(`/v1/checkout/sessions/${encodeURIComponent(existingSession)}`);
    if(existing.ok&&str(existing.body.status)==="open"&&str(existing.body.url))return json(req,{ok:true,reused:true,provider:"stripe",orderId,checkoutSessionId:existingSession,checkoutUrl:str(existing.body.url)});
  }

  const service=obj(o.professional_services); const serviceName=str(service.name)??"Serviço profissional Comandiva";
  try{
    const customer=await ensureBillingCustomer(storeId,u.email);
    const data=form({
      mode:"payment",customer,
      "line_items[0][price_data][currency]":currency,
      "line_items[0][price_data][unit_amount]":amount,
      "line_items[0][price_data][product_data][name]":serviceName,
      "line_items[0][price_data][product_data][metadata][comandiva_service_order_id]":orderId,
      "line_items[0][quantity]":1,
      success_url:`${APP_ORIGIN}/app/loja/cardapio/servico?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${APP_ORIGIN}/app/loja/cardapio/servico?stripe=cancelled`,
      client_reference_id:`comandiva:professional_service:${orderId}`,
      "metadata[comandiva_billing_kind]":"professional_service",
      "metadata[comandiva_service_order_id]":orderId,
      "metadata[comandiva_store_id]":storeId,
      "payment_intent_data[metadata][comandiva_billing_kind]":"professional_service",
      "payment_intent_data[metadata][comandiva_service_order_id]":orderId,
      "payment_intent_data[metadata][comandiva_store_id]":storeId,
    });
    const up=await stripe("/v1/checkout/sessions",{method:"POST",data,idempotencyKey:`comandiva-prof-service-${orderId}-${idem}`});
    if(!up.ok)return json(req,{ok:false,error:"stripe_checkout_create_failed",upstreamStatus:up.status,providerMessage:str(obj(up.body.error).message)},up.status>=500?502:409);
    const sessionId=str(up.body.id),checkoutUrl=str(up.body.url); if(!sessionId||!checkoutUrl)return json(req,{ok:false,error:"stripe_checkout_invalid"},502);
    const saved=await a.rpc("backend_mark_professional_service_checkout",{_order_id:orderId,_checkout_session_id:sessionId,_checkout_url:checkoutUrl} as never);
    if(saved.error)return json(req,{ok:false,error:"checkout_persistence_failed"},500);
    return json(req,{ok:true,reused:false,provider:"stripe",orderId,checkoutSessionId:sessionId,checkoutUrl});
  }catch(e){return json(req,{ok:false,error:e instanceof Error?e.message:"checkout_failed"},500)}
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return json(req,{ok:true});
  if(req.method!=="POST")return json(req,{ok:false,error:"method_not_allowed"},405);
  const action=new URL(req.url).searchParams.get("action")??"";
  if(action==="create_checkout")return createCheckout(req);
  return json(req,{ok:false,error:"action_not_allowed"},403);
});