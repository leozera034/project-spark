/**
 * Fase 16 — estado do painel de pedidos.
 *
 * Realtime é apenas um sinal: o evento recebido não traz dados do pedido,
 * ele só dispara a recarga pelas RPCs autorizadas. Se o canal cair, o
 * polling de retaguarda mantém a fila viva.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { extractCode, toFriendlyMessage } from "@/store-config/errors";
import { useStoreScope } from "@/store-scope/StoreScopeProvider";

import {
  fetchOrderCounts,
  fetchOrderDetail,
  fetchOrderHistory,
  fetchOrders,
  fetchTransitionReasons,
  runOrderTransition,
  type OrderListFilters,
} from "./api";
import type { StoreOrderAction, StoreOrderStatus } from "./types";

const FALLBACK_POLL_MS = 20_000;

/**
 * Compatibilidade com as telas legadas que esperam um resultado parecido com
 * React Query. O escopo global já exige uma escolha explícita quando há 2+ lojas,
 * então os consumidores recebem somente a loja atualmente selecionada.
 */
export function useMyStores() {
  const scope = useStoreScope();
  const selected = scope.selectedStore ? [scope.selectedStore] : [];
  return {
    data: selected,
    isLoading: scope.isLoading,
    error: scope.error,
    refetch: scope.refreshStores,
  };
}

export interface QueueFilters {
  statuses: StoreOrderStatus[];
  fulfillment: "entrega" | "retirada" | null;
  search: string;
  delayedOnly: boolean;
}

export function useOrderQueue(storeId: string | null, filters: QueueFilters, enabled: boolean) {
  const [cursor, setCursor] = useState<{ createdAt: string; id: string } | null>(null);

  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);
  useEffect(() => {
    queueMicrotask(() => setCursor(null));
  }, [filterKey, storeId]);

  const listFilters: OrderListFilters = {
    statuses: filters.statuses,
    fulfillment: filters.fulfillment,
    search: filters.search.trim() || null,
    delayedOnly: filters.delayedOnly,
    cursor,
  };

  const query = useQuery({
    queryKey: ["store-orders", "list", storeId, filterKey, cursor?.id ?? null],
    queryFn: () => fetchOrders(storeId, listFilters),
    enabled,
    refetchInterval: FALLBACK_POLL_MS,
    retry: false,
  });

  return { ...query, cursor, setCursor };
}

export function useOrderCounts(storeId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["store-orders", "counts", storeId],
    queryFn: () => fetchOrderCounts(storeId),
    enabled,
    refetchInterval: FALLBACK_POLL_MS,
    retry: false,
  });
}

export function useOrderDetail(storeId: string | null, orderId: string | null) {
  return useQuery({
    queryKey: ["store-orders", "detail", storeId, orderId],
    queryFn: () => fetchOrderDetail(storeId, orderId as string),
    enabled: Boolean(orderId),
    retry: false,
  });
}

export function useOrderHistory(storeId: string | null, orderId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["store-orders", "history", storeId, orderId],
    queryFn: () => fetchOrderHistory(storeId, orderId as string),
    enabled: Boolean(orderId) && enabled,
    retry: false,
  });
}

export function useTransitionReasons() {
  return useQuery({
    queryKey: ["store-orders", "reasons"],
    queryFn: fetchTransitionReasons,
    staleTime: 5 * 60_000,
  });
}

/**
 * Assina sinais da loja e recarrega consultas autorizadas. `subscriber` evita
 * colisão entre o shell global e páginas que também exibem estado do realtime.
 */
export function useOrderRealtime(storeId: string | null, subscriber = "page") {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    const channel = supabase
      .channel(`store-orders:${storeId}:${subscriber}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "store_order_realtime_events",
          filter: `store_id=eq.${storeId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["store-orders"] });
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [storeId, subscriber, queryClient]);

  return live;
}

export function useOrderTransition(storeId: string | null) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: {
      action: StoreOrderAction;
      orderId: string;
      expectedVersion: number;
      reasonCode?: string | null;
      internalNote?: string | null;
      customerMessage?: string | null;
    }) =>
      runOrderTransition(input.action, {
        storeId,
        orderId: input.orderId,
        expectedVersion: input.expectedVersion,
        reasonCode: input.reasonCode ?? null,
        internalNote: input.internalNote ?? null,
        customerMessage: input.customerMessage ?? null,
      }),
  });

  const run = useCallback(
    async (input: Parameters<typeof mutation.mutateAsync>[0], successMessage: string) => {
      try {
        await mutation.mutateAsync(input);
        await queryClient.invalidateQueries({ queryKey: ["store-orders"] });
        toast.success(successMessage);
        return true;
      } catch (error) {
        const code = extractCode(error);
        if (code === "VERSION_CONFLICT") {
          await queryClient.invalidateQueries({ queryKey: ["store-orders"] });
          toast.error("Este pedido mudou em outro aparelho. A tela foi atualizada — confira antes de repetir.");
          return false;
        }
        if (code === "INVALID_TRANSITION") {
          await queryClient.invalidateQueries({ queryKey: ["store-orders"] });
          toast.error("Essa ação não vale mais para a situação atual do pedido.");
          return false;
        }
        toast.error(toFriendlyMessage(error));
        return false;
      }
    },
    [mutation, queryClient],
  );

  return { run, isRunning: mutation.isPending };
}
