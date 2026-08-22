import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  disconnectStoreEvolutionWhatsApp,
  getStoreEvolutionWhatsAppConnection,
  getStoreEvolutionWhatsAppLiveStatus,
  refreshStoreEvolutionWhatsAppQr,
  sendStoreEvolutionWhatsAppManual,
  startStoreEvolutionWhatsApp,
  type EvolutionWhatsAppActionResult,
  type StoreEvolutionWhatsAppConnection,
} from "@/lib/store-evolution-whatsapp.functions";

const connectionKey = (storeId: string) => ["store-growth", storeId, "evolution-whatsapp-connection"] as const;

function liveStatus(result: EvolutionWhatsAppActionResult, current: StoreEvolutionWhatsAppConnection["status"]): StoreEvolutionWhatsAppConnection["status"] {
  if (result.connected === true) return "connected";
  const state = (result.state ?? "").toLowerCase();
  if (["open", "connected"].includes(state)) return "connected";
  if (["connecting", "pending", "created"].includes(state)) return "pending";
  if (["close", "closed", "disconnected"].includes(state)) return "disconnected";
  if (result.connected === false && current === "connected") return "disconnected";
  return current;
}

export function useStoreEvolutionWhatsAppConnection(storeId: string | null) {
  const fn = useServerFn(getStoreEvolutionWhatsAppConnection);
  return useQuery({
    queryKey: ["store-growth", storeId, "evolution-whatsapp-connection"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" ? 4_000 : 20_000;
    },
  });
}

export function useStoreEvolutionWhatsAppActions() {
  const queryClient = useQueryClient();
  const statusFn = useServerFn(getStoreEvolutionWhatsAppLiveStatus);
  const startFn = useServerFn(startStoreEvolutionWhatsApp);
  const refreshQrFn = useServerFn(refreshStoreEvolutionWhatsAppQr);
  const disconnectFn = useServerFn(disconnectStoreEvolutionWhatsApp);
  const sendManualFn = useServerFn(sendStoreEvolutionWhatsAppManual);

  const syncLiveResult = (storeId: string, result: EvolutionWhatsAppActionResult) => {
    queryClient.setQueryData<StoreEvolutionWhatsAppConnection>(connectionKey(storeId), (current) => {
      if (!current) return current;
      const status = liveStatus(result, current.status);
      const connected = status === "connected";
      return {
        ...current,
        connected,
        status,
        instance_name: result.instanceName ?? current.instance_name,
        display_phone_number: result.displayPhoneNumber ?? current.display_phone_number,
        last_health_at: new Date().toISOString(),
        last_error: connected ? null : current.last_error,
      };
    });
  };

  const forceDisconnected = (storeId: string) => {
    queryClient.setQueryData<StoreEvolutionWhatsAppConnection>(connectionKey(storeId), (current) => current ? {
      ...current,
      connected: false,
      status: "disconnected",
      display_phone_number: null,
      last_health_at: new Date().toISOString(),
    } : current);
  };

  const invalidate = async (storeId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: connectionKey(storeId) }),
      queryClient.invalidateQueries({ queryKey: ["store-growth", storeId, "whatsapp-readiness"] }),
      queryClient.invalidateQueries({ queryKey: ["store-growth", storeId, "whatsapp-history"] }),
      queryClient.invalidateQueries({ queryKey: ["store-growth", storeId, "whatsapp-usage"] }),
    ]);
  };

  const status = useMutation({
    mutationFn: (storeId: string) => statusFn({ data: { storeId } }),
    onSuccess: async (result, storeId) => {
      syncLiveResult(storeId, result);
      await invalidate(storeId);
    },
  });

  const start = useMutation({
    mutationFn: (storeId: string) => startFn({ data: { storeId } }),
    onSuccess: async (result, storeId) => {
      syncLiveResult(storeId, result);
      await invalidate(storeId);
    },
  });

  const refreshQr = useMutation({
    mutationFn: (storeId: string) => refreshQrFn({ data: { storeId } }),
    onSuccess: async (result, storeId) => {
      syncLiveResult(storeId, result);
      await invalidate(storeId);
    },
  });

  const disconnect = useMutation({
    mutationFn: (storeId: string) => disconnectFn({ data: { storeId } }),
    onSuccess: async (_result, storeId) => {
      forceDisconnected(storeId);
      await invalidate(storeId);
    },
  });

  const sendManual = useMutation({
    mutationFn: (data: { storeId: string; phone: string; message: string }) => sendManualFn({ data }),
    onSuccess: async (_result, data) => invalidate(data.storeId),
  });

  return { status, start, refreshQr, disconnect, sendManual };
}
