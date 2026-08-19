import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  getStoreWhatsAppReadiness,
  listStoreMessageTemplates,
  saveStoreMessageTemplate,
  setCustomerWhatsAppMarketingConsent,
} from "@/lib/store-whatsapp.functions";

type TemplateInput = {
  storeId: string;
  id?: string | null;
  code: string;
  name: string;
  purpose: "transactional" | "marketing";
  body: string;
  providerTemplateName?: string | null;
  providerLanguage?: string;
  providerStatus?: "draft" | "pending" | "approved" | "rejected";
  isActive?: boolean;
};

type ConsentInput = {
  storeId: string;
  customerId: string;
  optedIn: boolean;
  source?: string;
};

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
    mutationFn: (data: TemplateInput) =>
      saveTemplateFn({
        data: {
          ...data,
          providerLanguage: data.providerLanguage ?? "pt_BR",
          providerStatus: data.providerStatus ?? "draft",
          isActive: data.isActive ?? true,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-growth"] }),
  });

  const setConsent = useMutation({
    mutationFn: (data: ConsentInput) =>
      setConsentFn({ data: { ...data, source: data.source ?? "manual" } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-growth"] }),
  });

  return { saveTemplate, setConsent };
}
