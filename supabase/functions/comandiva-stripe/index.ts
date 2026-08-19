import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const STRIPE_API = "https://api.stripe.com";
const APP_ORIGIN = "https://shark-cardapio.lovable.app";
const MAX_BODY_BYTES = 64 * 1024;
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
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":allowedOrigin(req),"access-control-allow-headers":"content-type, authorization, apikey, x-idempotency-key","access-control-allow-methods":"GET, POST, OPTIONS",vary:"Origin"}})}
async function readBody(req:Request):Promise<J|null>{const len=Number(req.headers.get("content-length")??0);if(Number.isFinite(len)&&len>MAX_BODY_BYTES)return null;try{return obj(await req.json())}catch{return null}}
async function currentUser(req:Request):Promise<User|null>{const raw=req.headers.get("authorization")?.trim()??"";const m=/^Bearer\s+(.+)$/i.exec(raw);if(!m)return null;const {data,error}=await admin().auth.getUser(m[1]);if(error||!data.user)return null;return{id:data.user.id,email:data.user.email?.trim().toLowerCase()||null}}
async function rateLimit(key:string,limit:number,windowSeconds:number){const {data,error}=await admin().rpc("consume_edge_rate_limit",{_key:key,_limit:limit,_window_seconds:windowSeconds} as never);return !error&&data===true}
function secret(){return Deno.env.get("STRIPE_SECRET_KEY")?.trim()||null}
function publishable(){return Deno.env.get("STRIPE_PUBLISHABLE_KEY")?.trim()||null}
function connectEnabled(){return (Deno.env.get("STRIPE_CONNECT_ENABLED")??"").trim().toLowerCase()==="true"}
function form(data:Record<string,string|number|boolean|null|undefined>){const p=new URLSearchParams();for(const [k,v] of Object.entries(data)){if(v!==null&&v!==undefined)p.set(k,String(v))}return p}
async function stripe(path:string,init:{method?:string;data?:URLSearchParams;account?:string;idempotencyKey?:string}={}){const sk=secret();if(!sk)return{ok:false,status:503,body:{error:{message:"stripe_not_configured"}} as J};const h=new Headers({Authorization:`Bearer ${sk}`});if(init.data)h.set("content-type","application/x-www-form-urlencoded");if(init.account)h.set("Stripe-Account",init.account);if(init.idempotencyKey)h.set("Idempotency-Key",init.idempotencyKey);const c=new AbortController(),t=setTimeout(()=>c.abort(),TIMEOUT_MS);try{const r=await fetch(`${STRIPE_API}${path}`,{method:init.method??"GET",headers:h,body:init.data?.toString(),signal:c.signal});const b=obj(await r.json().catch(()=>({})));return{ok:r.ok,status:r.status,body:b}}finally{clearTimeout(t)}}
async function authorizeManager(actorId:string,storeId:string){const {data,error}=await admin().rpc("backend_authorize_store_manager",{_actor_user_id:actorId,_store_id:storeId} as never);return !error&&data===true}

async function providerHealth(req:Request){
  if(!(await rateLimit("stripe:health:minute",10,60))) return json(req,{ok:false,error:"rate_limited"},429);
  const sk=secret(),pk=publishable(),wh=Boolean(Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim()),ce=connectEnabled();
  if(!sk){await admin().rpc("backend_record_stripe_runtime_readiness",{_secret_key_configured:false,_publishable_key_configured:!!pk,_webhook_secret_configured:wh,_connect_enabled:ce,_provider_connected:false,_last_health_status:null,_last_error:"stripe_secret_missing"} as never);return json(req,{ok:false,provider:"stripe",configured:false,publishableKeyConfigured:!!pk,connectEnabled:ce},503)}
  try{const up=await stripe("/v1/balance");await admin().rpc("backend_record_stripe_runtime_readiness",{_secret_key_configured:true,_publishable_key_configured:!!pk,_webhook_secret_configured:wh,_connect_enabled:ce,_provider_connected:up.ok,_last_health_status:up.status,_last_error:up.ok?null:`stripe_${up.status}`} as never);return json(req,{ok:up.ok,provider:"stripe",configured:true,connected:up.ok,upstreamStatus:up.status,publishableKeyConfigured:!!pk,webhookConfigured:wh,connectEnabled:ce},up.ok?200:502)}catch{return json(req,{ok:false,error:"provider_unreachable"},502)}
}

