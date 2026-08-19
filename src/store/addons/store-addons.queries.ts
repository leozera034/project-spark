import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  getMyStoreAddons,
  getMyStoreEntitlements,
  getMyStoreUsageSummary,
} from "@/lib/store-addons.functions";

export function useStoreAddons(storeId: string | null) {
  const fn = useServerFn(getMyStoreAddons);
  return useQuery({
    queryKey: ["store-addons", storeId],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useStoreEntitlements(storeId: string | null) {
  const fn = useServerFn(getMyStoreEntitlements);
  return useQuery({
    queryKey: ["store-entitlements", storeId],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useStoreUsageSummary(storeId: string | null, periodStart?: string) {
  const fn = useServerFn(getMyStoreUsageSummary);
  return useQuery({
    queryKey: ["store-usage-summary", storeId, periodStart ?? "current"],
    queryFn: () => fn({ data: { storeId: storeId!, periodStart } }),
    enabled: Boolean(storeId),
    staleTime: 30_000,
    retry: 1,
  });
}
