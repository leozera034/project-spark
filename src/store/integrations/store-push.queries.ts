import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getStorePushReadiness } from "@/lib/store-push.functions";

export function useStorePushReadiness(storeId: string | null | undefined) {
  const fn = useServerFn(getStorePushReadiness);

  return useQuery({
    queryKey: ["store", storeId, "push-readiness"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    staleTime: 30_000,
  });
}