async function createConnectAccount(req:Request){
  const u=await currentUser(req); if(!u)return json(req,{ok:false,error:"unauthorized"},401);
  const b=await readBody(req),storeId=str(b?.storeId); if(!storeId||!await authorizeManager(u.id,storeId))return json(req,{ok:false,error:"forbidden"},403);
  if(!connectEnabled())return json(req,{ok:false,error:"stripe_connect_not_enabled_for_platform",preview:true},503);
  if(!(await rateLimit(`stripe:connect:create:${u.id}:${storeId}`,3,3600)))return json(req,{ok:false,error:"rate_limited"},429);
  const a=admin(); const {data:existing}=await a.rpc("backend_get_stripe_connect_account",{_store_id:storeId} as never); if(existing&&typeof existing==="object")return json(req,{ok:true,reused:true,account:existing});
  const {data:store,error}=await a.from("stores").select("id,name").eq("id",storeId).maybeSingle(); if(error||!store)return json(req,{ok:false,error:"store_not_found"},404);
  const data=form({country:"BR",email:u.email??undefined,"controller[stripe_dashboard][type]":"none","capabilities[card_payments][requested]":true,"capabilities[transfers][requested]":true,"business_profile[name]":str((store as J).name)??"Comandiva Store","metadata[comandiva_store_id]":storeId});
  const up=await stripe("/v1/accounts",{method:"POST",data,idempotencyKey:`comandiva-connect-${storeId}`});
  if(!up.ok)return json(req,{ok:false,error:"stripe_account_create_failed",upstreamStatus:up.status,providerMessage:str(obj(up.body.error).message)},up.status>=500?502:409);
  const accountId=str(up.body.id); if(!accountId)return json(req,{ok:false,error:"stripe_account_invalid"},502);
  const requirements=obj(up.body.requirements); const saved=await a.rpc("backend_upsert_stripe_connect_account",{_store_id:storeId,_stripe_account_id:accountId,_country:str(up.body.country),_business_type:str(up.body.business_type),_details_submitted:up.body.details_submitted===true,_charges_enabled:up.body.charges_enabled===true,_payouts_enabled:up.body.payouts_enabled===true,_requirements_currently_due:Array.isArray(requirements.currently_due)?requirements.currently_due:[],_metadata:{source:"stripe_api",created_by:u.id}} as never);
  return json(req,{ok:true,reused:false,account:saved.data??{stripe_account_id:accountId}})
}

async function createAccountSession(req:Request){
  const u=await currentUser(req); if(!u)return json(req,{ok:false,error:"unauthorized"},401);
  const b=await readBody(req),storeId=str(b?.storeId); if(!storeId||!await authorizeManager(u.id,storeId))return json(req,{ok:false,error:"forbidden"},403);
  if(!connectEnabled())return json(req,{ok:false,error:"stripe_connect_not_enabled_for_platform",preview:true},503);
  const {data:acct,error}=await admin().rpc("backend_get_stripe_connect_account",{_store_id:storeId} as never); if(error||!acct)return json(req,{ok:false,error:"stripe_account_missing"},409);
  const accountId=str(obj(acct).stripe_account_id); if(!accountId)return json(req,{ok:false,error:"stripe_account_missing"},409);
  const data=form({account:accountId,"components[account_onboarding][enabled]":true,"components[account_management][enabled]":true,"components[notification_banner][enabled]":true,"components[payments][enabled]":true,"components[payments][features][refund_management]":true,"components[payments][features][dispute_management]":true,"components[payments][features][capture_payments]":true,"components[payouts][enabled]":true,"components[balances][enabled]":true,"components[documents][enabled]":true});
  const up=await stripe("/v1/account_sessions",{method:"POST",data,idempotencyKey:`comandiva-account-session-${storeId}-${crypto.randomUUID()}`});
  if(!up.ok)return json(req,{ok:false,error:"account_session_create_failed",upstreamStatus:up.status,providerMessage:str(obj(up.body.error).message)},up.status>=500?502:409);
  return json(req,{ok:true,clientSecret:str(up.body.client_secret),publishableKey:publishable(),accountId})
}

