/**
 * Fase 11 — Camada pública de leitura do cardápio.
 *
 * Este módulo é SERVIDOR-ONLY (sufixo `.server.ts`). Ele é o único ponto do
 * app que fala com o banco em nome de um visitante anônimo.
 *
 * Regras de segurança aplicadas aqui:
 * - o visitante nunca toca nas tabelas: tudo passa por RPCs `storefront_*`
 *   com projeção explícita de colunas e concedidas apenas ao servidor;
 * - o `store_id` é sempre resolvido pelo slug no servidor;
 * - caminhos de imagem nunca vazam: só URLs assinadas de curta duração;
 * - erros são normalizados; detalhes ficam no log do servidor.
 */
import { z } from "zod";

const SIGNED_URL_TTL_SECONDS = 60 * 30;

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "slug inválido");

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

/** Erro público: mensagem genérica, sem detalhe de schema. */
export class StorefrontError extends Error {
  constructor(
    public readonly code: "not_found" | "invalid_request" | "unavailable",
    message?: string,
  ) {
    super(message ?? code);
  }
}

async function signMany(
  bucket: string,
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => Boolean(p))));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const db = await admin();
  const { data, error } = await db.storage
    .from(bucket)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);

  if (error || !data) return map;
  for (const entry of data) {
    if (entry.signedUrl && entry.path) map.set(entry.path, entry.signedUrl);
  }
  return map;
}

export type PublicStore = {
  id: string;
  slug: string;
  name: string;
  segment: string | null;
  city: string;
  state: string;
  timezone: string;
  phone: string | null;
  whatsapp: string | null;
  address_line: string | null;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
};

export type PublicStoreSettings = {
  brand_primary: string;
  brand_accent: string;
  description: string | null;
  welcome_message: string | null;
  closed_message: string | null;
  min_order_amount: number;
  default_prep_minutes: number;
  logo_url: string | null;
  cover_url: string | null;
};

export type PublicStoreHour = { weekday: number; opens_at: string; closes_at: string };

export type PublicStorePayload = {
  store: PublicStore;
  settings: PublicStoreSettings;
  hours: PublicStoreHour[];
  is_open: boolean;
};

export async function loadPublicStore(rawSlug: string): Promise<PublicStorePayload> {
  const slug = slugSchema.parse(rawSlug);
  const db = await admin();
  const { data, error } = await db.rpc("storefront_store", { _slug: slug });

  if (error) {
    console.error("[storefront] store rpc failed", error.message);
    throw new StorefrontError("unavailable");
  }
  if (!data) throw new StorefrontError("not_found");

  const payload = data as Record<string, any>;
  const settings = (payload.settings ?? {}) as Record<string, any>;
  const signed = await signMany("store-branding", [settings.logo_path, settings.cover_path]);

  return {
    store: payload.store as PublicStore,
    settings: {
      brand_primary: settings.brand_primary ?? "#0f766e",
      brand_accent: settings.brand_accent ?? "#14b8a6",
      description: settings.description ?? null,
      welcome_message: settings.welcome_message ?? null,
      closed_message: settings.closed_message ?? null,
      min_order_amount: Number(settings.min_order_amount ?? 0),
      default_prep_minutes: Number(settings.default_prep_minutes ?? 30),
      logo_url: settings.logo_path ? (signed.get(settings.logo_path) ?? null) : null,
      cover_url: settings.cover_path ? (signed.get(settings.cover_path) ?? null) : null,
    },
    hours: (payload.hours ?? []) as PublicStoreHour[],
    is_open: Boolean(payload.is_open),
  };
}

export type PublicCategory = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  image_url: string | null;
};

export type PublicProductCard = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  base_price: number;
  from_price: number | null;
  sale_mode: string;
  measurement_unit: string;
  pricing_unit: string;
  unit_label: string | null;
  has_variants: boolean;
  has_options: boolean;
  is_sold_out: boolean;
  is_featured: boolean;
  /** Top de vendas reais da loja nos últimos 30 dias; não expõe contagem. */
  is_best_seller: boolean;
  minimum_quantity: number;
  quantity_step: number;
  max_quantity: number | null;
  allows_notes: boolean;
  image_url: string | null;
};

export type PublicCatalog = {
  categories: PublicCategory[];
  products: PublicProductCard[];
};

export async function loadPublicCatalog(rawSlug: string): Promise<PublicCatalog> {
  const slug = slugSchema.parse(rawSlug);
  const db = await admin();
  const { data, error } = await db.rpc("storefront_catalog", { _slug: slug });

  if (error) {
    console.error("[storefront] catalog rpc failed", error.message);
    throw new StorefrontError("unavailable");
  }
  if (!data) throw new StorefrontError("not_found");

  const payload = data as Record<string, any>;
  const categories = (payload.categories ?? []) as Record<string, any>[];
  const products = (payload.products ?? []) as Record<string, any>[];

  const signed = await signMany("store-catalog", [
    ...categories.map((c) => c.image_path),
    ...products.map((p) => p.image_path),
  ]);

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description ?? null,
      sort_order: Number(c.sort_order ?? 0),
      image_url: c.image_path ? (signed.get(c.image_path) ?? null) : null,
    })),
    products: products.map((p) => ({
      id: p.id,
      category_id: p.category_id,
      name: p.name,
      description: p.description ?? null,
      base_price: Number(p.base_price ?? 0),
      from_price: p.from_price === null || p.from_price === undefined ? null : Number(p.from_price),
      sale_mode: p.sale_mode,
      measurement_unit: p.measurement_unit,
      pricing_unit: p.pricing_unit,
      unit_label: p.unit_label ?? null,
      has_variants: Boolean(p.has_variants),
      has_options: Boolean(p.has_options),
      is_sold_out: Boolean(p.is_sold_out),
      is_featured: Boolean(p.is_featured),
      is_best_seller: Boolean(p.is_best_seller),
      minimum_quantity: Number(p.minimum_quantity ?? 1),
      quantity_step: Number(p.quantity_step ?? 1),
      max_quantity: p.max_quantity === null || p.max_quantity === undefined ? null : Number(p.max_quantity),
      allows_notes: Boolean(p.allows_notes),
      image_url: p.image_path ? (signed.get(p.image_path) ?? null) : null,
    })),
  };
}

