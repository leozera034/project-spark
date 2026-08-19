import { useQuery } from "@tanstack/react-query";

import { getStripeConnectStatus, getStripeRuntimeReadiness } from "@/lib/stripe-connect.functions";

export function useStripeConnectStatus(storeId: string | null) {
  return useQuery({
    queryKey: ["store", storeId, "stripe-connect-status"],
    queryFn: () => getStripeConnectStatus({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    staleTime: 15_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data?.connected) return false;
      return data.charges_enabled && data.payouts_enabled ? false : 10_000;
    },
  });
}

export function useStripeRuntimeReadiness() {
  return useQuery({
    queryKey: ["stripe", "runtime-readiness"],
    queryFn: () => getStripeRuntimeReadiness(),
    staleTime: 30_000,
  });
}