function stripePriceMatches(raw:J,amount:number,currency:string,interval:string){const recurring=obj(raw.recurring);return raw.active!==false&&int(raw.unit_amount)===amount&&str(raw.currency)?.toLowerCase()===currency.toLowerCase()&&str(recurring.interval)===(interval==="annual"?"year":"month")}
async function syncAddonPrice(req:Request){
  const u=await currentUser(req); if(!u)return json(req,{ok:false,error:"unauthorized"},401);
  const b=await readBody(req),priceId=str(b?.addonPriceId); if(!priceId)return json(req,{ok:false,error:"invalid_addon_price_id"},400);
  const a=admin(); const {data:ctx,error}=await a.rpc("billing_get_addon_price_sync_context",{_actor_user_id:u.id,_addon_price_id:priceId,_provider:"stripe"} as never); if(error)return json(req,{ok:false,error:error.code==="42501"?"forbidden":"price_sync_context_failed"},error.code==="42501"?403:409);
  const c=obj(ctx),amount=int(c.amount_cents),currency=str(c.currency)??"brl",interval=str(c.billing_interval)??"monthly"; if(!amount||amount<=0)return json(req,{ok:false,error:"invalid_price"},409);
  let stripePriceId=str(c.provider_plan_id),price:J|null=null;
  if(stripePriceId){const current=await stripe(`/v1/prices/${encodeURIComponent(stripePriceId)}`);if(current.ok&&stripePriceMatches(current.body,amount,currency,interval))price=current.body}
  if(!price){const data=form({currency:currency.toLowerCase(),unit_amount:amount,"recurring[interval]":interval==="annual"?"year":"month","product_data[name]":`Comandiva · ${str(c.addon_name)??str(c.addon_code)??"Adicional"}`,"product_data[metadata][comandiva_addon_id]":str(c.addon_id)??"","metadata[comandiva_addon_price_id]":priceId});const created=await stripe("/v1/prices",{method:"POST",data,idempotencyKey:`comandiva-stripe-price-${priceId}-${amount}-${interval}`});if(!created.ok)return json(req,{ok:false,error:"stripe_price_create_failed",upstreamStatus:created.status,providerMessage:str(obj(created.body.error).message)},created.status>=500?502:409);price=created.body;stripePriceId=str(price.id)}
  if(!stripePriceId)return json(req,{ok:false,error:"stripe_price_invalid"},502);
  const mapped=await a.rpc("billing_upsert_addon_provider_price_ref",{_actor_user_id:u.id,_addon_price_id:priceId,_provider:"stripe",_provider_plan_id:stripePriceId,_provider_status:"active",_metadata:{environment:secret()?.startsWith("sk_live_")?"live":"test",synced_at:new Date().toISOString()}} as never); if(mapped.error)return json(req,{ok:false,error:"provider_mapping_failed"},500);
  return json(req,{ok:true,provider:"stripe",priceId:stripePriceId,mapping:mapped.data})
}

async function ensureBillingCustomer(storeId:string,email:string){const a=admin();const {data:existing}=await a.rpc("backend_get_stripe_billing_customer",{_store_id:storeId} as never);const current=str(obj(existing).stripe_customer_id);if(current)return current;const data=form({email,"metadata[comandiva_store_id]":storeId});const up=await stripe("/v1/customers",{method:"POST",data,idempotencyKey:`comandiva-stripe-customer-${storeId}`});if(!up.ok)throw new Error(`customer_create_${up.status}`);const id=str(up.body.id);if(!id)throw new Error("customer_invalid");await a.rpc("backend_upsert_stripe_billing_customer",{_store_id:storeId,_stripe_customer_id:id,_email:email} as never);return id}

