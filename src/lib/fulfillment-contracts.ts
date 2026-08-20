import { z } from "zod";
import { slugParamSchema } from "@/lib/storefront-contracts";

export const fulfillmentRequestSchema = z.object({ slug: slugParamSchema }).strict();

export const fulfillmentValidateSchema = z.object({
  slug: slugParamSchema,
  fulfillmentType: z.enum(["entrega", "retirada"]),
  deliveryAreaId: z.string().uuid().nullable().optional(),
  configurationVersion: z.string().max(64).nullable().optional(),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
}).strict().superRefine((value,ctx)=>{
  const hasLat=value.latitude!==null&&value.latitude!==undefined;
  const hasLon=value.longitude!==null&&value.longitude!==undefined;
  if(hasLat!==hasLon) ctx.addIssue({code:z.ZodIssueCode.custom,message:"latitude e longitude devem ser enviadas juntas",path:[hasLat?"longitude":"latitude"]});
});

export type FulfillmentRequest = z.infer<typeof fulfillmentRequestSchema>;
export type FulfillmentValidateRequest = z.infer<typeof fulfillmentValidateSchema>;
