export interface StoreConfigStore {
  id: string;
  slug: string;
  name: string;
  status: string;
  legal_name: string | null;
  document: string | null;
  segment: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  postal_code: string | null;
  street: string | null;
  address_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  location_source: "unverified" | "manual_browser" | "manual_admin" | "google_geocoding";
  location_verified_at: string | null;
  location_accuracy_meters: number | null;
  timezone: string;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  updated_at: string;
}

export type ManualPixKeyType = "aleatoria" | "cpf_cnpj" | "email" | "telefone" | "outro";

export interface StoreConfigSettings {
  brand_primary: string;
  brand_accent: string;
  logo_path: string | null;
  cover_path: string | null;
  description: string | null;
  welcome_message: string | null;
  closed_message: string | null;
  min_order_amount: number;
  default_prep_minutes: number;
  sound_alert_enabled: boolean;
  auto_open_by_hours: boolean;
  manual_override_open: boolean | null;
  online_payments_enabled: boolean;
  manual_pix_key: string | null;
  manual_pix_key_type: ManualPixKeyType | null;
  online_payment_terms_accepted_at: string | null;
  updated_at: string;
}

export interface StorePaymentSetup {
  online_enabled: boolean;
  online_ready: boolean;
  stripe_connected: boolean;
  details_submitted: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  transfers_enabled: boolean;
  requirements_currently_due: string[];
  application_fee_bps: number | null;
  manual_pix_configured: boolean;
  online_terms_accepted_at: string | null;
}

export interface StoreConfigShift {
  weekday: number;
  opens_at: string;
  closes_at: string;
}

export interface StoreConfigNeighborhood {
  id: string;
  name: string;
  delivery_fee: number;
  min_order_amount: number | null;
  eta_minutes: number;
  notes: string | null;
  is_active: boolean;
  is_archived: boolean;
  sort_order: number;
  updated_at: string;
}

export interface StoreConfigPaymentMethod {
  id: string;
  kind: string;
  label: string;
  instructions: string | null;
  needs_change: boolean;
  is_active: boolean;
  available_for_delivery: boolean;
  available_for_pickup: boolean;
  processing_mode: "online" | "manual";
  sort_order: number;
  updated_at: string;
}

export interface StoreConfigAbilities {
  update_profile: boolean;
  manage_settings: boolean;
  manage_hours: boolean;
  manage_neighborhoods: boolean;
  manage_payment_methods: boolean;
}

export interface StoreConfiguration {
  store: StoreConfigStore;
  settings: StoreConfigSettings;
  payment_setup: StorePaymentSetup;
  hours: StoreConfigShift[];
  neighborhoods: StoreConfigNeighborhood[];
  payment_methods: StoreConfigPaymentMethod[];
  can: StoreConfigAbilities;
}

export interface StoreOperationalPreview {
  timezone: string;
  local_time: string;
  is_open: boolean;
  closes_at: string | null;
  next_open_at: string | null;
  next_open_day: string | null;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  mode: "schedule" | "manual";
  manual_override_open: boolean | null;
  settings_updated_at: string | null;
  reason: string | null;
}

export interface StoreOption {
  id: string;
  name: string;
  slug: string;
}

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

/**
 * Precedência do pedido mínimo (Fase 08):
 * 1. valor específico do bairro, quando definido;
 * 2. pedido mínimo padrão da loja;
 * 3. zero.
 */
export function resolveMinOrder(
  neighborhood: Pick<StoreConfigNeighborhood, "min_order_amount"> | null,
  storeDefault: number | null | undefined,
): number {
  if (neighborhood?.min_order_amount != null) return Number(neighborhood.min_order_amount);
  if (storeDefault != null) return Number(storeDefault);
  return 0;
}

/**
 * Precedência do tempo estimado (Fase 08): o bairro continua sendo o fallback
 * operacional. Rotas inteligentes são calculadas em camada separada.
 */
export function resolveEta(
  neighborhood: Pick<StoreConfigNeighborhood, "eta_minutes"> | null,
  storeDefaultPrep: number | null | undefined,
): number {
  if (neighborhood?.eta_minutes != null) return Number(neighborhood.eta_minutes);
  return Number(storeDefaultPrep ?? 0);
}