async function createAddonBillingCheckout(req:Request){
  const u=await currentUser(req); if(!u)return json(req,{ok:false,error:"unauthorized"},401); if(!u.email)return json(req,{ok:false,error:"account_email_required"},409);
  const b=await readBody(req),storeId=str(b?.storeId),addonCode=str(b?.addonCode),interval=str(b?.billingInterval)??"monthly",idem=req.headers.get("x-idempotency-key")?.trim()??"";
  if(!storeId||!addonCode||!/^[a-z0-9_]+$/.test(addonCode)||!["monthly","annual"].includes(interval)||idem.length<8)return json(req,{ok:false,error:"invalid_checkout_request"},400);
  if(!(await rateLimit(`stripe:addon:checkout:${u.id}:${storeId}`,8,60)))return json(req,{ok:false,error:"rate_limited"},429);
  const a=admin(); const {data:start,error}=await a.rpc("billing_begin_addon_checkout",{_actor_user_id:u.id,_store_id:storeId,_addon_code:addonCode,_billing_interval:interval,_idempotency_key:idem,_provider:"stripe"} as never); if(error)return json(req,{ok:false,error:error.code==="42501"?"forbidden":"addon_purchase_not_ready",detail:error.details??null},error.code==="42501"?403:409);
  const s=obj(start); if(str(s.checkout_url))return json(req,{ok:true,reused:true,provider:"stripe",checkoutUrl:str(s.checkout_url),attemptId:str(s.attempt_id)});
  try{const customer=await ensureBillingCustomer(storeId,u.email);const data=form({mode:"subscription",customer,"line_items[0][price]":str(s.provider_plan_id)??"","line_items[0][quantity]":1,success_url:`${APP_ORIGIN}/app/loja/plano?stripe=success&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${APP_ORIGIN}/app/loja/plano?stripe=cancelled`,client_reference_id:str(s.external_reference)??"","metadata[comandiva_external_reference]":str(s.external_reference)??"","metadata[comandiva_attempt_id]":str(s.attempt_id)??"","metadata[comandiva_store_id]":storeId,"metadata[comandiva_billing_kind]":"addon","subscription_data[metadata][comandiva_external_reference]":str(s.external_reference)??"","subscription_data[metadata][comandiva_attempt_id]":str(s.attempt_id)??"","subscription_data[metadata][comandiva_store_id]":storeId,"subscription_data[metadata][comandiva_billing_kind]":"addon"});const trial=int(s.trial_days);if(trial&&trial>0){data.set("subscription_data[trial_period_days]",String(trial));data.set("payment_method_collection","if_required");data.set("subscription_data[trial_settings][end_behavior][missing_payment_method]","cancel")}const up=await stripe("/v1/checkout/sessions",{method:"POST",data,idempotencyKey:`comandiva-stripe-addon-checkout-${str(s.attempt_id)}`});if(!up.ok){await a.rpc("billing_mark_addon_checkout_error",{_actor_user_id:u.id,_attempt_id:str(s.attempt_id),_failure_code:`stripe_checkout_${up.status}`,_last_error:str(obj(up.body.error).message)??"stripe_checkout_failed",_definitive:up.status>=400&&up.status<500} as never);return json(req,{ok:false,error:"stripe_checkout_create_failed",upstreamStatus:up.status,providerMessage:str(obj(up.body.error).message)},up.status>=500?502:409)}const sid=str(up.body.id),url=str(up.body.url);if(!sid||!url)return json(req,{ok:false,error:"stripe_checkout_invalid"},502);const done=await a.rpc("billing_complete_addon_checkout_session_create",{_actor_user_id:u.id,_attempt_id:str(s.attempt_id),_provider:"stripe",_provider_checkout_id:sid,_provider_status:str(up.body.status)??"open",_checkout_url:url} as never);if(done.error)return json(req,{ok:false,error:"checkout_attach_failed"},500);return json(req,{ok:true,reused:false,provider:"stripe",attemptId:str(s.attempt_id),checkoutSessionId:sid,checkoutUrl:url})}catch(e){return json(req,{ok:false,error:e instanceof Error?e.message:"stripe_checkout_failed"},502)}
}

