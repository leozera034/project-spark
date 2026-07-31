/**
 * Fase 17 — acesso às RPCs do Modo Cozinha.
 *
 * A leitura usa a projeção mínima `list_my_kitchen_orders`. As transições
 * reutilizam exatamente os wrappers da Fase 16, com a mesma máquina de
 * estados, o mesmo controle de versão, o mesmo histórico e a mesma auditoria.
 * O navegador nunca envia o status de destino.
 */
import { supabase } from "@/integrations/supabase/client";

import type { KitchenAction, KitchenProjection } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("NOT_FOUND");
  return result.data as T;
}

export async function fetchKitchenOrders(storeId: string | null): Promise<KitchenProjection> {
  return unwrap<KitchenProjection>(await rpc("list_my_kitchen_orders", { _store_id: storeId }));
}

const ACTION_RPC: Record<KitchenAction, string> = {
  start_preparation: "start_store_order_preparation",
  mark_ready: "mark_store_order_ready",
};

export async function runKitchenAction(
  action: KitchenAction,
  input: { storeId: string | null; orderId: string; expectedVersion: number },
): Promise<{ status: string; version: number }> {
  return unwrap<{ status: string; version: number }>(
    await rpc(ACTION_RPC[action], {
      _store_id: input.storeId,
      _order_id: input.orderId,
      _expected_version: input.expectedVersion,
      _internal_note: null,
    }),
  );
}
