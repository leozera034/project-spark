import { supabase } from "@/integrations/supabase/client";
import type { PublicOrderTracking, TrackingResponse } from "@/lib/tracking-contracts";
import type { CartQuote, CartQuoteLine } from "@/storefront/cart/cart.types";
import type { CheckoutSubmitResult, PublicPaymentMethod } from "@/storefront/checkout/checkout.types";
import type { BrowserCartQuoteBody } from "./public-commerce";

type EdgeEnvelope<T> = { ok: true; data: T } | { ok: false; error?: string };
type SignedEntry = { path: string; signedUrl: string | null };

type CatalogProduct = {
  id: string;
  name?: string | null;
  is_sold_out?: boolean | null;
};

type PricePayload = {
  ok?: boolean;
  error?: string;
  result?: Record<string, unknown>;
};

type FulfillmentPayload = {
  isValid?: boolean;
  configurationVersion?: string | null;
  storeIsOpen?: boolean;
  deliveryFee?: number | null;
  minimumOrderAmount?: number | null;
  estimatedMinutes?: number | null;
  validationErrors?: unknown[];
};

export class PublicCommerceClientError extends Error {
  constructor(public readonly code: "rate_limited" | "unavailable") {
    super(code);
    this.name = "PublicCommerceClientError";
  }
}

function normalizeSlug(value: string) {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) {
    throw new PublicCommerceClientError("unavailable");
  }
  return slug;
}

function round(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function functionStatus(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("context" in error)) return null;
  const context = (error as { context?: unknown }).context;
  return typeof Response !== "undefined" && context instanceof Response ? context.status : null;
}

async function invokeBackend<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("pediu-backend-api", { body: payload });
  if (error) {
    throw new PublicCommerceClientError(functionStatus(error) === 429 ? "rate_limited" : "unavailable");
  }
  const envelope = (data ?? {}) as EdgeEnvelope<T>;
  if (!envelope || envelope.ok !== true) {
    throw new PublicCommerceClientError(
      envelope && envelope.ok === false && envelope.error === "rate_limited"
        ? "rate_limited"
        : "unavailable",
    );
  }
  return envelope.data;
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  return invokeBackend<T>({ action: "rpc", rpc: name, args });
}

function unavailableLine(line: BrowserCartQuoteBody["lines"][number]): CartQuoteLine {
  return {
    lineId: line.lineId,
    productId: line.product_id,
    status: "unavailable",
    productName: null,
    unitPrice: null,
    total: null,
    originalTotal: null,
    discountTotal: 0,
    promotionName: null,
    optionsTotal: null,
    validationErrors: [],
  };
}

async function quoteLine(
  slug: string,
  line: BrowserCartQuoteBody["lines"][number],
  product: CatalogProduct | undefined,
): Promise<CartQuoteLine> {
  if (!product) return unavailableLine(line);
  if (product.is_sold_out) {
    return { ...unavailableLine(line), status: "sold_out", productName: product.name ?? null };
  }

  const price = await rpc<PricePayload>("storefront_price", {
    _slug: slug,
    _product_id: line.product_id,
    _variant_id: line.variant_id ?? undefined,
    _quantity: line.quantity,
    _selections: line.selections,
  }).catch(() => null);

  if (!price?.ok) {
    return {
      ...unavailableLine(line),
      status: price?.error === "invalid_configuration" ? "invalid_configuration" : "unpriceable",
      productName: product.name ?? null,
    };
  }

  const result = price.result ?? {};
  const validationErrors = Array.isArray(result.validation_errors)
    ? result.validation_errors.map(String)
    : [];
  if (validationErrors.length > 0 || result.final_total == null) {
    return {
      ...unavailableLine(line),
      status: "invalid_configuration",
      productName: product.name ?? null,
      validationErrors,
    };
  }

  const total = round(Number(result.final_total ?? 0));
  return {
    lineId: line.lineId,
    productId: line.product_id,
    status: "ok",
    productName: product.name ?? null,
    unitPrice: round(Number(result.final_unit_price ?? result.base_price ?? 0)),
    total,
    originalTotal: total,
    discountTotal: 0,
    promotionName: null,
    optionsTotal: round(Number(result.additive_groups_total ?? 0)),
    validationErrors: [],
  };
}

