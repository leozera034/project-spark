/**
 * Contratos públicos do assistente de pedido.
 * Valores de preço/taxa continuam sendo apenas projeções: o servidor recalcula tudo.
 */

export type FulfillmentType = "entrega" | "retirada";
export type DeliveryPricingMode = "neighborhood" | "fixed" | "radius";

export type PublicDeliveryArea = {
  id: string;
  name: string;
  deliveryFee: number;
  minimumOrderAmount: number;
  estimatedMinutes: number | null;
  publicNotes: string | null;
};

export type PublicRadiusBand = {
  id: string;
  maxDistanceKm: number;
  deliveryFee: number;
  minimumOrderAmount: number;
  estimatedMinutes: number | null;
};

export type PublicFixedDeliveryQuote = {
  deliveryFee: number;
  minimumOrderAmount: number;
  estimatedMinutes: number | null;
};

export type PublicFulfillmentConfiguration = {
  configurationVersion: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  storeIsOpen: boolean;
  storeName: string;
  defaultPreparationMinutes: number;
  deliveryPricingMode: DeliveryPricingMode;
  storeLocationReady: boolean;
  fixedQuote: PublicFixedDeliveryQuote | null;
  radiusBands: PublicRadiusBand[];
  deliveryAreas: PublicDeliveryArea[];
};

export type FulfillmentValidation = {
  isValid: boolean;
  configurationVersion: string;
  fulfillmentType: FulfillmentType | null;
  deliveryPricingMode: DeliveryPricingMode;
  storeIsOpen: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryArea: PublicDeliveryArea | null;
  deliveryFee: number | null;
  minimumOrderAmount: number | null;
  estimatedMinutes: number | null;
  distanceKm: number | null;
  validationErrors: string[];
};

export type AddressLabel = "Casa" | "Trabalho" | "Outro";

/**
 * O bairro canônico só existe no modo por bairro. Nos modos fixo/raio,
 * guardamos o nome digitado para orientar a entrega e deixamos o ID nulo.
 */
export type LocalSavedAddress = {
  localId: string;
  label: AddressLabel;
  customLabel: string | null;
  neighborhoodId: string | null;
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
  informativeDeliveryFee: number | null;
  informativeMinimumOrder: number | null;
  informativeEstimatedMinutes: number | null;
  informativeDistanceKm: number | null;
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
