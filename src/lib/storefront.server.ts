/**
 * Camada pública de leitura do cardápio.
 * O browser nunca consulta tabelas diretamente e nenhum preço enviado pelo cliente é confiado.
 */
import { z } from "zod";

const SIGNED_URL_TTL_SECONDS = 60 * 30;

export const slugSchema = z.string().trim().min(1).max(63).regex(/^[a-z0-9][a-z0-9-]*$/, "slug inválido");

export const selectionSchema = z.object({
  option_group_id: z.string().uuid(),
  option_item_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(50).default(1),
});

export const priceInputSchema = z.object({
  slug: slugSchema,
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().nullable().optional(),
  quantity: z.number().min(0.001).max(1000).default(1),
  selections: z.array(selectionSchema).max(60).default([]),
});

export type PriceInput = z.infer<typeof priceInputSchema>;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export class StorefrontError extends Error {
  constructor(public readonly code: "not_found" | "invalid_request" | "unavailable", message?: string) {
    super(message ?? code);
  }
}

async function signMany(bucket: string, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => Boolean(p))));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const db = await admin();
  const { data, error } = await db.storage.from(bucket).createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return map;
  for (const entry of data) if (entry.signedUrl && entry.path) map.set(entry.path, entry.signedUrl);
  return map;
}

export type PublicStore = {
  id: string; slug: string; name: string; segment: string | null; city: string; state: string; timezone: string;
  phone: string | null; whatsapp: string | null; address_line: string | null; accepts_delivery: boolean; accepts_pickup: boolean;
};
export type PublicStoreSettings = {
  brand_primary: string; brand_accent: string; description: string | null; welcome_message: string | null; closed_message: string | null;
  min_order_amount: number; default_prep_minutes: number; logo_url: string | null; cover_url: string | null;
};
export type PublicStoreHour = { weekday: number; opens_at: string; closes_at: string };
export type PublicStorePayload = { store: PublicStore; settings: PublicStoreSettings; hours: PublicStoreHour[]; is_open: boolean };

export async function loadPublicStore(rawSlug: string): Promise<PublicStorePayload> {
  const slug = slugSchema.parse(rawSlug); const db = await admin();
  const { data, error } = await db.rpc("storefront_store", { _slug: slug });
  if (error) { console.error("[storefront] store rpc failed", error.message); throw new StorefrontError("unavailable"); }
  if (!data) throw new StorefrontError("not_found");
  const payload = data as Record<string, any>; const settings = (payload.settings ?? {}) as Record<string, any>;
  const signed = await signMany("store-branding", [settings.logo_path, settings.cover_path]);
  return { store: payload.store as PublicStore, settings: {
    brand_primary: settings.brand_primary ?? "#0f766e", brand_accent: settings.brand_accent ?? "#14b8a6",
    description: settings.description ?? null, welcome_message: settings.welcome_message ?? null, closed_message: settings.closed_message ?? null,
    min_order_amount: Number(settings.min_order_amount ?? 0), default_prep_minutes: Number(settings.default_prep_minutes ?? 30),
    logo_url: settings.logo_path ? (signed.get(settings.logo_path) ?? null) : null, cover_url: settings.cover_path ? (signed.get(settings.cover_path) ?? null) : null,
  }, hours: (payload.hours ?? []) as PublicStoreHour[], is_open: Boolean(payload.is_open) };
}

export type PublicCategory = { id: string; name: string; description: string | null; sort_order: number; image_url: string | null };
export type PublicProductCard = {
  id: string; category_id: string; name: string; description: string | null; base_price: number; from_price: number | null;
  sale_mode: string; measurement_unit: string; pricing_unit: string; unit_label: string | null; has_variants: boolean; has_options: boolean;
  product_type: string; capabilities: Record<string, unknown>; engine_version: number; stock_quantity: number | null;
  is_sold_out: boolean; is_featured: boolean; minimum_quantity: number; quantity_step: number; max_quantity: number | null; allows_notes: boolean; image_url: string | null;
};
export type PublicPopularity = { product_id: string; units: number; order_count: number };
export type PublicCatalog = { categories: PublicCategory[]; products: PublicProductCard[]; popularity: PublicPopularity[] };