export async function quotePublicCartFromBrowser(
  rawSlug: string,
  body: BrowserCartQuoteBody,
): Promise<CartQuote> {
  const slug = normalizeSlug(rawSlug);
  const catalog = await rpc<{ products?: CatalogProduct[] }>("storefront_catalog", { _slug: slug });
  const products = new Map((catalog.products ?? []).map((product) => [String(product.id), product] as const));

  const lines = await Promise.all(
    body.lines.map((line) => quoteLine(slug, line, products.get(line.product_id))),
  );

  const fulfillment = body.fulfillmentType
    ? await rpc<FulfillmentPayload>("storefront_validate_fulfillment", {
        _slug: slug,
        _fulfillment_type: body.fulfillmentType,
        _delivery_area_id: body.deliveryAreaId ?? undefined,
        _configuration_version: body.configurationVersion ?? undefined,
      })
    : null;

  const subtotal = round(
    lines.reduce((sum, line) => sum + (line.status === "ok" ? (line.total ?? 0) : 0), 0),
  );
  const deliveryFee =
    body.fulfillmentType === "entrega" && fulfillment?.isValid
      ? round(Number(fulfillment.deliveryFee ?? 0))
      : null;
  const minimumOrderAmount =
    fulfillment?.minimumOrderAmount == null ? null : round(Number(fulfillment.minimumOrderAmount));
  const minimumOrderMet = minimumOrderAmount === null || subtotal >= minimumOrderAmount;

  return {
    currency: "BRL",
    quotedAt: new Date().toISOString(),
    configurationVersion: fulfillment?.configurationVersion ?? body.configurationVersion ?? null,
    fulfillmentType: body.fulfillmentType,
    fulfillmentValid: Boolean(fulfillment?.isValid),
    fulfillmentErrors: Array.isArray(fulfillment?.validationErrors)
      ? fulfillment.validationErrors.map(String)
      : [],
    storeIsOpen: Boolean(fulfillment?.storeIsOpen),
    subtotal,
    discountTotal: 0,
    deliveryFee,
    minimumOrderAmount,
    minimumOrderMet,
    estimatedMinutes:
      fulfillment?.estimatedMinutes == null ? null : Number(fulfillment.estimatedMinutes),
    total: round(subtotal + (deliveryFee ?? 0)),
    hasBlockingIssues: lines.some((line) => line.status !== "ok"),
    lines,
  };
}

export async function loadPaymentMethodsFromBrowser(
  rawSlug: string,
  fulfillmentType: "entrega" | "retirada",
): Promise<PublicPaymentMethod[]> {
  const slug = normalizeSlug(rawSlug);
  const payload = await rpc<{ methods?: PublicPaymentMethod[] }>("storefront_payment_methods", {
    _slug: slug,
    _fulfillment_type: fulfillmentType,
  });
  return Array.isArray(payload.methods) ? payload.methods : [];
}

export async function submitPublicOrderFromBrowser(
  rawSlug: string,
  body: unknown,
): Promise<CheckoutSubmitResult> {
  const slug = normalizeSlug(rawSlug);
  const payload = await rpc<unknown>("storefront_submit_order", {
    _slug: slug,
    _payload: body,
  });
  if (!payload || typeof payload !== "object" || !("ok" in payload)) {
    throw new PublicCommerceClientError("unavailable");
  }
  return payload as CheckoutSubmitResult;
}

async function hashTrackingToken(token: string) {
  const normalized = token.trim();
  if (!/^[0-9a-fA-F]{32,128}$/.test(normalized)) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function signedBrandLogo(path: unknown): Promise<string | null> {
  if (typeof path !== "string" || !path) return null;
  try {
    const signed = await invokeBackend<SignedEntry[]>({
      action: "sign_paths",
      bucket: "store-branding",
      paths: [path],
      ttlSeconds: 10 * 60,
    });
    return signed.find((entry) => entry.path === path)?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export async function loadOrderTrackingFromBrowser(
  token: string,
  knownVersion: string | null,
): Promise<TrackingResponse> {
  const tokenHash = await hashTrackingToken(token);
  if (!tokenHash) return { ok: false, error: "invalid_request" };

  let payload: Record<string, unknown> | null;
  try {
    payload = await rpc<Record<string, unknown> | null>("storefront_order_tracking", {
      _token_hash: tokenHash,
      _known_version: knownVersion ?? undefined,
    });
  } catch (error) {
    if (error instanceof PublicCommerceClientError && error.code === "rate_limited") {
      return { ok: false, error: "rate_limited" };
    }
    return { ok: false, error: "unavailable" };
  }

  if (!payload || payload.ok !== true) return { ok: false, error: "not_found" };
  if (payload.changed !== true) {
    return { ok: true, changed: false, statusVersion: String(payload.statusVersion ?? "") };
  }

  const rawStore = payload.store && typeof payload.store === "object"
    ? payload.store as Record<string, unknown>
    : {};
  const logoUrl = await signedBrandLogo(rawStore.logoPath);
  const { logoPath: _logoPath, ...store } = rawStore;

  return {
    ...(payload as unknown as PublicOrderTracking),
    store: {
      ...(store as PublicOrderTracking["store"]),
      logoUrl,
    },
  };
}
