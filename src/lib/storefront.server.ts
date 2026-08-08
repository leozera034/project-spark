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

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function asRecordArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asImagePath(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asSelectionType(value: unknown): PublicOptionGroup["selection_type"] {
  return value === "unica" || value === "multipla" || value === "quantidade" ? value : "unica";
}

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

  const payload = asRecord(data);
  const store = asRecord(payload.store);
  const settings = asRecord(payload.settings);
  const logoPath = asImagePath(settings.logo_path);
  const coverPath = asImagePath(settings.cover_path);
  const signed = await signMany("store-branding", [logoPath, coverPath]);

  return {
    store: {
      id: asString(store.id),
      slug: asString(store.slug),
      name: asString(store.name),
      segment: asNullableString(store.segment),
      city: asString(store.city),
      state: asString(store.state),
      timezone: asString(store.timezone, "America/Sao_Paulo"),
      phone: asNullableString(store.phone),
      whatsapp: asNullableString(store.whatsapp),
      address_line: asNullableString(store.address_line),
      accepts_delivery: Boolean(store.accepts_delivery),
      accepts_pickup: Boolean(store.accepts_pickup),
    },
    settings: {
      brand_primary: asString(settings.brand_primary, "#0f766e"),
      brand_accent: asString(settings.brand_accent, "#14b8a6"),
      description: asNullableString(settings.description),
      welcome_message: asNullableString(settings.welcome_message),
      closed_message: asNullableString(settings.closed_message),
      min_order_amount: Number(settings.min_order_amount ?? 0),
      default_prep_minutes: Number(settings.default_prep_minutes ?? 30),
      logo_url: logoPath ? (signed.get(logoPath) ?? null) : null,
      cover_url: coverPath ? (signed.get(coverPath) ?? null) : null,
    },
    hours: asRecordArray(payload.hours).map((hour) => ({
      weekday: Number(hour.weekday ?? 0),
      opens_at: asString(hour.opens_at),
      closes_at: asString(hour.closes_at),
    })),
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

  const payload = asRecord(data);
  const categories = asRecordArray(payload.categories);
  const products = asRecordArray(payload.products);
  const categoryPaths = categories.map((category) => asImagePath(category.image_path));
  const productPaths = products.map((product) => asImagePath(product.image_path));
  const signed = await signMany("store-catalog", [...categoryPaths, ...productPaths]);

  return {
    categories: categories.map((category) => {
      const imagePath = asImagePath(category.image_path);
      return {
        id: asString(category.id),
        name: asString(category.name),
        description: asNullableString(category.description),
        sort_order: Number(category.sort_order ?? 0),
        image_url: imagePath ? (signed.get(imagePath) ?? null) : null,
      };
    }),
    products: products.map((product) => {
      const imagePath = asImagePath(product.image_path);
      return {
        id: asString(product.id),
        category_id: asString(product.category_id),
        name: asString(product.name),
        description: asNullableString(product.description),
        base_price: Number(product.base_price ?? 0),
        from_price:
          product.from_price === null || product.from_price === undefined
            ? null
            : Number(product.from_price),
        sale_mode: asString(product.sale_mode),
        measurement_unit: asString(product.measurement_unit),
        pricing_unit: asString(product.pricing_unit),
        unit_label: asNullableString(product.unit_label),
        has_variants: Boolean(product.has_variants),
        has_options: Boolean(product.has_options),
        is_sold_out: Boolean(product.is_sold_out),
        is_featured: Boolean(product.is_featured),
        minimum_quantity: Number(product.minimum_quantity ?? 1),
        quantity_step: Number(product.quantity_step ?? 1),
        max_quantity:
          product.max_quantity === null || product.max_quantity === undefined
            ? null
            : Number(product.max_quantity),
        allows_notes: Boolean(product.allows_notes),
        image_url: imagePath ? (signed.get(imagePath) ?? null) : null,
      };
    }),
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
  product: Omit<PublicProductCard, "has_options" | "is_featured" | "from_price"> & {
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

  const payload = asRecord(data);
  const product = asRecord(payload.product);
  const imagePath = asImagePath(product.image_path);
  const signed = await signMany("store-catalog", [imagePath]);

  return {
    product: {
      id: asString(product.id),
      category_id: asString(product.category_id),
      name: asString(product.name),
      description: asNullableString(product.description),
      base_price: Number(product.base_price ?? 0),
      sale_mode: asString(product.sale_mode),
      measurement_unit: asString(product.measurement_unit),
      pricing_unit: asString(product.pricing_unit),
      unit_label: asNullableString(product.unit_label),
      has_variants: Boolean(product.has_variants),
      is_sold_out: Boolean(product.is_sold_out),
      minimum_quantity: Number(product.minimum_quantity ?? 1),
      quantity_step: Number(product.quantity_step ?? 1),
      max_quantity:
        product.max_quantity === null || product.max_quantity === undefined
          ? null
          : Number(product.max_quantity),
      allows_notes: Boolean(product.allows_notes),
      image_url: imagePath ? (signed.get(imagePath) ?? null) : null,
    },
    variants: asRecordArray(payload.variants).map((variant) => ({
      id: asString(variant.id),
      name: asString(variant.name),
      price: Number(variant.price ?? 0),
      is_default: Boolean(variant.is_default),
      package_quantity:
        variant.package_quantity === null || variant.package_quantity === undefined
          ? null
          : Number(variant.package_quantity),
      package_unit: asNullableString(variant.package_unit),
    })),
    option_groups: asRecordArray(payload.option_groups).map((group) => ({
      id: asString(group.id),
      name: asString(group.name),
      description: asNullableString(group.description),
      selection_type: asSelectionType(group.selection_type),
      is_required: Boolean(group.is_required),
      min_selections: Number(group.min_selections ?? 0),
      max_selections: Number(group.max_selections ?? 1),
      allow_quantity: Boolean(group.allow_quantity),
      pricing_strategy: asString(group.pricing_strategy),
      price_effect: asString(group.price_effect),
      portion_count:
        group.portion_count === null || group.portion_count === undefined
          ? null
          : Number(group.portion_count),
      items: asRecordArray(group.items).map((item) => ({
        id: asString(item.id),
        name: asString(item.name),
        description: asNullableString(item.description),
        additional_price: Number(item.additional_price ?? 0),
        max_quantity: Number(item.max_quantity ?? 1),
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

  const payload = asRecord(data);
  if (!payload.ok) return { ok: false, error: String(payload.error ?? "invalid_request") };

  const result = asRecord(payload.result);
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