export type PublicOptionItem = {
  id: string;
  name: string;
  description: string | null;
  additional_price: number;
  max_quantity: number;
};

export type PublicOptionGroup = {
  id: string;
  name: string;
  description: string | null;
  selection_type: "unica" | "multipla" | "quantidade";
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  allow_quantity: boolean;
  pricing_strategy: string;
  price_effect: string;
  portion_count: number | null;
  items: PublicOptionItem[];
};

export type PublicVariant = {
  id: string;
  name: string;
  price: number;
  is_default: boolean;
  package_quantity: number | null;
  package_unit: string | null;
};

export type PublicProductDetail = {
  product: Omit<PublicProductCard, "has_options" | "is_featured" | "is_best_seller" | "from_price"> & {
    image_url: string | null;
  };
  variants: PublicVariant[];
  option_groups: PublicOptionGroup[];
};

export async function loadPublicProduct(
  rawSlug: string,
  productId: string,
): Promise<PublicProductDetail> {
  const slug = slugSchema.parse(rawSlug);
  const id = z.string().uuid().parse(productId);
  const db = await admin();
  const { data, error } = await db.rpc("storefront_product", { _slug: slug, _product_id: id });

  if (error) {
    console.error("[storefront] product rpc failed", error.message);
    throw new StorefrontError("unavailable");
  }
  if (!data) throw new StorefrontError("not_found");

  const payload = data as Record<string, any>;
  const product = payload.product as Record<string, any>;
  const signed = await signMany("store-catalog", [product.image_path]);

  return {
    product: {
      id: product.id,
      category_id: product.category_id,
      name: product.name,
      description: product.description ?? null,
      base_price: Number(product.base_price ?? 0),
      sale_mode: product.sale_mode,
      measurement_unit: product.measurement_unit,
      pricing_unit: product.pricing_unit,
      unit_label: product.unit_label ?? null,
      has_variants: Boolean(product.has_variants),
      is_sold_out: Boolean(product.is_sold_out),
      minimum_quantity: Number(product.minimum_quantity ?? 1),
      quantity_step: Number(product.quantity_step ?? 1),
      max_quantity:
        product.max_quantity === null || product.max_quantity === undefined
          ? null
          : Number(product.max_quantity),
      allows_notes: Boolean(product.allows_notes),
      image_url: product.image_path ? (signed.get(product.image_path) ?? null) : null,
    },
    variants: ((payload.variants ?? []) as Record<string, any>[]).map((v) => ({
      id: v.id,
      name: v.name,
      price: Number(v.price ?? 0),
      is_default: Boolean(v.is_default),
      package_quantity:
        v.package_quantity === null || v.package_quantity === undefined
          ? null
          : Number(v.package_quantity),
      package_unit: v.package_unit ?? null,
    })),
    option_groups: ((payload.option_groups ?? []) as Record<string, any>[]).map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description ?? null,
      selection_type: g.selection_type,
      is_required: Boolean(g.is_required),
      min_selections: Number(g.min_selections ?? 0),
      max_selections: Number(g.max_selections ?? 1),
      allow_quantity: Boolean(g.allow_quantity),
      pricing_strategy: g.pricing_strategy,
      price_effect: g.price_effect,
      portion_count:
        g.portion_count === null || g.portion_count === undefined ? null : Number(g.portion_count),
      items: ((g.items ?? []) as Record<string, any>[]).map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description ?? null,
        additional_price: Number(i.additional_price ?? 0),
        max_quantity: Number(i.max_quantity ?? 1),
      })),
    })),
  };
}

export type PublicPriceResult = {
  ok: boolean;
  /** Código genérico; detalhes ficam no log do servidor. */
  error?: string;
  total?: number;
  unit_price?: number;
  base_total?: number;
  options_total?: number;
  /** Códigos de validação do motor (ex.: SELECTION_BELOW_MINIMUM). */
  validation_errors?: string[];
};

export async function computePublicPrice(input: PriceInput): Promise<PublicPriceResult> {
  const parsed = priceInputSchema.parse(input);
  const db = await admin();

  const { data, error } = await db.rpc("storefront_price", {
    _slug: parsed.slug,
    _product_id: parsed.product_id,
    _variant_id: parsed.variant_id ?? undefined,
    _quantity: parsed.quantity,
    _selections: parsed.selections,
  });

  if (error) {
    console.error("[storefront] price rpc failed", error.message);
    return { ok: false, error: "unavailable" };
  }

  const payload = (data ?? {}) as Record<string, any>;
  if (!payload.ok) return { ok: false, error: String(payload.error ?? "invalid_request") };

  const result = (payload.result ?? {}) as Record<string, any>;
  const validation = Array.isArray(result.validation_errors)
    ? result.validation_errors.map((code: unknown) => String(code))
    : [];

  if (validation.length > 0 || result.final_total === null || result.final_total === undefined) {
    return { ok: false, error: "invalid_configuration", validation_errors: validation };
  }

  return {
    ok: true,
    total: Number(result.final_total ?? 0),
    unit_price: Number(result.final_unit_price ?? result.base_price ?? 0),
    base_total: Number(result.base_total ?? 0),
    options_total: Number(result.additive_groups_total ?? 0),
    validation_errors: [],
  };
}
