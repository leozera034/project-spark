import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  completeStoreMetaWhatsAppOnboarding,
  getStoreMetaWhatsAppConnection,
  startStoreMetaWhatsAppOnboarding,
} from "@/lib/store-whatsapp-onboarding.functions";

export function useStoreMetaWhatsAppConnection(storeId: string | null) {
  const fn = useServerFn(getStoreMetaWhatsAppConnection);
  return useQuery({
    queryKey: ["store-growth", storeId, "meta-whatsapp-connection"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    refetchInterval: 60_000,
  });
}

export function useStoreMetaWhatsAppOnboardingActions() {
  const queryClient = useQueryClient();
  const startFn = useServerFn(startStoreMetaWhatsAppOnboarding);
  const completeFn = useServerFn(completeStoreMetaWhatsAppOnboarding);

  const start = useMutation({
    mutationFn: (storeId: string) => startFn({ data: { storeId } }),
  });

  const complete = useMutation({
    mutationFn: (input: {
      storeId: string;
      sessionId: string;
      code: string;
      wabaId: string;
      phoneNumberId: string;
      businessId?: string | null;
    }) => completeFn({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store-growth"] });
    },
  });

  return { start, complete };
}
