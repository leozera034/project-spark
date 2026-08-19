import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getStoreEmailReadiness } from "@/lib/store-email.functions";

export function useStoreEmailReadiness(storeId: string | null | undefined) {
  const fn = useServerFn(getStoreEmailReadiness);

  return useQuery({
    queryKey: ["store", storeId, "email-readiness"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    staleTime: 30_000,
  });
}
