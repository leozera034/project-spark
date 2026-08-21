import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  disconnectStoreEvolutionWhatsApp,
  getStoreEvolutionWhatsAppConnection,
  getStoreEvolutionWhatsAppLiveStatus,
  refreshStoreEvolutionWhatsAppQr,
  sendStoreEvolutionWhatsAppManual,
  startStoreEvolutionWhatsApp,
} from "@/lib/store-evolution-whatsapp.functions";

export function useStoreEvolutionWhatsAppConnection(storeId: string | null) {
  const fn = useServerFn(getStoreEvolutionWhatsAppConnection);
  return useQuery({
    queryKey: ["store-growth", storeId, "evolution-whatsapp-connection"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    staleTime: 5_000,
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

  const invalidate = async (storeId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["store-growth", storeId, "evolution-whatsapp-connection"] }),
      queryClient.invalidateQueries({ queryKey: ["store-growth", storeId, "whatsapp-readiness"] }),
      queryClient.invalidateQueries({ queryKey: ["store-growth", storeId, "whatsapp-history"] }),
      queryClient.invalidateQueries({ queryKey: ["store-growth", storeId, "whatsapp-usage"] }),
    ]);
  };

  const status = useMutation({
    mutationFn: (storeId: string) => statusFn({ data: { storeId } }),
    onSuccess: async (_result, storeId) => invalidate(storeId),
  });

  const start = useMutation({
    mutationFn: (storeId: string) => startFn({ data: { storeId } }),
    onSuccess: async (_result, storeId) => invalidate(storeId),
  });

  const refreshQr = useMutation({
    mutationFn: (storeId: string) => refreshQrFn({ data: { storeId } }),
    onSuccess: async (_result, storeId) => invalidate(storeId),
  });

  const disconnect = useMutation({
    mutationFn: (storeId: string) => disconnectFn({ data: { storeId } }),
    onSuccess: async (_result, storeId) => invalidate(storeId),
  });

  const sendManual = useMutation({
    mutationFn: (data: { storeId: string; phone: string; message: string }) => sendManualFn({ data }),
    onSuccess: async (_result, data) => invalidate(data.storeId),
  });

  return { status, start, refreshQr, disconnect, sendManual };
}
