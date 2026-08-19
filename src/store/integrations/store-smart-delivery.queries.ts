import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  getStoreSmartDeliveryControlCenter,
  getStoreSmartDeliveryReadiness,
  setStoreSmartDeliveryPause,
} from "@/lib/store-smart-delivery.functions";

export function useStoreSmartDeliveryReadiness(storeId: string | null | undefined) {
  const fn = useServerFn(getStoreSmartDeliveryReadiness);

  return useQuery({
    queryKey: ["store", storeId, "smart-delivery-readiness"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    staleTime: 30_000,
  });
}

export function useStoreSmartDeliveryControlCenter(storeId: string | null | undefined) {
  const fn = useServerFn(getStoreSmartDeliveryControlCenter);

  return useQuery({
    queryKey: ["store", storeId, "smart-delivery-control-center"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    staleTime: 20_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useSetStoreSmartDeliveryPause() {
  const queryClient = useQueryClient();
  const fn = useServerFn(setStoreSmartDeliveryPause);

  return useMutation({
    mutationFn: (input: { storeId: string; paused: boolean; reason?: string | null }) =>
      fn({ data: input }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["store", result.store_id, "smart-delivery-control-center"] });
      queryClient.invalidateQueries({ queryKey: ["store", result.store_id, "smart-delivery-readiness"] });
      if (result.is_paused) {
        toast.success(
          result.cancelled_pending_jobs > 0
            ? `Smart Delivery pausado. ${result.cancelled_pending_jobs} job(s) pendente(s) cancelado(s).`
            : "Smart Delivery pausado.",
        );
      } else {
        toast.success("Smart Delivery retomado. Os gates de provider, add-on e limite continuam valendo.");
      }
    },
    onError: () => {
      toast.error("Não foi possível alterar o estado do Smart Delivery.");
    },
  });
}
