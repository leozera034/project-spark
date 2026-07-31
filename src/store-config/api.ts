import { supabase } from "@/integrations/supabase/client";

import type {
  StoreConfiguration,
  StoreOperationalPreview,
  StoreOption,
} from "./types";

const BRANDING_BUCKET = "store-branding";
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = { logo: 3 * 1024 * 1024, cover: 6 * 1024 * 1024 } as const;

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("NOT_FOUND");
  return result.data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

export async function listMyStores(): Promise<StoreOption[]> {
  const { data, error } = await rpc("list_my_stores");
  if (error) throw new Error(error.message);
  return (data ?? []) as StoreOption[];
}

export async function fetchStoreConfiguration(storeId: string | null): Promise<StoreConfiguration> {
  return unwrap(await rpc("get_my_store_configuration", { _store_id: storeId })) as StoreConfiguration;
}

export async function fetchOperationalPreview(
  storeId: string | null,
): Promise<StoreOperationalPreview> {
  return unwrap(
    await rpc("get_store_operational_preview", { _store_id: storeId }),
  ) as StoreOperationalPreview;
}

export interface ProfileInput {
  storeId: string;
  name: string;
  legalName: string;
  document: string;
  phone: string;
  whatsapp: string;
  email: string;
  timezone: string;
  description: string;
  welcomeMessage: string;
  closedMessage: string;
  expectedUpdatedAt: string;
}

export async function updateStoreProfile(input: ProfileInput): Promise<StoreConfiguration> {
  return unwrap(
    await rpc("update_store_profile", {
      _store_id: input.storeId,
      _name: input.name,
      _legal_name: input.legalName,
      _document: input.document,
      _phone: input.phone,
      _whatsapp: input.whatsapp,
      _email: input.email,
      _timezone: input.timezone,
      _description: input.description,
      _welcome_message: input.welcomeMessage,
      _closed_message: input.closedMessage,
      _expected_updated_at: input.expectedUpdatedAt,
    }),
  ) as StoreConfiguration;
}

export interface SlugCheckResult {
  slug: string;
  available: boolean;
  reason: string | null;
}

export async function checkSlugAvailability(
  storeId: string,
  slug: string,
): Promise<SlugCheckResult> {
  return unwrap(
    await rpc("check_store_slug_availability", { _store_id: storeId, _slug: slug }),
  ) as SlugCheckResult;
}

export async function updateStoreSlug(
  storeId: string,
  slug: string,
  expectedUpdatedAt: string,
): Promise<StoreConfiguration> {
  return unwrap(
    await rpc("update_store_slug", {
      _store_id: storeId,
      _slug: slug,
      _expected_updated_at: expectedUpdatedAt,
    }),
  ) as StoreConfiguration;
}

export async function updateStoreTheme(params: {
  storeId: string;
  primary: string;
  accent: string;
  logoPath?: string | null;
  coverPath?: string | null;
  expectedUpdatedAt: string;
}): Promise<StoreConfiguration> {
  return unwrap(
    await rpc("update_store_theme", {
      _store_id: params.storeId,
      _brand_primary: params.primary,
      _brand_accent: params.accent,
      _logo_path: params.logoPath ?? null,
      _cover_path: params.coverPath ?? null,
      _expected_updated_at: params.expectedUpdatedAt,
    }),
  ) as StoreConfiguration;
}

export async function clearStoreAsset(
  storeId: string,
  slot: "logo" | "cover",
): Promise<StoreConfiguration> {
  return unwrap(
    await rpc("clear_store_asset", { _store_id: storeId, _slot: slot }),
  ) as StoreConfiguration;
}

export async function updateServiceSettings(params: {
  storeId: string;
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  minOrderAmount: number;
  defaultPrepMinutes: number;
  soundAlertEnabled: boolean;
  autoOpenByHours: boolean;
  expectedUpdatedAt: string;
}): Promise<StoreConfiguration> {
  return unwrap(
    await rpc("update_store_service_settings", {
      _store_id: params.storeId,
      _accepts_delivery: params.acceptsDelivery,
      _accepts_pickup: params.acceptsPickup,
      _min_order_amount: params.minOrderAmount,
      _default_prep_minutes: params.defaultPrepMinutes,
      _sound_alert_enabled: params.soundAlertEnabled,
      _auto_open_by_hours: params.autoOpenByHours,
      _expected_updated_at: params.expectedUpdatedAt,
    }),
  ) as StoreConfiguration;
}

