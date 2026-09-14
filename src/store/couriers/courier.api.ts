/**
 * Fase 18 e 19 — acesso às RPCs autorizadas do entregador.
 * Toda escrita exige versionamento e chave de idempotência.
 */
import { supabase } from "@/integrations/supabase/client";

import type {
  CourierAccountFilter,
  CourierAvailabilityFilter,
  CourierCounts,
  CourierDetail,
  CourierListPayload,
  CourierPresenceFilter,
  CourierVehicle,
  DeliveryAssignment,
  EligibleCourier,
  StoreDeliveryOccurrence,
  CourierOperationalContext,
  CourierPresenceResult,
  DeliveryActionResult,
  DeliveryReturnReason,
} from "./courier.types";

const rpc = supabase.rpc.bind(supabase) as any;

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("NOT_FOUND");
  return result.data as T;
}

export interface CourierListFilters {
  account?: CourierAccountFilter | null;
  presence?: CourierPresenceFilter | null;
  availability?: CourierAvailabilityFilter | null;
}

export async function fetchCourierList(storeId: string | null, filters: CourierListFilters = {}): Promise<CourierListPayload> {
  return unwrap<CourierListPayload>(await rpc("list_my_store_couriers", {
    _store_id: storeId,
    _account: filters.account ?? null,
    _presence: filters.presence ?? null,
    _availability: filters.availability ?? null,
  }));
}

export async function fetchCourierCounts(storeId: string | null): Promise<CourierCounts> {
  const payload = unwrap<{ counts: CourierCounts }>(await rpc("get_courier_management_counts", { _store_id: storeId }));
  return payload.counts;
}

export async function fetchCourierDetail(storeId: string | null, courierId: string): Promise<CourierDetail> {
  return unwrap<CourierDetail>(await rpc("get_my_store_courier_detail", { _store_id: storeId, _courier_id: courierId }));
}

export async function updateCourier(input: { storeId: string | null; courierId: string; expectedVersion: number; fullName: string; phone: string; vehicle: Exclude<CourierVehicle, "nao_informado">; canAcceptDeliveries: boolean }): Promise<CourierDetail> {
  return unwrap<CourierDetail>(await rpc("update_store_courier_profile", {
    _store_id: input.storeId,
    _courier_id: input.courierId,
    _expected_version: input.expectedVersion,
    _full_name: input.fullName,
    _phone: input.phone,
    _vehicle: input.vehicle,
    _can_accept_deliveries: input.canAcceptDeliveries,
  }));
}

export async function activateCourier(input: { storeId: string | null; courierId: string; expectedVersion: number }): Promise<{ version: number }> {
  return unwrap<{ version: number }>(await rpc("activate_store_courier", { _store_id: input.storeId, _courier_id: input.courierId, _expected_version: input.expectedVersion }));
}

export async function deactivateCourier(input: { storeId: string | null; courierId: string; expectedVersion: number }): Promise<{ version: number }> {
  return unwrap<{ version: number }>(await rpc("deactivate_store_courier", { _store_id: input.storeId, _courier_id: input.courierId, _expected_version: input.expectedVersion }));
}

export async function fetchEligibleCouriers(storeId: string | null, orderId: string): Promise<EligibleCourier[]> {
  const payload = unwrap<{ couriers: EligibleCourier[] }>(await rpc("list_eligible_couriers_for_delivery", { _store_id: storeId, _order_id: orderId }));
  return payload.couriers ?? [];
}

export async function fetchDeliveryAssignment(storeId: string | null, orderId: string): Promise<DeliveryAssignment> {
  return unwrap<DeliveryAssignment>(await rpc("get_store_delivery_assignment", { _store_id: storeId, _order_id: orderId }));
}

export async function assignCourier(input: { storeId: string | null; orderId: string; courierId: string; expectedDeliveryVersion: number; internalNote?: string | null }): Promise<{ version: number }> {
  return unwrap<{ version: number }>(await rpc("assign_delivery_courier", {
    _store_id: input.storeId,
    _order_id: input.orderId,
    _courier_id: input.courierId,
    _expected_delivery_version: input.expectedDeliveryVersion,
    _internal_note: input.internalNote ?? null,
  }));
}

export async function reassignCourier(input: { storeId: string | null; orderId: string; courierId: string; expectedDeliveryVersion: number; reasonCode: string; internalNote?: string | null }): Promise<{ version: number }> {
  return unwrap<{ version: number }>(await rpc("reassign_delivery_courier", {
    _store_id: input.storeId,
    _order_id: input.orderId,
    _courier_id: input.courierId,
    _expected_delivery_version: input.expectedDeliveryVersion,
    _reason_code: input.reasonCode,
    _internal_note: input.internalNote ?? null,
  }));
}

export async function retryReturnedDelivery(input: {
  storeId: string | null;
  orderId: string;
  expectedOrderVersion: number;
  expectedDeliveryVersion: number;
  address?: { street: string; number: string; neighborhoodName: string; complement?: string | null; reference?: string | null } | null;
  internalNote?: string | null;
}) {
  return unwrap<{ ok: boolean; orderVersion: number; deliveryVersion: number }>(await rpc("retry_returned_delivery", {
    _store_id: input.storeId,
    _order_id: input.orderId,
    _expected_order_version: input.expectedOrderVersion,
    _expected_delivery_version: input.expectedDeliveryVersion,
    _address: input.address ?? null,
    _internal_note: input.internalNote ?? null,
  }));
}

