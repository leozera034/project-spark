import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  getStoreFinancialCenter,
  requestStorePayout,
  type PayoutSpeed,
} from "@/lib/store-finance.functions";

export function useStoreFinancialCenter(storeId: string | null) {
  const fn = useServerFn(getStoreFinancialCenter);
  return useQuery({
    queryKey: ["store-finance", storeId, "center"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    refetchInterval: 60000,
  });
}

export function useStoreFinanceActions() {
  const queryClient = useQueryClient();
  const requestFn = useServerFn(requestStorePayout);

  const requestPayout = useMutation({
    mutationFn: (input: { storeId: string; speed: PayoutSpeed; idempotencyKey: string }) =>
      requestFn({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-finance"] }),
  });

  return { requestPayout };
}
