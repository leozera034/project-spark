import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  getStoreWhatsAppReadiness,
  listStoreMessageTemplates,
  saveStoreMessageTemplate,
  setCustomerWhatsAppMarketingConsent,
} from "@/lib/store-whatsapp.functions";

export function useStoreWhatsAppReadiness(storeId: string | null) {
  const fn = useServerFn(getStoreWhatsAppReadiness);
  return useQuery({
    queryKey: ["store-growth", storeId, "whatsapp-readiness"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    refetchInterval: 60_000,
  });
}

export function useStoreMessageTemplates(storeId: string | null) {
  const fn = useServerFn(listStoreMessageTemplates);
  return useQuery({
    queryKey: ["store-growth", storeId, "message-templates"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
  });
}

export function useStoreWhatsAppActions() {
  const queryClient = useQueryClient();
  const saveTemplateFn = useServerFn(saveStoreMessageTemplate);
  const setConsentFn = useServerFn(setCustomerWhatsAppMarketingConsent);

  const saveTemplate = useMutation({
    mutationFn: (data: Parameters<typeof saveTemplateFn>[0]["data"]) => saveTemplateFn({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-growth"] }),
  });

  const setConsent = useMutation({
    mutationFn: (data: Parameters<typeof setConsentFn>[0]["data"]) => setConsentFn({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-growth"] }),
  });

  return { saveTemplate, setConsent };
}
