import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const STRIPE_API = "https://api.stripe.com";
const APP_ORIGIN = "https://shark-cardapio.lovable.app";
const MAX_BODY_BYTES = 32 * 1024;
const TIMEOUT_MS = 10_000;
type J = Record<string, unknown>;
type User = { id: string; email: string | null };
function obj(v:unknown):J{return v&&typeof v==="object"&&!Array.isArray(v)?v as J:{}}
function str(v:unknown):string|null{return typeof v==="string"&&v.trim()?v.trim():typeof v==="number"?String(v):null}
function int(v:unknown):number|null{const n=Number(v);return Number.isInteger(n)?n:null}
function parseKeys(raw:string|undefined):Record<string,string>{try{return raw?JSON.parse(raw):{}}catch{return{}}}
function keyAwareFetch(apiKey:string):typeof fetch{return(input,init)=>{const h=new Headers(typeof Request!=="undefined"&&input instanceof Request?input.headers:undefined);if(init?.headers)new Headers(init.headers).forEach((v,k)=>h.set(k,v));if(apiKey.startsWith("sb_")&&h.get("Authorization")===`Bearer ${apiKey}`)h.delete("Authorization");h.set("apikey",apiKey);return fetch(input,{...init,headers:h})}}
function admin(){const url=Deno.env.get("SUPABASE_URL"),m=parseKeys(Deno.env.get("SUPABASE_SECRET_KEYS")),key=m.default??Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!url||!key)throw new Error("backend_configuration_missing");return createClient(url,key,{global:{fetch:keyAwareFetch(key)},auth:{persistSession:false,autoRefreshToken:false}})}
function allowedOrigin(req:Request){const o=req.headers.get("origin")??"";return o===APP_ORIGIN||/^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(o)?o:APP_ORIGIN}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":allowedOrigin(req),"access-control-allow-headers":"content-type, authorization, apikey","access-control-allow-methods":"POST, OPTIONS",vary:"Origin"}})}
async function body(req:Request){const len=Number(req.headers.get("content-length")??0);if(Number.isFinite(len)&&len>MAX_BODY_BYTES)return null;try{return obj(await req.json())}catch{return null}}
async function user(req:Request):Promise<User|null>{const m=/^Bearer\s+(.+)$/i.exec(req.headers.get("authorization")?.trim()??"");if(!m)return null;const {data,error}=await admin().auth.getUser(m[1]);if(error||!data.user)return null;return{id:data.user.id,email:data.user.email?.trim().toLowerCase()||null}}
async function rate(key:string,limit:number,seconds:number){const {data,error}=await admin().rpc("consume_edge_rate_limit",{_key:key,_limit:limit,_window_seconds:seconds} as never);return !error&&data===true}
function form(entries:Record<string,string|number|boolean|null|undefined>){const p=new URLSearchParams();for(const [k,v] of Object.entries(entries))if(v!==null&&v!==undefined)p.set(k,String(v));return p}
async function stripe(path:string,init:{method?:string;data?:URLSearchParams;idempotencyKey?:string}={}){const sk=Deno.env.get("STRIPE_SECRET_KEY")?.trim();if(!sk)return{ok:false,status:503,body:{error:{message:"stripe_not_configured"}} as J};const h=new Headers({Authorization:`Bearer ${sk}`});if(init.data)h.set("content-type","application/x-www-form-urlencoded");if(init.idempotencyKey)h.set("Idempotency-Key",init.idempotencyKey);const c=new AbortController(),t=setTimeout(()=>c.abort(),TIMEOUT_MS);try{const r=await fetch(`${STRIPE_API}${path}`,{method:init.method??"GET",headers:h,body:init.data?.toString(),signal:c.signal});return{ok:r.ok,status:r.status,body:obj(await r.json().catch(()=>({})))}}finally{clearTimeout(t)}}
function providerError(req:Request,code:string,up:{status:number;body:J}){return json(req,{ok:false,error:code,upstreamStatus:up.status,providerMessage:str(obj(up.body.error).message)},up.status>=500?502:409)}