async function createPlanCheckout(req:Request){
  const u=await currentUser(req); if(!u)return json(req,{ok:false,error:"unauthorized"},401); if(!u.email)return json(req,{ok:false,error:"account_email_required"},409);
  const b=await readBody(req),storeId=str(b?.storeId),planCode=str(b?.planCode)?.toLowerCase()??null,interval=str(b?.billingInterval)??"monthly",idem=req.headers.get("x-idempotency-key")?.trim()??"";
  if(!storeId||!planCode||!/^[a-z0-9_]+$/.test(planCode)||!["monthly","annual"].includes(interval)||idem.length<8)return json(req,{ok:false,error:"invalid_plan_checkout_request"},400);
  if(!(await rateLimit(`stripe:plan:checkout:${u.id}:${storeId}`,6,60)))return json(req,{ok:false,error:"rate_limited"},429);
  const a=admin();
  const {data:start,error}=await a.rpc("billing_begin_plan_checkout",{_actor_user_id:u.id,_store_id:storeId,_plan_code:planCode,_billing_interval:interval,_idempotency_key:idem} as never);
  if(error){const msg=error.message??"";const code=error.code==="42501"?"forbidden":msg.includes("ACTIVE_SUBSCRIPTION_EXISTS")?"active_subscription_exists":msg.includes("FREE_PLAN")?"free_plan_requires_no_checkout":"plan_checkout_not_ready";return json(req,{ok:false,error:code,detail:error.details??null},error.code==="42501"?403:409)}
  const s=obj(start);if(str(s.checkout_url))return json(req,{ok:true,reused:true,provider:"stripe",checkoutUrl:str(s.checkout_url),attemptId:str(s.attempt_id)});
  try{
    const customer=await ensureBillingCustomer(storeId,u.email);
    const data=form({mode:"subscription",customer,"line_items[0][price]":str(s.provider_price_id)??"","line_items[0][quantity]":1,success_url:`${APP_ORIGIN}/app/loja/plano?stripe=success&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${APP_ORIGIN}/app/loja/plano?stripe=cancelled`,client_reference_id:str(s.external_reference)??"","metadata[comandiva_external_reference]":str(s.external_reference)??"","metadata[comandiva_attempt_id]":str(s.attempt_id)??"","metadata[comandiva_store_id]":storeId,"metadata[comandiva_plan_code]":planCode,"metadata[comandiva_billing_kind]":"plan","subscription_data[metadata][comandiva_external_reference]":str(s.external_reference)??"","subscription_data[metadata][comandiva_attempt_id]":str(s.attempt_id)??"","subscription_data[metadata][comandiva_store_id]":storeId,"subscription_data[metadata][comandiva_plan_code]":planCode,"subscription_data[metadata][comandiva_billing_kind]":"plan"});
    const trial=int(s.trial_days);if(trial&&trial>0){data.set("subscription_data[trial_period_days]",String(trial));data.set("payment_method_collection","if_required");data.set("subscription_data[trial_settings][end_behavior][missing_payment_method]","cancel")}
    const up=await stripe("/v1/checkout/sessions",{method:"POST",data,idempotencyKey:`comandiva-stripe-plan-checkout-${str(s.attempt_id)}`});
    if(!up.ok){await a.rpc("billing_mark_plan_checkout_error",{_actor_user_id:u.id,_attempt_id:str(s.attempt_id),_failure_code:`stripe_checkout_${up.status}`,_last_error:str(obj(up.body.error).message)??"stripe_checkout_failed",_definitive:up.status>=400&&up.status<500} as never);return json(req,{ok:false,error:"stripe_checkout_create_failed",upstreamStatus:up.status,providerMessage:str(obj(up.body.error).message)},up.status>=500?502:409)}
    const sid=str(up.body.id),url=str(up.body.url);if(!sid||!url)return json(req,{ok:false,error:"stripe_checkout_invalid"},502);
    const done=await a.rpc("billing_complete_plan_checkout_session_create",{_actor_user_id:u.id,_attempt_id:str(s.attempt_id),_provider_checkout_id:sid,_provider_status:str(up.body.status)??"open",_checkout_url:url} as never);if(done.error)return json(req,{ok:false,error:"checkout_attach_failed"},500);
    return json(req,{ok:true,reused:false,provider:"stripe",attemptId:str(s.attempt_id),checkoutSessionId:sid,checkoutUrl:url,planCode,billingInterval:interval,trialDays:trial??0});
  }catch(e){return json(req,{ok:false,error:e instanceof Error?e.message:"stripe_plan_checkout_failed"},502)}
}

