/**
 * Fase 17 — estado do Modo Cozinha.
 *
 * Realtime é apenas sinal (loja + pedido + versão). Nenhum item, observação
 * ou dado do cliente trafega no evento: ao receber, a fila recarrega pela
 * RPC autorizada. Sem conexão, a última projeção fica em memória e as ações
 * são bloqueadas — nada é enfileirado para depois.
 */
import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { extractCode } from "@/store-config/errors";

import { fetchKitchenOrders, runKitchenAction } from "./api";
import type { KitchenAction, KitchenProjection } from "./types";

const FALLBACK_POLL_MS = 20_000;
const LIVE_POLL_MS = 60_000;

export const KITCHEN_QUERY_KEY = ["kitchen", "orders"] as const;

/** Conexão do navegador, sem depender de reload manual. */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}

/** Relógio local ancorado no horário do servidor, sem requisição por segundo. */
export function useServerClock(serverNow: string | undefined) {
  const [tick, setTick] = useState(() => Date.now());
  const offset = serverNow ? new Date(serverNow).getTime() - tick : 0;

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  return tick + offset;
}

export function useKitchenQueue(storeId: string | null, live: boolean, online: boolean) {
  return useQuery<KitchenProjection>({
    queryKey: [...KITCHEN_QUERY_KEY, storeId],
    queryFn: () => fetchKitchenOrders(storeId),
    enabled: Boolean(storeId),
    retry: false,
    // Uma única estratégia: com Realtime saudável o intervalo é folgado;
    // sem canal, o fallback assume. Offline, nada é disparado.
    refetchInterval: online ? (live ? LIVE_POLL_MS : FALLBACK_POLL_MS) : false,
    refetchOnWindowFocus: online,
    refetchOnReconnect: true,
  });
}

/** Assina o canal de sinais da própria loja; evento de outra loja é descartado. */
export function useKitchenRealtime(storeId: string | null) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!storeId) {
      queueMicrotask(() => setLive(false));
      return;
    }
    const channel = supabase
      .channel(`kitchen-orders:${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "store_order_realtime_events",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          const event = payload.new as { store_id?: string } | null;
          if (!event || event.store_id !== storeId) return;
          void queryClient.invalidateQueries({ queryKey: KITCHEN_QUERY_KEY });
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [storeId, queryClient]);

  return live;
}

export function useKitchenAction(storeId: string | null, online: boolean) {
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: { action: KitchenAction; orderId: string; expectedVersion: number }) =>
      runKitchenAction(input.action, {
        storeId,
        orderId: input.orderId,
        expectedVersion: input.expectedVersion,
      }),
  });

  const run = useCallback(
    async (input: { action: KitchenAction; orderId: string; expectedVersion: number }) => {
      if (!online) {
        toast.error(
          "Sem conexão. Você pode consultar os pedidos carregados, mas não pode atualizar o preparo.",
        );
        return false;
      }
      if (pendingId) return false;
      setPendingId(input.orderId);
      try {
        await mutation.mutateAsync(input);
        await queryClient.invalidateQueries({ queryKey: KITCHEN_QUERY_KEY });
        toast.success(
          input.action === "start_preparation"
            ? "Preparo iniciado."
            : "Pedido marcado como pronto.",
        );
        return true;
      } catch (error) {
        const code = extractCode(error);
        await queryClient.invalidateQueries({ queryKey: KITCHEN_QUERY_KEY });
        if (code === "VERSION_CONFLICT" || code === "INVALID_TRANSITION") {
          toast.error("Este pedido foi atualizado em outra tela.");
        } else if (code === "FORBIDDEN") {
          toast.error("Você não tem permissão para esta ação.");
        } else if (code === "NOT_FOUND") {
          toast.error("Este pedido não está mais disponível para preparo.");
        } else {
          toast.error("Não foi possível atualizar o preparo agora.");
        }
        return false;
      } finally {
        setPendingId(null);
      }
    },
    [mutation, online, pendingId, queryClient],
  );

  return { run, pendingId };
}
