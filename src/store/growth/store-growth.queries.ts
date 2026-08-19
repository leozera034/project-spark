import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  getStoreAutomationBuilderCatalog,
  getStoreGrowthSummary,
  getStoreRevenueSeries,
  listStoreAutomationRules,
  listStoreCustomerInsights,
  listStoreMarketingCampaigns,
  saveStoreAutomationRule,
  saveStoreMarketingCampaign,
  type AutomationEventCode,
  type GrowthSegment,
} from "@/lib/store-growth.functions";

type CampaignInput = {
  storeId: string;
  id?: string | null;
  name: string;
  audience: "todos" | GrowthSegment;
  message: string;
  status: "rascunho" | "pronta" | "arquivada";
};

type AutomationInput = {
  storeId: string;
  id?: string | null;
  eventCode: AutomationEventCode;
  name: string;
  enabled: boolean;
  config?: Record<string, unknown>;
};

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

export function useStoreAutomationBuilderCatalog(storeId: string | null) {
  const fn = useServerFn(getStoreAutomationBuilderCatalog);
  return useQuery({
    queryKey: ["store-growth", storeId, "automation-builder-catalog"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    staleTime: 30000,
  });
}

export function useStoreGrowthActions() {
  const queryClient = useQueryClient();
  const saveCampaignFn = useServerFn(saveStoreMarketingCampaign);
  const saveRuleFn = useServerFn(saveStoreAutomationRule);

  const saveCampaign = useMutation({
    mutationFn: (data: CampaignInput) => saveCampaignFn({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-growth"] }),
  });

  const saveRule = useMutation({
    mutationFn: (data: AutomationInput) => saveRuleFn({ data: { ...data, config: data.config ?? {} } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-growth"] }),
  });

  return { saveCampaign, saveRule };
}