export async function cancelReturnedDelivery(input: {
  storeId: string | null;
  orderId: string;
  expectedOrderVersion: number;
  expectedDeliveryVersion: number;
  reasonCode: string;
  internalNote?: string | null;
  customerMessage?: string | null;
}) {
  return unwrap<{ ok: boolean; orderVersion: number; deliveryVersion: number }>(await rpc("cancel_returned_delivery", {
    _store_id: input.storeId,
    _order_id: input.orderId,
    _expected_order_version: input.expectedOrderVersion,
    _expected_delivery_version: input.expectedDeliveryVersion,
    _reason_code: input.reasonCode,
    _internal_note: input.internalNote ?? null,
    _customer_message: input.customerMessage ?? null,
  }));
}

export async function fetchDeliveryOccurrences(storeId: string | null, orderId: string): Promise<StoreDeliveryOccurrence[]> {
  const payload = unwrap<{ occurrences: StoreDeliveryOccurrence[] }>(await rpc("list_store_delivery_occurrences", { _store_id: storeId, _order_id: orderId }));
  return payload.occurrences ?? [];
}

export async function resolveDeliveryOccurrence(input: { storeId: string | null; occurrenceId: string; expectedVersion: number; resolutionNote?: string | null }): Promise<{ version: number }> {
  return unwrap<{ version: number }>(await rpc("resolve_store_delivery_occurrence", {
    _store_id: input.storeId,
    _occurrence_id: input.occurrenceId,
    _expected_version: input.expectedVersion,
    _resolution_note: input.resolutionNote ?? null,
  }));
}

export async function fetchMyCourierOperationalContext(): Promise<CourierOperationalContext> {
  return unwrap<CourierOperationalContext>(await rpc("get_my_courier_operational_context", {}));
}
export async function setMyCourierOnline(): Promise<CourierPresenceResult> { return unwrap<CourierPresenceResult>(await rpc("set_my_courier_online", {})); }
export async function setMyCourierOffline(): Promise<CourierPresenceResult> { return unwrap<CourierPresenceResult>(await rpc("set_my_courier_offline", {})); }
export async function heartbeatMyCourierPresence(): Promise<CourierPresenceResult> { return unwrap<CourierPresenceResult>(await rpc("heartbeat_my_courier_presence", {})); }
export async function acceptMyDeliveryAssignment(input: { deliveryId: string; expectedVersion: number; idempotencyKey: string }): Promise<DeliveryActionResult> { return unwrap<DeliveryActionResult>(await rpc("accept_my_delivery_assignment", { _delivery_id: input.deliveryId, _expected_version: input.expectedVersion, _idempotency_key: input.idempotencyKey })); }
export async function declineMyDeliveryAssignment(input: { deliveryId: string; expectedVersion: number; reasonCode: string; note?: string; idempotencyKey: string }): Promise<DeliveryActionResult> { return unwrap<DeliveryActionResult>(await rpc("decline_my_delivery_assignment", { _delivery_id: input.deliveryId, _expected_version: input.expectedVersion, _reason_code: input.reasonCode, _idempotency_key: input.idempotencyKey, _note: input.note ?? null })); }
export async function confirmMyArrivalAtStore(input: { deliveryId: string; expectedVersion: number; idempotencyKey: string }): Promise<DeliveryActionResult> { return unwrap<DeliveryActionResult>(await rpc("confirm_my_arrival_at_store", { _delivery_id: input.deliveryId, _expected_version: input.expectedVersion, _idempotency_key: input.idempotencyKey })); }
export async function confirmMyOrderPickup(input: { deliveryId: string; expectedVersion: number; idempotencyKey: string }): Promise<DeliveryActionResult> { return unwrap<DeliveryActionResult>(await rpc("confirm_my_order_pickup", { _delivery_id: input.deliveryId, _expected_version: input.expectedVersion, _idempotency_key: input.idempotencyKey })); }
export async function startMyDelivery(input: { deliveryId: string; expectedVersion: number; idempotencyKey: string }): Promise<DeliveryActionResult> { return unwrap<DeliveryActionResult>(await rpc("start_my_delivery", { _delivery_id: input.deliveryId, _expected_version: input.expectedVersion, _idempotency_key: input.idempotencyKey })); }
export async function completeMyDelivery(input: { deliveryId: string; expectedVersion: number; idempotencyKey: string }): Promise<DeliveryActionResult> { return unwrap<DeliveryActionResult>(await rpc("complete_my_delivery", { _delivery_id: input.deliveryId, _expected_version: input.expectedVersion, _idempotency_key: input.idempotencyKey })); }
export async function startMyDeliveryReturn(input: { deliveryId: string; expectedVersion: number; reasonCode: DeliveryReturnReason; note?: string; idempotencyKey: string }): Promise<DeliveryActionResult> { return unwrap<DeliveryActionResult>(await rpc("start_my_delivery_return", { _delivery_id: input.deliveryId, _expected_version: input.expectedVersion, _reason_code: input.reasonCode, _note: input.note ?? null, _idempotency_key: input.idempotencyKey })); }
export async function completeMyDeliveryReturn(input: { deliveryId: string; expectedVersion: number; idempotencyKey: string }): Promise<DeliveryActionResult> { return unwrap<DeliveryActionResult>(await rpc("complete_my_delivery_return", { _delivery_id: input.deliveryId, _expected_version: input.expectedVersion, _idempotency_key: input.idempotencyKey })); }
export async function reportMyDeliveryOccurrence(input: { deliveryId: string; code: string; note?: string; expectedVersion: number; idempotencyKey: string }): Promise<DeliveryActionResult> { return unwrap<DeliveryActionResult>(await rpc("report_my_delivery_occurrence", { _delivery_id: input.deliveryId, _code: input.code, _note: input.note ?? null, _expected_version: input.expectedVersion, _idempotency_key: input.idempotencyKey })); }
