import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

type J = Record<string, unknown>;
const TOLERANCE_SECONDS = 300;
const MAX_BODY_BYTES = 256 * 1024;

function obj(v: unknown): J { return v && typeof v === "object" && !Array.isArray(v) ? v as J : {}; }
function str(v: unknown): string | null { return typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null; }
function int(v: unknown): number | null { const n = Number(v); return Number.isInteger(n) ? n : null; }
function parseKeys(raw:string|undefined):Record<string,string>{try{return raw?JSON.parse(raw):{}}catch{return{}}}
function keyAwareFetch(apiKey:string):typeof fetch{return(input,init)=>{const h=new Headers(typeof Request!=="undefined"&&input instanceof Request?input.headers:undefined);if(init?.headers)new Headers(init.headers).forEach((v,k)=>h.set(k,v));if(apiKey.startsWith("sb_")&&h.get("Authorization")===`Bearer ${apiKey}`)h.delete("Authorization");h.set("apikey",apiKey);return fetch(input,{...init,headers:h})}}
function admin(){const url=Deno.env.get("SUPABASE_URL"),m=parseKeys(Deno.env.get("SUPABASE_SECRET_KEYS")),key=m.default??Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!url||!key)throw new Error("backend_configuration_missing");return createClient(url,key,{global:{fetch:keyAwareFetch(key)},auth:{persistSession:false,autoRefreshToken:false}})}
function response(status:number,body:unknown={ok:true}){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}
async function hmac(secret:string,value:string){const e=new TextEncoder();const k=await crypto.subtle.importKey("raw",e.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const d=await crypto.subtle.sign("HMAC",k,e.encode(value));return[...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function safeEq(a:string,b:string){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
async function validSignature(raw:string,header:string,secret:string){let ts="";const sigs:string[]=[];for(const part of header.split(",")){const i=part.indexOf("=");if(i<0)continue;const k=part.slice(0,i).trim(),v=part.slice(i+1).trim();if(k==="t")ts=v;if(k==="v1")sigs.push(v)}if(!ts||!sigs.length||!/^\d+$/.test(ts))return false;const drift=Math.abs(Date.now()/1000-Number(ts));if(!Number.isFinite(drift)||drift>TOLERANCE_SECONDS)return false;const computed=await hmac(secret,`${ts}.${raw}`);return sigs.some(s=>safeEq(s,computed))}

async function syncConnectedAccount(raw:J){const accountId=str(raw.id);if(!accountId)return false;const metadata=obj(raw.metadata);let storeId=str(metadata.comandiva_store_id);const a=admin();if(!storeId){const lookup=await a.rpc("backend_get_stripe_connect_store_id",{_stripe_account_id:accountId} as never);storeId=str(lookup.data)}if(!storeId)return false;const requirements=obj(raw.requirements);const {error}=await a.rpc("backend_upsert_stripe_connect_account",{_store_id:storeId,_stripe_account_id:accountId,_country:str(raw.country),_business_type:str(raw.business_type),_details_submitted:raw.details_submitted===true,_charges_enabled:raw.charges_enabled===true,_payouts_enabled:raw.payouts_enabled===true,_requirements_currently_due:Array.isArray(requirements.currently_due)?requirements.currently_due:[],_metadata:{source:"stripe_connect_webhook"}} as never);return !error}
async function syncPaymentIntent(raw:J,eventId:string,connectedAccount:string|null){const metadata=obj(raw.metadata);const orderId=str(metadata.comandiva_order_id),storeId=str(metadata.comandiva_store_id),pi=str(raw.id),status=str(raw.status),amount=int(raw.amount),currency=str(raw.currency);if(!orderId||!storeId||!pi||!status||!amount||!currency||!connectedAccount)return false;const fee=int(raw.application_fee_amount)??0;const {error}=await admin().rpc("backend_record_stripe_payment_intent",{_order_id:orderId,_store_id:storeId,_payment_intent_id:pi,_stripe_account_id:connectedAccount,_amount_cents:amount,_currency:currency,_application_fee_amount:fee,_status:status,_event_id:eventId,_last_error:status==="requires_payment_method"?str(obj(raw.last_payment_error).message):null,_metadata:{source:"stripe_connect_webhook"}} as never);return !error}

Deno.serve(async(req:Request)=>{
  const secret=Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET")?.trim()??"";
  if(req.method==="GET")return response(secret?200:503,{ok:Boolean(secret),provider:"stripe",scope:"connect"});
  if(req.method!=="POST")return response(405,{ok:false,error:"method_not_allowed"});
  const len=Number(req.headers.get("content-length")??0);if(Number.isFinite(len)&&len>MAX_BODY_BYTES)return response(413,{ok:false,error:"payload_too_large"});
  if(!secret)return response(503,{ok:false,error:"webhook_not_configured"});
  const raw=await req.text(),sig=req.headers.get("stripe-signature")??"";if(!await validSignature(raw,sig,secret))return response(401,{ok:false,error:"invalid_signature"});
  let event:J;try{event=obj(JSON.parse(raw))}catch{return response(400,{ok:false,error:"invalid_json"})}
  const eventId=str(event.id),eventType=str(event.type)??"unknown",connectedAccount=str(event.account);if(!eventId)return response(400,{ok:false,error:"event_id_missing"});
  const a=admin();const claim=await a.rpc("backend_claim_stripe_webhook_event",{_event_id:eventId,_event_type:eventType,_connected_account_id:connectedAccount} as never);if(claim.error)return response(500,{ok:false,error:"event_claim_failed"});if(claim.data==="duplicate")return response(200,{ok:true,duplicate:true});if(claim.data!=="process")return response(503,{ok:false,error:"event_in_progress"});
  const finish=async(status:"processed"|"ignored"|"failed",err:string|null=null)=>{await a.rpc("backend_finalize_stripe_webhook_event",{_event_id:eventId,_processing_status:status,_last_error:err} as never)};
  try{const resource=obj(obj(event.data).object);if(eventType==="account.updated"){const ok=await syncConnectedAccount(resource);await finish(ok?"processed":"ignored",ok?null:"account_not_mapped");return response(200,{ok:true,processed:ok})}if(eventType.startsWith("payment_intent.")){const ok=await syncPaymentIntent(resource,eventId,connectedAccount);await finish(ok?"processed":"ignored",ok?null:"payment_intent_not_mapped");return response(200,{ok:true,processed:ok})}await finish("ignored");return response(200,{ok:true,ignored:true})}catch(e){const msg=e instanceof Error?e.message:"webhook_processing_failed";await finish("failed",msg);return response(500,{ok:false,error:"webhook_processing_failed"})}
});