async function context(actor:string,storeId:string,planCode?:string|null,interval?:string|null){return admin().rpc("backend_get_plan_lifecycle_context",{_actor_user_id:actor,_store_id:storeId,_target_plan_code:planCode??null,_billing_interval:interval??null} as never)}

async function changePlan(req:Request,u:User,b:J){
  const storeId=str(b.storeId),planCode=str(b.planCode)?.toLowerCase(),interval=str(b.billingInterval)??"monthly";
  if(!storeId||!planCode||!["essencial","profissional","avancado"].includes(planCode)||!["monthly","annual"].includes(interval))return json(req,{ok:false,error:"invalid_plan_change_request"},400);
  if(!await rate(`stripe:plan-change:${u.id}:${storeId}`,5,60))return json(req,{ok:false,error:"rate_limited"},429);
  const c=await context(u.id,storeId,planCode,interval);if(c.error)return json(req,{ok:false,error:c.error.code==="42501"?"forbidden":c.error.message?.includes("SAME_PLAN")?"same_plan":"plan_change_not_ready"},c.error.code==="42501"?403:409);
  const x=obj(c.data),sid=str(x.provider_subscription_id),itemId=str(x.provider_item_id),targetPrice=str(x.target_provider_price_id),direction=str(x.direction),currentPrice=str(x.current_provider_price_id),targetPlanId=str(x.target_plan_id),targetPriceId=str(x.target_plan_price_id),effectiveAt=str(x.current_period_end_at);
  if(!sid||!itemId||!targetPrice||!direction||!targetPlanId||!targetPriceId)return json(req,{ok:false,error:"plan_change_not_ready"},409);
  if(!["active","trialing","past_due"].includes(str(x.provider_status)??""))return json(req,{ok:false,error:"plan_change_not_ready"},409);

  if(direction==="upgrade"){
    const data=form({"items[0][id]":itemId,"items[0][price]":targetPrice,"items[0][quantity]":1,payment_behavior:"pending_if_incomplete",proration_behavior:"always_invoice","metadata[comandiva_plan_change]":"upgrade","metadata[comandiva_target_plan_code]":planCode});
    const up=await stripe(`/v1/subscriptions/${encodeURIComponent(sid)}`,{method:"POST",data,idempotencyKey:`comandiva-plan-upgrade-${storeId}-${targetPrice}`});
    if(!up.ok)return providerError(req,"stripe_subscription_update_failed",up);
    const pending=obj(up.body.pending_update);return json(req,{ok:true,action:"upgrade",scheduled:false,providerStatus:str(up.body.status),paymentPending:Object.keys(pending).length>0});
  }

  if(!effectiveAt||!currentPrice)return json(req,{ok:false,error:"plan_change_not_ready"},409);
  const effectiveUnix=Math.floor(new Date(effectiveAt).getTime()/1000);if(!Number.isFinite(effectiveUnix)||effectiveUnix<=Math.floor(Date.now()/1000))return json(req,{ok:false,error:"plan_change_not_ready"},409);
  let scheduleId=str(x.provider_schedule_id);
  if(!scheduleId){
    const created=await stripe("/v1/subscription_schedules",{method:"POST",data:form({from_subscription:sid}),idempotencyKey:`comandiva-plan-schedule-${storeId}-${sid}`});
    if(!created.ok)return providerError(req,"stripe_schedule_create_failed",created);
    scheduleId=str(created.body.id);if(!scheduleId)return json(req,{ok:false,error:"stripe_schedule_create_failed"},502);
  }
  const durationInterval=interval==="annual"?"year":"month";
  const scheduleData=form({
    end_behavior:"release",proration_behavior:"none",
    "phases[0][start_date]":"now","phases[0][end_date]":effectiveUnix,"phases[0][items][0][price]":currentPrice,"phases[0][items][0][quantity]":1,"phases[0][proration_behavior]":"none",
    "phases[1][items][0][price]":targetPrice,"phases[1][items][0][quantity]":1,"phases[1][duration][interval]":durationInterval,"phases[1][duration][interval_count]":1,"phases[1][proration_behavior]":"none",
    "phases[1][metadata][comandiva_plan_change]":"downgrade","phases[1][metadata][comandiva_target_plan_code]":planCode
  });
  const scheduled=await stripe(`/v1/subscription_schedules/${encodeURIComponent(scheduleId)}`,{method:"POST",data:scheduleData,idempotencyKey:`comandiva-plan-downgrade-${storeId}-${targetPrice}-${effectiveUnix}`});
  if(!scheduled.ok)return providerError(req,"stripe_schedule_create_failed",scheduled);
  const staged=await admin().rpc("backend_stage_plan_change",{_store_id:storeId,_target_plan_id:targetPlanId,_target_plan_price_id:targetPriceId,_effective_at:effectiveAt,_provider_schedule_id:scheduleId} as never);if(staged.error)return json(req,{ok:false,error:"plan_change_projection_failed"},500);
  return json(req,{ok:true,action:"downgrade",scheduled:true,effectiveAt});
}

