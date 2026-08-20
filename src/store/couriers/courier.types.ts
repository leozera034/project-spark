/**
 * Fase 18 e 19 — contratos da gestão e operação de entregadores.
 */

export type CourierVehicle = "moto" | "carro" | "nao_informado";

export interface DeliveryRouteEstimate {
  distanceMeters: number;
  durationSeconds: number;
  estimatedMinutes: number;
  provider?: string | null;
  mode?: string | null;
  isApproximate: boolean;
  quality: "approximate" | "provider_route";
  estimatedAt: string | null;
}

export type CourierAccountFilter = "ativo" | "inativo";
export type CourierPresenceFilter = "online" | "offline";
export type CourierAvailabilityFilter = "disponivel" | "ocupado";
export type CourierPresence = "online" | "offline" | "sem_sinal";

export type CourierAllowedAction =
  | "update"
  | "activate"
  | "deactivate"
  | "reset_access"
  | "assign";

export interface CourierAssignmentSummary {
  deliveryId: string;
  orderNumber: number | null;
  deliveryStatus: string;
  assignedAt?: string | null;
  route?: DeliveryRouteEstimate | null;
}

export interface CourierListItem {
  courierId: string;
  displayName: string;
  phoneMasked: string | null;
  vehicle: CourierVehicle;
  isActive: boolean;
  canAcceptDeliveries: boolean;
  presenceStatus: "online" | "offline";
  lastSeenAt: string | null;
  currentAssignment: CourierAssignmentSummary | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  allowedActions: CourierAllowedAction[];
}

export interface CourierListPayload {
  storeId: string;
  serverNow: string;
  couriers: CourierListItem[];
}

export interface CourierCounts {
  active: number;
  inactive: number;
  online: number;
  busy: number;
  unassignedDeliveries: number;
}

export interface CourierHistoryEntry {
  occurredAt: string;
  action: string;
  fields: unknown;
  reasonCode: string | null;
}

export interface CourierDetail {
  courierId: string;
  displayName: string;
  phone: string | null;
  vehicle: CourierVehicle;
  loginIdentifier: string | null;
  loginEnabled: boolean;
  requiresPasswordChange: boolean;
  isActive: boolean;
  canAcceptDeliveries: boolean;
  presenceStatus: "online" | "offline";
  lastSeenAt: string | null;
  currentAssignment: CourierAssignmentSummary | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  history: CourierHistoryEntry[];
  allowedActions: CourierAllowedAction[];
}

export type CourierEligibility = "eligible" | "confirm" | "blocked";

export interface EligibleCourier {
  courierId: string;
  displayName: string;
  vehicle: CourierVehicle;
  presenceStatus: "online" | "offline";
  lastSeenAt: string | null;
  canAcceptDeliveries: boolean;
  hasActiveDelivery: boolean;
  eligibility: CourierEligibility;
  blockingReason: string | null;
  version: number;
}

export interface DeliveryAssignmentHistoryEntry {
  occurredAt: string;
  kind: string;
  reasonCode: string | null;
  courierName: string | null;
  previousCourierName: string | null;
  version: number | null;
}

export interface DeliveryAssignment {
  applicable: boolean;
  orderStatus?: string;
  canAssign?: boolean;
  delivery?: {
    deliveryId: string;
    status: string;
    version: number;
    assignedAt: string | null;
    route?: DeliveryRouteEstimate | null;
    courier: {
      courierId: string;
      displayName: string;
      vehicle: CourierVehicle;
      presenceStatus: "online" | "offline";
      isActive: boolean;
    } | null;
    history: DeliveryAssignmentHistoryEntry[];
  } | null;
}

export interface StoreDeliveryOccurrence {
  occurrenceId: string;
  code: string;
  note: string | null;
  requiresStoreAttention: boolean;
  courierName: string | null;
  createdAt: string;
  resolvedAt: string | null;
  version: number;
}

export interface CourierCreationResult {
  courierId: string;
  created: boolean;
  loginIdentifier: string;
  temporaryPassword: string | null;
}

export interface CourierCreateInput {
  storeId: string | null;
  fullName: string;
  phone: string;
  loginIdentifier: string;
  vehicle: Exclude<CourierVehicle, "nao_informado">;
  canAcceptDeliveries: boolean;
  isActive: boolean;
  idempotencyKey: string;
}

export type DeliveryStatus =
  | "atribuida"
  | "aceita"
  | "coletada"
  | "em_rota"
  | "retornando_loja"
  | "devolvida_loja"
  | "concluida"
  | "cancelada"
  | "pendente";

export type CourierOperationalAllowedAction =
  | "accept"
  | "decline"
  | "confirm_arrival"
  | "confirm_pickup"
  | "start_delivery"
  | "complete_delivery"
  | "start_return_to_store"
  | "complete_return_to_store"
  | "report_occurrence";

export type DeliveryReturnReason =
  | "customer_not_found"
  | "incorrect_address"
  | "customer_refused"
  | "payment_problem"
  | "unsafe_location"
  | "other";

export interface DeliveryOccurrence {
  occurrenceId: string;
  code: string;
  note: string | null;
  requiresStoreAttention: boolean;
  resolvedAt: string | null;
  createdAt: string;
  version: number;
}

export interface DeliveryPickupInfo {
  storeName: string;
  address: string;
  phone: string;
}

export interface DeliveryCustomerInfo {
  firstName: string;
  phone: string;
  neighborhood: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  reference: string | null;
  notes: string | null;
}

export interface DeliveryPaymentInfo {
  method: string;
  kind: string;
  needsChange: boolean;
  changeFor: number | null;
  orderAmount: number;
  instructions: string | null;
}

export interface DeliveryProjection {
  deliveryId: string;
  reduced: boolean;
  status: DeliveryStatus;
  version: number;
  assignedAt: string | null;
  orderNumber: number;
  storeName?: string;
  neighborhood?: string | null;
  vehicle?: CourierVehicle;
  route?: DeliveryRouteEstimate | null;
  allowedActions: CourierOperationalAllowedAction[];
  orderId?: string;
  orderStatus?: string;
  orderVersion?: number;
  acceptanceRequired?: boolean;
  acceptedAt?: string | null;
  arrivedAtStoreAt?: string | null;
  pickedUpAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  returnStartedAt?: string | null;
  returnedToStoreAt?: string | null;
  returnReasonCode?: DeliveryReturnReason | null;
  returnNote?: string | null;
  pickup?: DeliveryPickupInfo;
  customer?: DeliveryCustomerInfo;
  payment?: DeliveryPaymentInfo;
  occurrences?: DeliveryOccurrence[];
  requiresStoreAttention?: boolean;
}

export interface CourierOperationalContext {
  courierId: string;
  displayName: string;
  vehicle: CourierVehicle;
  storeName: string;
  storePublicAddress: string;
  storePhone: string;
  accountStatus: "ativo" | "inativo";
  canAcceptDeliveries: boolean;
  acceptanceRequired: boolean;
  onlineIntent: boolean;
  presenceStatus: CourierPresence;
  lastSeenAt: string | null;
  pendingAssignment: DeliveryProjection | null;
  activeDelivery: DeliveryProjection | null;
  serverNow: string;
  version: number;
}

export interface CourierPresenceResult {
  courierId: string;
  onlineIntent: boolean;
  presenceStatus: CourierPresence;
  lastSeenAt: string;
  hasActiveDelivery: boolean;
  version: number;
}

export interface DeliveryActionResult {
  ok: boolean;
  deliveryId: string;
  status?: string;
  version: number;
  occurrenceId?: string;
  released?: boolean;
}
