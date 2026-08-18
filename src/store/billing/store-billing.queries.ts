import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMyStoreBillingAccess } from "@/lib/store-billing.functions";

export function useStoreBillingAccess(storeId: string | null) {
  const fn = useServerFn(getMyStoreBillingAccess);

  return useQuery({
    queryKey: ["store-billing-access", storeId],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}
