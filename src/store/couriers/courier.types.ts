/**
 * Fase 18 — contratos da gestão de entregadores.
 *
 * Nenhum campo financeiro, contador ou ranking existe aqui por decisão de
 * escopo. Presença (`presenceStatus`) e disponibilidade são conceitos
 * distintos e nunca são usados como sinônimos.
 */

export type CourierAccountFilter = "ativo" | "inativo";
export type CourierPresenceFilter = "online" | "offline";
export type CourierAvailabilityFilter = "disponivel" | "ocupado";

/** Presença derivada: intenção declarada + sinal recente. */
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
}

export interface CourierListItem {
  courierId: string;
  displayName: string;
  phoneMasked: string | null;
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
    courier: {
      courierId: string;
      displayName: string;
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

/** Retorno do cadastro. A senha temporária aparece uma única vez. */
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
  canAcceptDeliveries: boolean;
  isActive: boolean;
  idempotencyKey: string;
}
