/**
 * Fase 12 — Camada pública de atendimento (modalidades e bairros).
 *
 * SERVIDOR-ONLY. Mesmas regras da Fase 11:
 * - o visitante nunca toca nas tabelas: tudo passa por RPCs `storefront_*`
 *   concedidas apenas ao servidor;
 * - projeção explícita; nenhum `store_id` ou campo administrativo sai daqui;
 * - erros normalizados, sem detalhe de schema.
 */
import { StorefrontError, slugSchema } from "@/lib/storefront.server";
import type {
  FulfillmentValidation,
  PublicDeliveryArea,
  PublicFulfillmentConfiguration,
} from "@/storefront/customer/customer-wizard.types";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapArea(raw: Record<string, unknown>): PublicDeliveryArea {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ""),
    deliveryFee: toNumber(raw.deliveryFee, 0),
    minimumOrderAmount: toNumber(raw.minimumOrderAmount, 0),
    estimatedMinutes:
      raw.estimatedMinutes === null || raw.estimatedMinutes === undefined
        ? null
        : toNumber(raw.estimatedMinutes, 0),
    publicNotes: raw.publicNotes ? String(raw.publicNotes) : null,
  };
}

export async function loadPublicFulfillment(
  rawSlug: string,
): Promise<PublicFulfillmentConfiguration> {
  const slug = slugSchema.parse(rawSlug);
  const db = await admin();
  const { data, error } = await db.rpc("storefront_fulfillment", { _slug: slug });

  if (error) {
    console.error("[storefront] fulfillment rpc failed", error.message);
    throw new StorefrontError("unavailable");
  }
  if (!data) throw new StorefrontError("not_found");

  const payload = data as Record<string, unknown>;
  return {
    configurationVersion: String(payload.configurationVersion ?? ""),
    deliveryEnabled: Boolean(payload.deliveryEnabled),
    pickupEnabled: Boolean(payload.pickupEnabled),
    storeIsOpen: Boolean(payload.storeIsOpen),
    storeName: String(payload.storeName ?? ""),
    defaultPreparationMinutes: toNumber(payload.defaultPreparationMinutes, 30),
    deliveryAreas: ((payload.deliveryAreas ?? []) as Record<string, unknown>[]).map(mapArea),
  };
}

export async function validatePublicFulfillment(input: {
  slug: string;
  fulfillmentType: "entrega" | "retirada";
  deliveryAreaId?: string | null;
  configurationVersion?: string | null;
}): Promise<FulfillmentValidation> {
  const slug = slugSchema.parse(input.slug);
  const db = await admin();
  const { data, error } = await db.rpc("storefront_validate_fulfillment", {
    _slug: slug,
    _fulfillment_type: input.fulfillmentType,
    _delivery_area_id: input.deliveryAreaId ?? undefined,
    _configuration_version: input.configurationVersion ?? undefined,
  });

  if (error) {
    console.error("[storefront] fulfillment validate rpc failed", error.message);
    throw new StorefrontError("unavailable");
  }
  if (!data) throw new StorefrontError("not_found");

  const payload = data as Record<string, unknown>;
  const area = payload.deliveryArea
    ? mapArea(payload.deliveryArea as Record<string, unknown>)
    : null;

  return {
    isValid: Boolean(payload.isValid),
    configurationVersion: String(payload.configurationVersion ?? ""),
    fulfillmentType: payload.fulfillmentType ?? null,
    storeIsOpen: Boolean(payload.storeIsOpen),
    deliveryEnabled: Boolean(payload.deliveryEnabled),
    pickupEnabled: Boolean(payload.pickupEnabled),
    deliveryArea: area,
    deliveryFee:
      payload.deliveryFee === null || payload.deliveryFee === undefined
        ? null
        : toNumber(payload.deliveryFee, 0),
    minimumOrderAmount:
      payload.minimumOrderAmount === null || payload.minimumOrderAmount === undefined
        ? null
        : toNumber(payload.minimumOrderAmount, 0),
    estimatedMinutes:
      payload.estimatedMinutes === null || payload.estimatedMinutes === undefined
        ? null
        : toNumber(payload.estimatedMinutes, 0),
    validationErrors: Array.isArray(payload.validationErrors)
      ? payload.validationErrors.map((code: unknown) => String(code))
      : [],
  };
}
