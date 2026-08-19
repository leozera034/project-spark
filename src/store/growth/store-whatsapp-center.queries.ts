import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  getStoreWhatsAppConsentSummary,
  getStoreWhatsAppUsage,
  listStoreWhatsAppConsents,
  listStoreWhatsAppMessageHistory,
} from "@/lib/store-whatsapp-center.functions";

export function useStoreWhatsAppConsentSummary(storeId: string | null) {
  const fn = useServerFn(getStoreWhatsAppConsentSummary);
  return useQuery({
    queryKey: ["store-growth", storeId, "whatsapp-consent-summary"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
  });
}

export function useStoreWhatsAppConsents(storeId: string | null, limit = 20) {
  const fn = useServerFn(listStoreWhatsAppConsents);
  return useQuery({
    queryKey: ["store-growth", storeId, "whatsapp-consents", limit],
    queryFn: () => fn({ data: { storeId: storeId!, limit } }),
    enabled: Boolean(storeId),
  });
}

export function useStoreWhatsAppMessageHistory(storeId: string | null, limit = 50) {
  const fn = useServerFn(listStoreWhatsAppMessageHistory);
  return useQuery({
    queryKey: ["store-growth", storeId, "whatsapp-history", limit],
    queryFn: () => fn({ data: { storeId: storeId!, limit } }),
    enabled: Boolean(storeId),
    refetchInterval: 30_000,
  });
}

export function useStoreWhatsAppUsage(storeId: string | null) {
  const fn = useServerFn(getStoreWhatsAppUsage);
  return useQuery({
    queryKey: ["store-growth", storeId, "whatsapp-usage"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    refetchInterval: 60_000,
  });
}
