import { fetchStorefrontFulfillment, validateStorefrontFulfillment } from "@/lib/fulfillment.functions";
import type { FulfillmentType, FulfillmentValidation, PublicFulfillmentConfiguration } from "./customer-wizard.types";

const TIMEOUT_MS=10_000;
function withTimeout<T>(promise:Promise<T>):Promise<T>{return new Promise<T>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("timeout")),TIMEOUT_MS);promise.then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e instanceof Error?e:new Error("request_failed"));});});}

export function getFulfillmentConfiguration(slug:string):Promise<PublicFulfillmentConfiguration>{return withTimeout(fetchStorefrontFulfillment({data:{slug}}));}
export function postFulfillmentValidation(input:{slug:string;fulfillmentType:FulfillmentType;deliveryAreaId?:string|null;configurationVersion?:string|null;latitude?:number|null;longitude?:number|null;}):Promise<FulfillmentValidation>{return withTimeout(validateStorefrontFulfillment({data:input}));}
