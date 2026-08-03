/**
 * Fase 18 — acesso às RPCs autorizadas da gestão de entregadores.
 *
 * O navegador nunca envia papel, permissão ou identidade: a loja é resolvida
 * no banco a partir da sessão. Toda escrita exige a versão conhecida.
 */
import { supabase } from "@/integrations/supabase/client";

import type {
  CourierAccountFilter,
  CourierAvailabilityFilter,
  CourierCounts,
  CourierDetail,
  CourierListPayload,
  CourierPresenceFilter,
  DeliveryAssignment,
  EligibleCourier,
  StoreDeliveryOccurrence,
} from "./courier.types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export async function fetchCourierList(
  storeId: string | null,
  filters: CourierListFilters = {},
): Promise<CourierListPayload> {
  return unwrap<CourierListPayload>(
    await rpc("list_my_store_couriers", {
      _store_id: storeId,
      _account: filters.account ?? null,
      _presence: filters.presence ?? null,
      _availability: filters.availability ?? null,
    }),
  );
}

export async function fetchCourierCounts(storeId: string | null): Promise<CourierCounts> {
  const payload = unwrap<{ counts: CourierCounts }>(
    await rpc("get_courier_management_counts", { _store_id: storeId }),
  );
  return payload.counts;
}

export async function fetchCourierDetail(
  storeId: string | null,
  courierId: string,
): Promise<CourierDetail> {
  return unwrap<CourierDetail>(
    await rpc("get_my_store_courier_detail", { _store_id: storeId, _courier_id: courierId }),
  );
}

export async function updateCourier(input: {
  storeId: string | null;
  courierId: string;
  expectedVersion: number;
  fullName?: string | null;
  phone?: string | null;
  canAcceptDeliveries?: boolean | null;
}): Promise<{ version: number }> {
  return unwrap<{ version: number }>(
    await rpc("update_store_courier", {
      _store_id: input.storeId,
      _courier_id: input.courierId,
      _expected_version: input.expectedVersion,
      _full_name: input.fullName ?? null,
      _phone: input.phone ?? null,
      _can_accept_deliveries: input.canAcceptDeliveries ?? null,
    }),
  );
}

export async function activateCourier(input: {
  storeId: string | null;
  courierId: string;
  expectedVersion: number;
}): Promise<{ version: number }> {
  return unwrap<{ version: number }>(
    await rpc("activate_store_courier", {
      _store_id: input.storeId,
      _courier_id: input.courierId,
      _expected_version: input.expectedVersion,
    }),
  );
}

export async function deactivateCourier(input: {
  storeId: string | null;
  courierId: string;
  expectedVersion: number;
}): Promise<{ version: number }> {
  return unwrap<{ version: number }>(
    await rpc("deactivate_store_courier", {
      _store_id: input.storeId,
      _courier_id: input.courierId,
      _expected_version: input.expectedVersion,
    }),
  );
}

export async function fetchEligibleCouriers(
  storeId: string | null,
  orderId: string,
): Promise<EligibleCourier[]> {
  const payload = unwrap<{ couriers: EligibleCourier[] }>(
    await rpc("list_eligible_couriers_for_delivery", { _store_id: storeId, _order_id: orderId }),
  );
  return payload.couriers ?? [];
}

export async function fetchDeliveryAssignment(
  storeId: string | null,
  orderId: string,
): Promise<DeliveryAssignment> {
  return unwrap<DeliveryAssignment>(
    await rpc("get_store_delivery_assignment", { _store_id: storeId, _order_id: orderId }),
  );
}

export async function assignCourier(input: {
  storeId: string | null;
  orderId: string;
  courierId: string;
  expectedDeliveryVersion: number;
  internalNote?: string | null;
}): Promise<{ version: number }> {
  return unwrap<{ version: number }>(
    await rpc("assign_delivery_courier", {
      _store_id: input.storeId,
      _order_id: input.orderId,
      _courier_id: input.courierId,
      _expected_delivery_version: input.expectedDeliveryVersion,
      _internal_note: input.internalNote ?? null,
    }),
  );
}

export async function reassignCourier(input: {
  storeId: string | null;
  orderId: string;
  courierId: string;
  expectedDeliveryVersion: number;
  reasonCode: string;
  internalNote?: string | null;
}): Promise<{ version: number }> {
  return unwrap<{ version: number }>(
    await rpc("reassign_delivery_courier", {
      _store_id: input.storeId,
      _order_id: input.orderId,
      _courier_id: input.courierId,
      _expected_delivery_version: input.expectedDeliveryVersion,
      _reason_code: input.reasonCode,
      _internal_note: input.internalNote ?? null,
    }),
  );
}

export async function fetchDeliveryOccurrences(
  storeId: string | null,
  orderId: string,
): Promise<StoreDeliveryOccurrence[]> {
  const payload = unwrap<{ occurrences: StoreDeliveryOccurrence[] }>(
    await rpc("list_store_delivery_occurrences", { _store_id: storeId, _order_id: orderId }),
  );
  return payload.occurrences ?? [];
}

export async function resolveDeliveryOccurrence(input: {
  storeId: string | null;
  occurrenceId: string;
  expectedVersion: number;
  resolutionNote?: string | null;
}): Promise<{ version: number }> {
  return unwrap<{ version: number }>(
    await rpc("resolve_store_delivery_occurrence", {
      _store_id: input.storeId,
      _occurrence_id: input.occurrenceId,
      _expected_version: input.expectedVersion,
      _resolution_note: input.resolutionNote ?? null,
    }),
  );
}