export async function replaceStoreHours(
  storeId: string,
  hours: { weekday: number; opens_at: string; closes_at: string }[],
  expectedUpdatedAt: string,
): Promise<StoreConfiguration> {
  return unwrap(
    await rpc("replace_store_hours", {
      _store_id: storeId,
      _hours: hours,
      _expected_updated_at: expectedUpdatedAt,
    }),
  ) as StoreConfiguration;
}

export async function upsertNeighborhood(params: {
  storeId: string;
  id: string | null;
  name: string;
  deliveryFee: number;
  minOrderAmount: number | null;
  etaMinutes: number;
  notes: string;
  isActive: boolean;
}): Promise<StoreConfiguration> {
  return unwrap(
    await rpc("upsert_store_neighborhood", {
      _store_id: params.storeId,
      _id: params.id,
      _name: params.name,
      _delivery_fee: params.deliveryFee,
      _min_order_amount: params.minOrderAmount,
      _eta_minutes: params.etaMinutes,
      _notes: params.notes,
      _is_active: params.isActive,
    }),
  ) as StoreConfiguration;
}

export async function archiveNeighborhood(
  storeId: string,
  id: string,
  archived: boolean,
): Promise<StoreConfiguration> {
  return unwrap(
    await rpc("archive_store_neighborhood", { _store_id: storeId, _id: id, _archived: archived }),
  ) as StoreConfiguration;
}

export async function reorderNeighborhoods(
  storeId: string,
  ids: string[],
): Promise<StoreConfiguration> {
  return unwrap(
    await rpc("reorder_store_neighborhoods", { _store_id: storeId, _ids: ids }),
  ) as StoreConfiguration;
}

export async function updatePaymentMethod(params: {
  storeId: string;
  id: string;
  label: string;
  instructions: string;
  needsChange: boolean;
  isActive: boolean;
  availableForDelivery: boolean;
  availableForPickup: boolean;
}): Promise<StoreConfiguration> {
  return unwrap(
    await rpc("update_store_payment_method", {
      _store_id: params.storeId,
      _id: params.id,
      _label: params.label,
      _instructions: params.instructions,
      _needs_change: params.needsChange,
      _is_active: params.isActive,
      _available_for_delivery: params.availableForDelivery,
      _available_for_pickup: params.availableForPickup,
    }),
  ) as StoreConfiguration;
}

export async function reorderPaymentMethods(
  storeId: string,
  ids: string[],
): Promise<StoreConfiguration> {
  return unwrap(
    await rpc("reorder_store_payment_methods", { _store_id: storeId, _ids: ids }),
  ) as StoreConfiguration;
}

/* ------------------------------------------------------------------ */
/* Storage privado da identidade                                       */
/* ------------------------------------------------------------------ */

/** URL assinada temporária. Nunca é persistida no banco nem em logs. */
export async function signBrandingUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(BRANDING_BUCKET)
    .createSignedUrl(path, 300);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function uploadBrandingAsset(
  storeId: string,
  slot: "logo" | "cover",
  file: File,
): Promise<string> {
  if (!ALLOWED_MIME.includes(file.type)) throw new Error("UPLOAD_INVALID_TYPE");
  if (file.size > MAX_BYTES[slot]) throw new Error("UPLOAD_TOO_LARGE");

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${storeId}/${slot}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BRANDING_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("UPLOAD_FAILED");
  return path;
}

/** Remove o arquivo anterior somente depois que a nova referência já foi salva. */
export async function removeBrandingAsset(path: string | null): Promise<void> {
  if (!path) return;
  await supabase.storage.from(BRANDING_BUCKET).remove([path]);
}
