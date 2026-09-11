// Restricted server-side Supabase facade for Project Spark / Comandiva.
// Privilege elevation stays inside narrowly scoped Edge Functions.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const EXTERNAL_SUPABASE_URL = 'https://ypgteuxzgqmkkkpvibhi.supabase.co';
const BACKEND_EDGE_URL = `${EXTERNAL_SUPABASE_URL}/functions/v1/pediu-backend-api`;
const STORE_SIGNUP_EDGE_URL = `${EXTERNAL_SUPABASE_URL}/functions/v1/comandiva-store-signup`;
const EDGE_REQUEST_TIMEOUT_MS = 15_000;

const EDGE_RPC_ALLOWLIST = new Set([
  'check_public_store_slug','storefront_store','storefront_catalog','storefront_product','storefront_price',
  'storefront_fulfillment','storefront_validate_fulfillment','storefront_payment_methods','storefront_submit_order','storefront_order_tracking',
]);

function publishableKey(): string {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!key) throw new Error('SUPABASE_PUBLISHABLE_KEY is not configured');
  return key;
}

export class PediuBackendApiError extends Error {
  constructor(public readonly code:string,public readonly status:number){super(code);this.name='PediuBackendApiError'}
}
type EdgeEnvelope<T>={ok:true;data:T}|{ok:false;error?:string};
type BackendActionOptions={accessToken?:string};

async function invokeEdgeEnvelope<T>(url:string,payload:Record<string,unknown>,options:BackendActionOptions={}):Promise<T>{
  const headers=new Headers({'content-type':'application/json',apikey:publishableKey()});
  if(options.accessToken)headers.set('authorization',`Bearer ${options.accessToken}`);

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),EDGE_REQUEST_TIMEOUT_MS);
  let response:Response;
  try{
    response=await fetch(url,{method:'POST',headers,body:JSON.stringify(payload),signal:controller.signal});
  }catch(error){
    if(error instanceof Error&&error.name==='AbortError')throw new PediuBackendApiError('backend_timeout',504);
    throw new PediuBackendApiError('backend_unavailable',503);
  }finally{
    clearTimeout(timeout);
  }

  let parsed:EdgeEnvelope<T>|null=null;
  try{parsed=await response.json() as EdgeEnvelope<T>}catch{throw new PediuBackendApiError('backend_invalid_response',response.status||502)}
  if(!response.ok||!parsed||parsed.ok!==true){const code=parsed&&parsed.ok===false?parsed.error??'backend_unavailable':'backend_unavailable';throw new PediuBackendApiError(code,response.status||502)}
  return parsed.data;
}

export async function invokePediuBackendAction<T>(payload:Record<string,unknown>,options:BackendActionOptions={}):Promise<T>{return invokeEdgeEnvelope<T>(BACKEND_EDGE_URL,payload,options)}
export async function invokeComandivaStoreSignup<T>(input:Record<string,unknown>):Promise<T>{return invokeEdgeEnvelope<T>(STORE_SIGNUP_EDGE_URL,input)}

type SupabaseLikeError={message:string};type SignedEntry={path:string;signedUrl:string|null};type RestrictedServerClient=SupabaseClient<Database>;
async function edgeRpc(rpc:string,args?:Record<string,unknown>){if(!EDGE_RPC_ALLOWLIST.has(rpc))return{data:null,error:{message:`RPC ${rpc} is not available through the restricted Edge facade.`} satisfies SupabaseLikeError};try{const data=await invokePediuBackendAction<unknown>({action:'rpc',rpc,args:args??{}});return{data,error:null}}catch(error){const message=error instanceof PediuBackendApiError?error.code:'backend_unavailable';return{data:null,error:{message} satisfies SupabaseLikeError}}}
async function edgeSignPaths(bucket:string,paths:string[],ttlSeconds:number){try{const data=await invokePediuBackendAction<SignedEntry[]>({action:'sign_paths',bucket,paths,ttlSeconds});return{data,error:null}}catch(error){const message=error instanceof PediuBackendApiError?error.code:'backend_unavailable';return{data:null,error:{message} satisfies SupabaseLikeError}}}
function proxyGet(target:Record<string,unknown>,prop:PropertyKey,receiver:unknown){if(prop==='then')return undefined;if(Reflect.has(target,prop))return Reflect.get(target,prop,receiver);throw new Error(`Privileged Supabase operation "${String(prop)}" is not exposed by the restricted server facade.`)}
function createRestrictedServerClient():RestrictedServerClient{const storage={from(bucket:string){return{createSignedUrls(paths:string[],ttlSeconds:number){return edgeSignPaths(bucket,paths,ttlSeconds)},async createSignedUrl(path:string,ttlSeconds:number){const{data,error}=await edgeSignPaths(bucket,[path],ttlSeconds);return{data:data?.[0]?{signedUrl:data[0].signedUrl}:null,error}}}}};return new Proxy({rpc:edgeRpc,storage} as Record<string,unknown>,{get(target,prop,receiver){return proxyGet(target,prop,receiver)}}) as unknown as RestrictedServerClient}
let _supabaseAdmin:RestrictedServerClient|undefined;
export const supabaseAdmin=new Proxy({} as RestrictedServerClient,{get(_,prop,receiver){if(prop==='then')return undefined;if(!_supabaseAdmin)_supabaseAdmin=createRestrictedServerClient();return Reflect.get(_supabaseAdmin,prop,receiver)}});
