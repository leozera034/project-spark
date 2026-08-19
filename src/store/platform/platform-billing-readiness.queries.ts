import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getPlatformBillingProviderReadiness } from "@/lib/platform-billing-readiness.functions";

export function usePlatformBillingProviderReadiness() {
  const fn = useServerFn(getPlatformBillingProviderReadiness);
  return useQuery({
    queryKey: ["platform", "billing-provider-readiness", "stripe"],
    queryFn: () => fn({ data: undefined }),
    staleTime: 30_000,
    retry: 0,
    refetchOnWindowFocus: false,
  });
}