async function cancelPlan(req:Request,u:User,b:J){
  const storeId=str(b.storeId);if(!storeId)return json(req,{ok:false,error:"invalid_store"},400);if(!await rate(`stripe:plan-cancel:${u.id}:${storeId}`,4,60))return json(req,{ok:false,error:"rate_limited"},429);
  const c=await context(u.id,storeId);if(c.error)return json(req,{ok:false,error:c.error.code==="42501"?"forbidden":"plan_change_not_ready"},c.error.code==="42501"?403:409);const x=obj(c.data),sid=str(x.provider_subscription_id),effectiveAt=str(x.current_period_end_at);if(!sid)return json(req,{ok:false,error:"plan_change_not_ready"},409);
  const up=await stripe(`/v1/subscriptions/${encodeURIComponent(sid)}`,{method:"POST",data:form({cancel_at_period_end:true}),idempotencyKey:`comandiva-plan-cancel-${storeId}-${sid}`});if(!up.ok)return providerError(req,"stripe_cancel_failed",up);
  await admin().rpc("backend_set_plan_cancel_state",{_store_id:storeId,_cancel_at_period_end:true} as never);return json(req,{ok:true,action:"cancel",effectiveAt});
}

async function resumePlan(req:Request,u:User,b:J){
  const storeId=str(b.storeId);if(!storeId)return json(req,{ok:false,error:"invalid_store"},400);if(!await rate(`stripe:plan-resume:${u.id}:${storeId}`,4,60))return json(req,{ok:false,error:"rate_limited"},429);
  const c=await context(u.id,storeId);if(c.error)return json(req,{ok:false,error:c.error.code==="42501"?"forbidden":"plan_change_not_ready"},c.error.code==="42501"?403:409);const x=obj(c.data),sid=str(x.provider_subscription_id);if(!sid)return json(req,{ok:false,error:"plan_change_not_ready"},409);
  const up=await stripe(`/v1/subscriptions/${encodeURIComponent(sid)}`,{method:"POST",data:form({cancel_at_period_end:false}),idempotencyKey:`comandiva-plan-resume-${storeId}-${sid}`});if(!up.ok)return providerError(req,"stripe_resume_failed",up);
  await admin().rpc("backend_set_plan_cancel_state",{_store_id:storeId,_cancel_at_period_end:false} as never);return json(req,{ok:true,action:"resume"});
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return json(req,{ok:true});if(req.method!=="POST")return json(req,{ok:false,error:"method_not_allowed"},405);
  const u=await user(req);if(!u)return json(req,{ok:false,error:"unauthorized"},401);const b=await body(req);if(!b)return json(req,{ok:false,error:"invalid_body"},400);
  const action=new URL(req.url).searchParams.get("action")??"";
  if(action==="change_plan")return changePlan(req,u,b);
  if(action==="cancel_plan")return cancelPlan(req,u,b);
  if(action==="resume_plan")return resumePlan(req,u,b);
  return json(req,{ok:false,error:"action_not_allowed"},403);
});
