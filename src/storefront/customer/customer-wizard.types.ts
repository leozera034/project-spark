/**
 * Fase 12 — Contratos do wizard público do cliente.
 *
 * Nada aqui reutiliza tipos administrativos: são projeções mínimas,
 * pensadas para viver no aparelho do cliente sem carregar dados do banco.
 */

export type FulfillmentType = "entrega" | "retirada";

/** Área de entrega publicada pela loja. Somente campos públicos. */
export type PublicDeliveryArea = {
  id: string;
  name: string;
  deliveryFee: number;
  minimumOrderAmount: number;
  estimatedMinutes: number | null;
  publicNotes: string | null;
};

export type PublicFulfillmentConfiguration = {
  configurationVersion: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  storeIsOpen: boolean;
  storeName: string;
  defaultPreparationMinutes: number;
  deliveryAreas: PublicDeliveryArea[];
};

export type FulfillmentValidation = {
  isValid: boolean;
  configurationVersion: string;
  fulfillmentType: FulfillmentType | null;
  storeIsOpen: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryArea: PublicDeliveryArea | null;
  deliveryFee: number | null;
  minimumOrderAmount: number | null;
  estimatedMinutes: number | null;
  validationErrors: string[];
};

export type AddressLabel = "Casa" | "Trabalho" | "Outro";

/** Endereço salvo apenas no aparelho. Nunca é enviado ao servidor nesta fase. */
export type LocalSavedAddress = {
  localId: string;
  label: AddressLabel;
  customLabel: string | null;
  neighborhoodId: string;
  neighborhoodNameSnapshot: string;
  street: string;
  number: string | null;
  hasNoNumber: boolean;
  complement: string | null;
  referencePoint: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
};

/** Rascunho em edição; vive só no sessionStorage até ser salvo. */
export type AddressDraft = {
  editingLocalId: string | null;
  neighborhoodId: string | null;
  neighborhoodNameSnapshot: string | null;
  street: string;
  number: string;
  hasNoNumber: boolean;
  complement: string;
  referencePoint: string;
  label: AddressLabel;
  customLabel: string;
  latitude: number | null;
  longitude: number | null;
};

export type CustomerLocalProfile = {
  schemaVersion: 1;
  firstName: string | null;
  lastFulfillmentPreference: FulfillmentType | null;
  savedAddresses: LocalSavedAddress[];
  updatedAt: string;
};

export type CustomerWizardStep =
  | "loading_store"
  | "identify_customer"
  | "confirm_saved_name"
  | "choose_fulfillment"
  | "choose_saved_address"
  | "address_neighborhood"
  | "address_street"
  | "address_number"
  | "address_complement"
  | "address_reference"
  | "address_label"
  | "confirm_address"
  | "confirm_pickup"
  | "validating_context"
  | "completed"
  | "read_only"
  | "error";

export type CustomerSessionContext = {
  schemaVersion: 1;
  wizardStep: CustomerWizardStep;
  firstName: string | null;
  fulfillmentType: FulfillmentType | null;
  selectedAddressLocalId: string | null;
  addressDraft: AddressDraft | null;
  confirmedAddressFingerprint: string | null;
  fulfillmentConfigurationVersion: string | null;
  safeReturnPath: string | null;
  completed: boolean;
  updatedAt: string;
};

export type ConfirmedDeliveryContext = {
  type: "entrega";
  firstName: string;
  address: LocalSavedAddress;
  /** Informativo: será recalculado no servidor no checkout. */
  informativeDeliveryFee: number | null;
  informativeMinimumOrder: number | null;
  informativeEstimatedMinutes: number | null;
};

export type ConfirmedPickupContext = {
  type: "retirada";
  firstName: string;
  informativeEstimatedMinutes: number | null;
};

export type StorefrontOrderingContext = ConfirmedDeliveryContext | ConfirmedPickupContext;

export type CustomerWizardState = {
  step: CustomerWizardStep;
  profile: CustomerLocalProfile;
  session: CustomerSessionContext;
  storageAvailable: boolean;
};