async function createBillingPortal(req:Request){
  const u=await currentUser(req);if(!u)return json(req,{ok:false,error:"unauthorized"},401);
  const b=await readBody(req),storeId=str(b?.storeId);if(!storeId||!await authorizeManager(u.id,storeId))return json(req,{ok:false,error:"forbidden"},403);
  if(!(await rateLimit(`stripe:portal:${u.id}:${storeId}`,8,60)))return json(req,{ok:false,error:"rate_limited"},429);
  const {data:existing,error}=await admin().rpc("backend_get_stripe_billing_customer",{_store_id:storeId} as never);if(error)return json(req,{ok:false,error:"billing_customer_lookup_failed"},500);
  const customer=str(obj(existing).stripe_customer_id);if(!customer)return json(req,{ok:false,error:"billing_customer_missing"},409);
  const up=await stripe("/v1/billing_portal/sessions",{method:"POST",data:form({customer,return_url:`${APP_ORIGIN}/app/loja/plano`}),idempotencyKey:`comandiva-portal-${storeId}-${crypto.randomUUID()}`});
  if(!up.ok)return json(req,{ok:false,error:"billing_portal_create_failed",upstreamStatus:up.status,providerMessage:str(obj(up.body.error).message)},up.status>=500?502:409);
  const url=str(up.body.url);return url?json(req,{ok:true,url}):json(req,{ok:false,error:"billing_portal_invalid"},502)
}

async function createOrderPaymentIntent(req:Request){
  const b=await readBody(req),orderId=str(b?.orderId),trackingToken=str(b?.trackingToken); if(!orderId||!trackingToken)return json(req,{ok:false,error:"invalid_order_payment_request"},400);
  if(!(await rateLimit(`stripe:order-payment:${orderId}`,8,60)))return json(req,{ok:false,error:"rate_limited"},429);
  const a=admin(); const {data:ctx,error}=await a.rpc("backend_get_order_stripe_payment_context",{_order_id:orderId,_tracking_token:trackingToken} as never); if(error||!ctx)return json(req,{ok:false,error:"order_not_found"},404);
  const c=obj(ctx); if(c.ready!==true)return json(req,{ok:false,error:str(c.reason)??"stripe_connect_not_ready"},409);
  const account=str(c.stripe_account_id),amount=int(c.amount_cents),fee=int(c.application_fee_amount)??0,currency=str(c.currency)??"brl"; if(!account||!amount)return json(req,{ok:false,error:"payment_context_invalid"},409);
  const data=form({amount,currency,"automatic_payment_methods[enabled]":true,description:`Comandiva pedido #${str(c.order_number)??""}`,"metadata[comandiva_order_id]":orderId,"metadata[comandiva_store_id]":str(c.store_id)??""}); if(fee>0)data.set("application_fee_amount",String(fee));
  const up=await stripe("/v1/payment_intents",{method:"POST",data,account,idempotencyKey:`comandiva-order-${orderId}`}); if(!up.ok)return json(req,{ok:false,error:"payment_intent_create_failed",upstreamStatus:up.status,providerMessage:str(obj(up.body.error).message)},up.status>=500?502:409);
  const pi=str(up.body.id),clientSecret=str(up.body.client_secret),status=str(up.body.status)??"requires_payment_method"; if(!pi||!clientSecret)return json(req,{ok:false,error:"payment_intent_invalid"},502);
  await a.rpc("backend_record_stripe_payment_intent",{_order_id:orderId,_store_id:str(c.store_id),_payment_intent_id:pi,_stripe_account_id:account,_amount_cents:amount,_currency:currency,_application_fee_amount:fee,_status:status,_event_id:null,_last_error:null,_metadata:{source:"create_payment_intent"}} as never);
  return json(req,{ok:true,provider:"stripe",publishableKey:publishable(),connectedAccountId:account,clientSecret,status,amount,currency})
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return json(req,{ok:true});
  const url=new URL(req.url),action=url.searchParams.get("action")??"";
  if(req.method==="GET"&&action==="provider_health")return providerHealth(req);
  if(req.method==="GET"&&action==="public_config")return json(req,{provider:"stripe",publishableKey:publishable(),configured:Boolean(secret()&&publishable()),connectEnabled:connectEnabled()});
  if(req.method==="POST"&&action==="create_connect_account")return createConnectAccount(req);
  if(req.method==="POST"&&action==="create_account_session")return createAccountSession(req);
  if(req.method==="POST"&&action==="sync_addon_price")return syncAddonPrice(req);
  if(req.method==="POST"&&(action==="create_billing_checkout"||action==="create_addon_checkout"))return createAddonBillingCheckout(req);
  if(req.method==="POST"&&action==="create_plan_checkout")return createPlanCheckout(req);
  if(req.method==="POST"&&action==="create_billing_portal")return createBillingPortal(req);
  if(req.method==="POST"&&action==="create_order_payment_intent")return createOrderPaymentIntent(req);
  return json(req,{ok:false,error:"action_not_allowed"},403)
});
