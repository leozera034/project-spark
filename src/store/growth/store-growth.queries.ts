import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  getStoreGrowthSummary,
  getStoreRevenueSeries,
  listStoreAutomationRules,
  listStoreCustomerInsights,
  listStoreMarketingCampaigns,
  saveStoreAutomationRule,
  saveStoreMarketingCampaign,
  type GrowthSegment,
} from "@/lib/store-growth.functions";

export function useStoreGrowthSummary(storeId: string | null) {
  const fn = useServerFn(getStoreGrowthSummary);
  return useQuery({
    queryKey: ["store-growth", storeId, "summary"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    refetchInterval: 60000,
  });
}

export function useStoreCustomerInsights(
  storeId: string | null,
  filters: { search?: string; segment?: GrowthSegment } = {},
) {
  const fn = useServerFn(listStoreCustomerInsights);
  return useQuery({
    queryKey: ["store-growth", storeId, "customers", filters],
    queryFn: () => fn({ data: { storeId: storeId!, ...filters, limit: 100, offset: 0 } }),
    enabled: Boolean(storeId),
  });
}

export function useStoreRevenueSeries(storeId: string | null, days = 30) {
  const fn = useServerFn(getStoreRevenueSeries);
  return useQuery({
    queryKey: ["store-growth", storeId, "revenue", days],
    queryFn: () => fn({ data: { storeId: storeId!, days } }),
    enabled: Boolean(storeId),
  });
}

export function useStoreMarketingCampaigns(storeId: string | null) {
  const fn = useServerFn(listStoreMarketingCampaigns);
  return useQuery({
    queryKey: ["store-growth", storeId, "campaigns"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
  });
}

export function useStoreAutomationRules(storeId: string | null) {
  const fn = useServerFn(listStoreAutomationRules);
  return useQuery({
    queryKey: ["store-growth", storeId, "automations"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
  });
}

export function useStoreGrowthActions() {
  const queryClient = useQueryClient();
  const saveCampaignFn = useServerFn(saveStoreMarketingCampaign);
  const saveRuleFn = useServerFn(saveStoreAutomationRule);

  const saveCampaign = useMutation({
    mutationFn: (data: Parameters<typeof saveStoreMarketingCampaign>[0] extends never ? never : {
      storeId: string;
      id?: string | null;
      name: string;
      audience: "todos" | GrowthSegment;
      message: string;
      status: "rascunho" | "pronta" | "arquivada";
    }) => saveCampaignFn({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-growth"] }),
  });

  const saveRule = useMutation({
    mutationFn: (data: {
      storeId: string;
      id?: string | null;
      eventCode: "novo_cliente" | "pedido_concluido" | "cliente_inativo_30d" | "cliente_vip";
      name: string;
      enabled: boolean;
      config?: Record<string, unknown>;
    }) => saveRuleFn({ data: { ...data, config: data.config ?? {} } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-growth"] }),
  });

  return { saveCampaign, saveRule };
}
