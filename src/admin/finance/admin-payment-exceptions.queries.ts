import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  listAdminPaymentExceptions,
  reviewAdminPaymentException,
  type PaymentExceptionStatus,
} from "@/lib/admin-payment-exceptions.functions";

export function useAdminPaymentExceptions(status: PaymentExceptionStatus | null) {
  const fn = useServerFn(listAdminPaymentExceptions);
  return useQuery({
    queryKey: ["admin", "payment-exceptions", status],
    queryFn: () => fn({ data: { status } }),
    refetchInterval: 30_000,
  });
}

export function useAdminPaymentExceptionActions() {
  const queryClient = useQueryClient();
  const reviewFn = useServerFn(reviewAdminPaymentException);
  const review = useMutation({
    mutationFn: (input: { taskId: string; note?: string | null }) => reviewFn({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "payment-exceptions"] }),
  });
  return { review };
}
