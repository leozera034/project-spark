import { supabase } from "@/integrations/supabase/client";
import type {
  PublicCatalog,
  PublicStoreHour,
  PublicStorePayload,
} from "@/lib/storefront.server";

const SIGNED_URL_TTL_SECONDS = 30 * 60;

export class PublicStorefrontClientError extends Error {
  constructor(public readonly code: "not_found" | "unavailable") {
    super(code);
    this.name = "PublicStorefrontClientError";
  }
}

type EdgeEnvelope<T> = { ok: true; data: T } | { ok: false; error?: string };
type SignedEntry = { path: string; signedUrl: string | null };

function normalizeSlug(value: string) {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) {
    throw new PublicStorefrontClientError("not_found");
  }
  return slug;
}

async function invokeEdge<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("pediu-backend-api", { body: payload });
  if (error) throw new PublicStorefrontClientError("unavailable");
  const envelope = (data ?? {}) as EdgeEnvelope<T>;
  if (!envelope || envelope.ok !== true) throw new PublicStorefrontClientError("unavailable");
  return envelope.data;
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  return invokeEdge<T>({ action: "rpc", rpc: name, args });
}

async function signMany(bucket: "store-branding" | "store-catalog", paths: unknown[]) {
  const unique = Array.from(new Set(paths.filter((value): value is string => typeof value === "string" && value.length > 0)));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  try {
    const signed = await invokeEdge<SignedEntry[]>({
      action: "sign_paths",
      bucket,
      paths: unique,
      ttlSeconds: SIGNED_URL_TTL_SECONDS,
    });
    for (const entry of signed) {
      if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
    }
  } catch {
    // Images are optional. The storefront still works with its visual fallbacks.
  }
  return map;
}

export async function loadPublicStoreFromBrowser(rawSlug: string): Promise<PublicStorePayload> {
  const slug = normalizeSlug(rawSlug);
  const payload = await rpc<Record<string, unknown> | null>("storefront_store", { _slug: slug });
  if (!payload) throw new PublicStorefrontClientError("not_found");

  const store = payload.store as PublicStorePayload["store"];
  const settings = (payload.settings ?? {}) as Record<string, unknown>;
  const signed = await signMany("store-branding", [settings.logo_path, settings.cover_path]);

  return {
    store,
    settings: {
      brand_primary: typeof settings.brand_primary === "string" ? settings.brand_primary : "#0f766e",
      brand_accent: typeof settings.brand_accent === "string" ? settings.brand_accent : "#14b8a6",
      description: typeof settings.description === "string" ? settings.description : null,
      welcome_message: typeof settings.welcome_message === "string" ? settings.welcome_message : null,
      closed_message: typeof settings.closed_message === "string" ? settings.closed_message : null,
      min_order_amount: Number(settings.min_order_amount ?? 0),
      default_prep_minutes: Number(settings.default_prep_minutes ?? 30),
      logo_url: typeof settings.logo_path === "string" ? (signed.get(settings.logo_path) ?? null) : null,
      cover_url: typeof settings.cover_path === "string" ? (signed.get(settings.cover_path) ?? null) : null,
    },
    hours: Array.isArray(payload.hours) ? (payload.hours as PublicStoreHour[]) : [],
    is_open: Boolean(payload.is_open),
  };
}

export async function loadPublicCatalogFromBrowser(rawSlug: string): Promise<PublicCatalog> {
  const slug = normalizeSlug(rawSlug);
  const payload = await rpc<Record<string, unknown> | null>("storefront_catalog", { _slug: slug });
  if (!payload) throw new PublicStorefrontClientError("not_found");

  const categories = Array.isArray(payload.categories) ? payload.categories as Record<string, unknown>[] : [];
  const products = Array.isArray(payload.products) ? payload.products as Record<string, unknown>[] : [];
  const signed = await signMany("store-catalog", [
    ...categories.map((category) => category.image_path),
    ...products.map((product) => product.image_path),
  ]);

  return {
    categories: categories.map((category) => ({
      id: String(category.id),
      name: String(category.name ?? ""),
      description: typeof category.description === "string" ? category.description : null,
      sort_order: Number(category.sort_order ?? 0),
      image_url: typeof category.image_path === "string" ? (signed.get(category.image_path) ?? null) : null,
    })),
    products: products.map((product) => ({
      id: String(product.id),
      category_id: String(product.category_id),
      name: String(product.name ?? ""),
      description: typeof product.description === "string" ? product.description : null,
      base_price: Number(product.base_price ?? 0),
      from_price: product.from_price == null ? null : Number(product.from_price),
      sale_mode: String(product.sale_mode ?? "unit"),
      measurement_unit: String(product.measurement_unit ?? "un"),
      pricing_unit: String(product.pricing_unit ?? "unit"),
      unit_label: typeof product.unit_label === "string" ? product.unit_label : null,
      has_variants: Boolean(product.has_variants),
      has_options: Boolean(product.has_options),
      is_sold_out: Boolean(product.is_sold_out),
      is_featured: Boolean(product.is_featured),
      is_best_seller: Boolean(product.is_best_seller),
      minimum_quantity: Number(product.minimum_quantity ?? 1),
      quantity_step: Number(product.quantity_step ?? 1),
      max_quantity: product.max_quantity == null ? null : Number(product.max_quantity),
      allows_notes: Boolean(product.allows_notes),
      image_url: typeof product.image_path === "string" ? (signed.get(product.image_path) ?? null) : null,
    })),
  };
}

export async function loadStorefrontFromBrowser(rawSlug: string) {
  const [store, catalog] = await Promise.all([
    loadPublicStoreFromBrowser(rawSlug),
    loadPublicCatalogFromBrowser(rawSlug),
  ]);
  return { store, catalog };
}
