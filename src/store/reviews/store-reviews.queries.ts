import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getStoreReviewCenter, replyToStoreReview } from "@/lib/store-reviews.functions";

export function useStoreReviewCenter(storeId: string | null) {
  const fn = useServerFn(getStoreReviewCenter);
  return useQuery({
    queryKey: ["store-reviews", storeId, "center"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    refetchInterval: 60_000,
  });
}

export function useStoreReviewActions() {
  const queryClient = useQueryClient();
  const replyFn = useServerFn(replyToStoreReview);

  const reply = useMutation({
    mutationFn: (input: { storeId: string; reviewId: string; reply: string }) => replyFn({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-reviews"] }),
  });

  return { reply };
}
