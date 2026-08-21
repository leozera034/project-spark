import { StorefrontError, slugSchema } from "@/lib/storefront.server";
import type { DeliveryPricingMode, FulfillmentValidation, PublicDeliveryArea, PublicFulfillmentConfiguration, PublicRadiusBand } from "@/storefront/customer/customer-wizard.types";

async function admin(){const{ supabaseAdmin }=await import("@/integrations/supabase/client.server");return supabaseAdmin;}
function num(v:unknown,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function mode(v:unknown):DeliveryPricingMode{return v==="fixed"||v==="radius"?v:"neighborhood";}
function mapArea(raw:Record<string,unknown>):PublicDeliveryArea{return{id:String(raw.id),name:String(raw.name??""),deliveryFee:num(raw.deliveryFee),minimumOrderAmount:num(raw.minimumOrderAmount),estimatedMinutes:raw.estimatedMinutes==null?null:num(raw.estimatedMinutes),publicNotes:raw.publicNotes?String(raw.publicNotes):null};}
function mapBand(raw:Record<string,unknown>):PublicRadiusBand{return{id:String(raw.id),maxDistanceKm:num(raw.maxDistanceKm),deliveryFee:num(raw.deliveryFee),minimumOrderAmount:num(raw.minimumOrderAmount),estimatedMinutes:raw.estimatedMinutes==null?null:num(raw.estimatedMinutes)};}

export async function loadPublicFulfillment(rawSlug:string):Promise<PublicFulfillmentConfiguration>{
  const slug=slugSchema.parse(rawSlug),db=await admin();
  const{data,error}=await db.rpc("storefront_fulfillment",{_slug:slug});
  if(error){console.error("[storefront] fulfillment rpc failed",error.message);throw new StorefrontError("unavailable");}
  if(!data)throw new StorefrontError("not_found");
  const p=data as Record<string,unknown>,fixed=p.fixedQuote as Record<string,unknown>|null;
  return{
    configurationVersion:String(p.configurationVersion??""),deliveryEnabled:Boolean(p.deliveryEnabled),pickupEnabled:Boolean(p.pickupEnabled),storeIsOpen:Boolean(p.storeIsOpen),storeName:String(p.storeName??""),defaultPreparationMinutes:num(p.defaultPreparationMinutes,30),
    deliveryPricingMode:mode(p.deliveryPricingMode),storeLocationReady:Boolean(p.storeLocationReady),
    fixedQuote:fixed?{deliveryFee:num(fixed.deliveryFee),minimumOrderAmount:num(fixed.minimumOrderAmount),estimatedMinutes:fixed.estimatedMinutes==null?null:num(fixed.estimatedMinutes)}:null,
    radiusBands:((p.radiusBands??[]) as Record<string,unknown>[]).map(mapBand),deliveryAreas:((p.deliveryAreas??[]) as Record<string,unknown>[]).map(mapArea),
  };
}

export async function validatePublicFulfillment(input:{slug:string;fulfillmentType:"entrega"|"retirada";deliveryAreaId?:string|null;configurationVersion?:string|null;latitude?:number|null;longitude?:number|null;}):Promise<FulfillmentValidation>{
  const slug=slugSchema.parse(input.slug),db=await admin();
  const rpc = db.rpc as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  const{data,error}=await rpc("storefront_validate_fulfillment_v2",{_slug:slug,_fulfillment_type:input.fulfillmentType,_delivery_area_id:input.deliveryAreaId??undefined,_configuration_version:input.configurationVersion??undefined,_latitude:input.latitude??undefined,_longitude:input.longitude??undefined});
  if(error){console.error("[storefront] fulfillment validate rpc failed",error.message);throw new StorefrontError("unavailable");}
  if(!data)throw new StorefrontError("not_found");
  const p=data as Record<string,unknown>,area=p.deliveryArea?mapArea(p.deliveryArea as Record<string,unknown>):null;
  return{isValid:Boolean(p.isValid),configurationVersion:String(p.configurationVersion??""),fulfillmentType:p.fulfillmentType==="entrega"||p.fulfillmentType==="retirada"?p.fulfillmentType:null,deliveryPricingMode:mode(p.deliveryPricingMode),storeIsOpen:Boolean(p.storeIsOpen),deliveryEnabled:Boolean(p.deliveryEnabled),pickupEnabled:Boolean(p.pickupEnabled),deliveryArea:area,deliveryFee:p.deliveryFee==null?null:num(p.deliveryFee),minimumOrderAmount:p.minimumOrderAmount==null?null:num(p.minimumOrderAmount),estimatedMinutes:p.estimatedMinutes==null?null:num(p.estimatedMinutes),distanceKm:p.distanceKm==null?null:num(p.distanceKm),validationErrors:Array.isArray(p.validationErrors)?p.validationErrors.map(String):[]};
}
