import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  getStoreWhatsAppReadiness,
  listStoreMessageTemplates,
  saveStoreMessageTemplate,
  setCustomerWhatsAppMarketingConsent,
  submitStoreMessageTemplateToMeta,
  syncStoreMetaWhatsAppTemplates,
} from "@/lib/store-whatsapp.functions";

type TemplateInput = {
  storeId: string;
  id?: string | null;
  code: string;
  name: string;
  purpose: "transactional" | "marketing";
  body: string;
  providerLanguage?: string;
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
    refetchInterval: 60_000,
  });
}

export function useStoreWhatsAppActions() {
  const queryClient = useQueryClient();
  const saveTemplateFn = useServerFn(saveStoreMessageTemplate);
  const submitTemplateFn = useServerFn(submitStoreMessageTemplateToMeta);
  const syncTemplatesFn = useServerFn(syncStoreMetaWhatsAppTemplates);
  const setConsentFn = useServerFn(setCustomerWhatsAppMarketingConsent);

  const invalidateGrowth = () => queryClient.invalidateQueries({ queryKey: ["store-growth"] });

  const saveTemplate = useMutation({
    mutationFn: (data: TemplateInput) =>
      saveTemplateFn({
        data: {
          ...data,
          providerLanguage: data.providerLanguage ?? "pt_BR",
          isActive: data.isActive ?? true,
        },
      }),
    onSuccess: invalidateGrowth,
  });

  const submitTemplate = useMutation({
    mutationFn: (data: { storeId: string; templateId: string }) => submitTemplateFn({ data }),
    onSuccess: invalidateGrowth,
  });

  const syncTemplates = useMutation({
    mutationFn: (data: { storeId: string }) => syncTemplatesFn({ data }),
    onSuccess: invalidateGrowth,
  });

  const setConsent = useMutation({
    mutationFn: (data: ConsentInput) =>
      setConsentFn({ data: { ...data, source: data.source ?? "manual" } }),
    onSuccess: invalidateGrowth,
  });

  return { saveTemplate, submitTemplate, syncTemplates, setConsent };
}
