import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getStoreSmartDeliveryReadiness } from "@/lib/store-smart-delivery.functions";

export function useStoreSmartDeliveryReadiness(storeId: string | null | undefined) {
  const fn = useServerFn(getStoreSmartDeliveryReadiness);

  return useQuery({
    queryKey: ["store", storeId, "smart-delivery-readiness"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    staleTime: 30_000,
  });
}