function mapProductCard(p: Record<string, any>, signed: Map<string, string>): PublicProductCard {
  return {
    id:p.id,category_id:p.category_id,name:p.name,description:p.description??null,base_price:Number(p.base_price??0),from_price:p.from_price==null?null:Number(p.from_price),
    sale_mode:p.sale_mode,measurement_unit:p.measurement_unit,pricing_unit:p.pricing_unit,unit_label:p.unit_label??null,has_variants:Boolean(p.has_variants),has_options:Boolean(p.has_options),
    product_type:String(p.product_type??"simple"),capabilities:(p.capabilities??{}) as Record<string,unknown>,engine_version:Number(p.engine_version??1),stock_quantity:p.stock_quantity==null?null:Number(p.stock_quantity),
    is_sold_out:Boolean(p.is_sold_out),is_featured:Boolean(p.is_featured),minimum_quantity:Number(p.minimum_quantity??1),quantity_step:Number(p.quantity_step??1),max_quantity:p.max_quantity==null?null:Number(p.max_quantity),allows_notes:Boolean(p.allows_notes),image_url:p.image_path?(signed.get(p.image_path)??null):null,
  };
}

export async function loadPublicCatalog(rawSlug: string): Promise<PublicCatalog> {
  const slug = slugSchema.parse(rawSlug); const db = await admin();
  const [{ data, error }, popularityResponse] = await Promise.all([
    db.rpc("storefront_catalog", { _slug: slug }),
    (db.rpc as any)("storefront_popular_products", { _slug: slug, _days: 60, _limit: 8 }),
  ]);
  if (error) { console.error("[storefront] catalog rpc failed", error.message); throw new StorefrontError("unavailable"); }
  if (!data) throw new StorefrontError("not_found");
  const payload = data as Record<string, any>; const categories = (payload.categories ?? []) as Record<string, any>[]; const products = (payload.products ?? []) as Record<string, any>[];
  const signed = await signMany("store-catalog", [...categories.map((c) => c.image_path), ...products.map((p) => p.image_path)]);
  const rawPopularity = popularityResponse?.error ? [] : (popularityResponse?.data ?? []);
  if (popularityResponse?.error) console.warn("[storefront] popularity unavailable; continuing without ranking", popularityResponse.error.message);
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name, description: c.description ?? null, sort_order: Number(c.sort_order ?? 0), image_url: c.image_path ? (signed.get(c.image_path) ?? null) : null })),
    products: products.map((p) => mapProductCard(p, signed)),
    popularity: Array.isArray(rawPopularity)
      ? rawPopularity
          .map((entry: any) => ({ product_id:String(entry?.product_id??""), units:Number(entry?.units??0), order_count:Number(entry?.order_count??0) }))
          .filter((entry: PublicPopularity) => entry.product_id && entry.units > 0 && entry.order_count > 0)
      : [],
  };
}

export type PublicOptionItem = {
  id:string; name:string; description:string|null; additional_price:number; max_quantity:number;
  linked_product_id:string|null; linked_variant_id:string|null; metadata:Record<string,unknown>;
};
export type PublicOptionGroup = {
  id:string; name:string; description:string|null; role:string; selection_type:"unica"|"multipla"|"quantidade"; is_required:boolean;
  min_selections:number; max_selections:number; included_selections:number; allow_quantity:boolean; pricing_strategy:string; price_effect:string; portion_count:number|null;
  configuration:Record<string,unknown>; items:PublicOptionItem[];
};
export type PublicVariant = { id:string; name:string; price:number; is_default:boolean; package_quantity:number|null; package_unit:string|null };
export type PublicRecommendation = { product: PublicProductCard; together_orders: number };
export type PublicProductDetail = {
  product: Omit<PublicProductCard,"has_options"|"is_featured"|"from_price"> & { image_url:string|null; pricing_rules:Record<string,unknown> };
  variants:PublicVariant[]; option_groups:PublicOptionGroup[]; recommendations:PublicRecommendation[];
};

