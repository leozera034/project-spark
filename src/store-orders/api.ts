/**
 * Fase 16 — acesso às RPCs do painel de pedidos.
 *
 * Toda transição é atômica no servidor e exige a versão conhecida do pedido;
 * conflito de concorrência volta como `VERSION_CONFLICT` e nunca é resolvido
 * no cliente.
 */
import { supabase } from "@/integrations/supabase/client";

import type {
  StoreOrderAction,
  StoreOrderCounts,
  StoreOrderDetail,
  StoreOrderHistoryEntry,
  StoreOrderListItem,
  StoreOrderStatus,
  TransitionReason,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("NOT_FOUND");
  return result.data as T;
}

export interface OrderListFilters {
  statuses?: StoreOrderStatus[] | null;
  fulfillment?: "entrega" | "retirada" | null;
  search?: string | null;
  delayedOnly?: boolean;
  from?: string | null;
  to?: string | null;
  limit?: number;
  cursor?: { createdAt: string; id: string } | null;
}

export async function fetchOrderCounts(storeId: string | null): Promise<StoreOrderCounts> {
  return unwrap<StoreOrderCounts>(await rpc("get_my_store_order_counts", { _store_id: storeId }));
}

export async function fetchOrders(
  storeId: string | null,
  filters: OrderListFilters,
): Promise<{ orders: StoreOrderListItem[]; nextCursor: { createdAt: string; id: string } | null }> {
  const limit = filters.limit ?? 30;
  const payload = unwrap<{ orders?: StoreOrderListItem[] }>(
    await rpc("list_my_store_orders", {
      _store_id: storeId,
      _statuses: filters.statuses ?? null,
      _fulfillment: filters.fulfillment ?? null,
      _search: filters.search ?? null,
      _delayed_only: filters.delayedOnly ?? false,
      _from: filters.from ?? null,
      _to: filters.to ?? null,
      _limit: limit,
      _cursor: filters.cursor?.createdAt ?? null,
      _cursor_id: filters.cursor?.id ?? null,
    }),
  );
  const orders = payload.orders ?? [];
  // O servidor devolve no máximo `limit` linhas ordenadas por data desc:
  // a página seguinte parte da última linha recebida.
  const last = orders.length === limit ? orders[orders.length - 1] : null;
  return {
    orders,
    nextCursor: last ? { createdAt: last.createdAt, id: last.id } : null,
  };
}

export async function fetchOrderDetail(
  storeId: string | null,
  orderId: string,
): Promise<StoreOrderDetail> {
  return unwrap<StoreOrderDetail>(
    await rpc("get_my_store_order_detail", { _store_id: storeId, _order_id: orderId }),
  );
}

export async function fetchOrderHistory(
  storeId: string | null,
  orderId: string,
): Promise<StoreOrderHistoryEntry[]> {
  const payload = unwrap<{ entries?: StoreOrderHistoryEntry[] }>(
    await rpc("get_my_store_order_history", { _store_id: storeId, _order_id: orderId }),
  );
  return payload.entries ?? [];
}

export async function fetchTransitionReasons(): Promise<TransitionReason[]> {
  const { data, error } = await supabase
    .from("order_transition_reasons")
    .select("code, internal_label, public_message, applies_reject, applies_cancel, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as TransitionReason[];
}

export interface TransitionInput {
  storeId: string | null;
  orderId: string;
  expectedVersion: number;
  reasonCode?: string | null;
  internalNote?: string | null;
  customerMessage?: string | null;
}

const ACTION_RPC: Record<StoreOrderAction, string> = {
  accept: "accept_store_order",
  start_preparation: "start_store_order_preparation",
  mark_ready: "mark_store_order_ready",
  complete_pickup: "complete_store_pickup_order",
  reject: "reject_store_order",
  cancel: "cancel_store_order",
};

/** Executa a transição pedindo ao servidor; nada muda localmente antes disso. */
export async function runOrderTransition(
  action: StoreOrderAction,
  input: TransitionInput,
): Promise<StoreOrderDetail> {
  const needsReason = action === "reject" || action === "cancel";
  const args: Record<string, unknown> = {
    _store_id: input.storeId,
    _order_id: input.orderId,
    _expected_version: input.expectedVersion,
    _internal_note: input.internalNote ?? null,
  };
  if (needsReason) {
    args._reason_code = input.reasonCode;
    args._customer_message = input.customerMessage ?? null;
  }
  return unwrap<StoreOrderDetail>(await rpc(ACTION_RPC[action], args));
}
