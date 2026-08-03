/**
 * Fase 19 — tipos operacionais do entregador.
 *
 * Sincronizado com os retornos das RPCs get_my_courier_operational_context
 * e get_my_delivery_detail.
 */

export type DeliveryStatus =
  | "atribuida"
  | "aceita"
  | "coletada"
  | "em_rota"
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
  | "report_occurrence";

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
  allowedActions: CourierOperationalAllowedAction[];
  
  // Detalhes completos (quando reduced=false)
  orderId?: string;
  orderStatus?: string;
  orderVersion?: number;
  acceptanceRequired?: boolean;
  acceptedAt?: string | null;
  arrivedAtStoreAt?: string | null;
  pickedUpAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  pickup?: DeliveryPickupInfo;
  customer?: DeliveryCustomerInfo;
  payment?: DeliveryPaymentInfo;
  occurrences?: DeliveryOccurrence[];
  requiresStoreAttention?: boolean;
}

export interface CourierOperationalContext {
  courierId: string;
  displayName: string;
  storeName: string;
  storePublicAddress: string;
  storePhone: string;
  accountStatus: "ativo" | "inativo";
  canAcceptDeliveries: boolean;
  acceptanceRequired: boolean;
  onlineIntent: boolean;
  presenceStatus: "online" | "offline" | "sem_sinal";
  lastSeenAt: string | null;
  pendingAssignment: DeliveryProjection | null;
  activeDelivery: DeliveryProjection | null;
  serverNow: string;
  version: number;
}

export interface CourierPresenceResult {
  courierId: string;
  onlineIntent: boolean;
  presenceStatus: "online" | "offline" | "sem_sinal";
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