export async function loadPublicProduct(rawSlug:string,productId:string):Promise<PublicProductDetail>{
  const slug=slugSchema.parse(rawSlug); const id=z.string().uuid().parse(productId); const db=await admin();
  const [productResponse, recommendationResponse, catalogResponse] = await Promise.all([
    db.rpc("storefront_product",{_slug:slug,_product_id:id}),
    (db.rpc as any)("storefront_product_recommendations",{_slug:slug,_product_id:id,_days:90,_limit:4}),
    db.rpc("storefront_catalog",{_slug:slug}),
  ]);
  const {data,error}=productResponse;
  if(error){console.error("[storefront] product rpc failed",error.message);throw new StorefrontError("unavailable");} if(!data)throw new StorefrontError("not_found");
  const payload=data as Record<string,any>; const product=payload.product as Record<string,any>;

  const rawRecommendations = recommendationResponse?.error ? [] : (recommendationResponse?.data ?? []);
  if (recommendationResponse?.error) console.warn("[storefront] recommendations unavailable; continuing without them", recommendationResponse.error.message);
  const recommendationStats = Array.isArray(rawRecommendations) ? rawRecommendations as Record<string,any>[] : [];
  const recommendedIds = new Set(recommendationStats.map((entry) => String(entry.product_id)));
  const catalogPayload = catalogResponse.data as Record<string,any> | null;
  const catalogProducts = ((catalogPayload?.products ?? []) as Record<string,any>[]).filter((entry) => recommendedIds.has(String(entry.id)));
  const signed=await signMany("store-catalog",[product.image_path,...catalogProducts.map((entry)=>entry.image_path)]);
  const cardById = new Map(catalogProducts.map((entry) => [String(entry.id), mapProductCard(entry,signed)]));
  const recommendations:PublicRecommendation[] = recommendationStats
    .map((entry) => {
      const card = cardById.get(String(entry.product_id));
      return card ? { product:card, together_orders:Number(entry.together_orders??0) } : null;
    })
    .filter((entry): entry is PublicRecommendation => Boolean(entry));

  return {product:{
    id:product.id,category_id:product.category_id,name:product.name,description:product.description??null,base_price:Number(product.base_price??0),sale_mode:product.sale_mode,measurement_unit:product.measurement_unit,pricing_unit:product.pricing_unit,unit_label:product.unit_label??null,has_variants:Boolean(product.has_variants),
    product_type:String(product.product_type??"simple"),capabilities:(product.capabilities??{}) as Record<string,unknown>,engine_version:Number(product.engine_version??1),pricing_rules:(product.pricing_rules??{}) as Record<string,unknown>,stock_quantity:product.stock_quantity==null?null:Number(product.stock_quantity),
    is_sold_out:Boolean(product.is_sold_out),minimum_quantity:Number(product.minimum_quantity??1),quantity_step:Number(product.quantity_step??1),max_quantity:product.max_quantity==null?null:Number(product.max_quantity),allows_notes:Boolean(product.allows_notes),image_url:product.image_path?(signed.get(product.image_path)??null):null,
  },variants:((payload.variants??[]) as Record<string,any>[]).map((v)=>({id:v.id,name:v.name,price:Number(v.price??0),is_default:Boolean(v.is_default),package_quantity:v.package_quantity==null?null:Number(v.package_quantity),package_unit:v.package_unit??null})),
  option_groups:((payload.option_groups??[]) as Record<string,any>[]).map((g)=>({id:g.id,name:g.name,description:g.description??null,role:String(g.role??"generic"),selection_type:g.selection_type,is_required:Boolean(g.is_required),min_selections:Number(g.min_selections??0),max_selections:Number(g.max_selections??1),included_selections:Number(g.included_selections??0),allow_quantity:Boolean(g.allow_quantity),pricing_strategy:g.pricing_strategy,price_effect:g.price_effect,portion_count:g.portion_count==null?null:Number(g.portion_count),configuration:(g.configuration??{}) as Record<string,unknown>,items:((g.items??[]) as Record<string,any>[]).map((i)=>({id:i.id,name:i.name,description:i.description??null,additional_price:Number(i.additional_price??0),max_quantity:Number(i.max_quantity??1),linked_product_id:i.linked_product_id??null,linked_variant_id:i.linked_variant_id??null,metadata:(i.metadata??{}) as Record<string,unknown>}))})),recommendations};
}

export type PublicPriceResult={ok:boolean;error?:string;total?:number;unit_price?:number;base_total?:number;options_total?:number;validation_errors?:string[]};
export async function computePublicPrice(input:PriceInput):Promise<PublicPriceResult>{
  const parsed=priceInputSchema.parse(input); const db=await admin();
  const {data,error}=await db.rpc("storefront_price",{_slug:parsed.slug,_product_id:parsed.product_id,_variant_id:parsed.variant_id??undefined,_quantity:parsed.quantity,_selections:parsed.selections});
  if(error){console.error("[storefront] price rpc failed",error.message);return{ok:false,error:"unavailable"};}
  const payload=(data??{}) as Record<string,any>; if(!payload.ok)return{ok:false,error:String(payload.error??"invalid_request")};
  const result=(payload.result??{}) as Record<string,any>; const validation=Array.isArray(result.validation_errors)?result.validation_errors.map((code:unknown)=>String(code)):[];
  if(validation.length>0||result.final_total==null)return{ok:false,error:"invalid_configuration",validation_errors:validation};
  return{ok:true,total:Number(result.final_total??0),unit_price:Number(result.final_unit_price??result.base_price??0),base_total:Number(result.base_total??0),options_total:Number(result.additive_groups_total??0),validation_errors:[]};
}
