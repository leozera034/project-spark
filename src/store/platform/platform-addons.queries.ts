import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  listPlatformAddonOffers,
  updatePlatformAddonCatalog,
  upsertPlatformAddonPrice,
  type AddonAvailability,
  type AddonBillingInterval,
} from "@/lib/platform-addons.functions";

export function usePlatformAddonOffers() {
  const fn = useServerFn(listPlatformAddonOffers);
  return useQuery({
    queryKey: ["platform", "addons"],
    queryFn: () => fn({ data: undefined }),
    staleTime: 15_000,
  });
}

export function usePlatformAddonPricingActions() {
  const queryClient = useQueryClient();
  const updateCatalogFn = useServerFn(updatePlatformAddonCatalog);
  const upsertPriceFn = useServerFn(upsertPlatformAddonPrice);

  const updateCatalog = useMutation({
    mutationFn: (data: { addonId: string; availabilityStatus: AddonAvailability; isActive: boolean }) =>
      updateCatalogFn({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "addons"] }),
  });

  const upsertPrice = useMutation({
    mutationFn: (data: {
      addonId: string;
      billingInterval: AddonBillingInterval;
      amountCents: number;
      trialDays: number;
      meteringMetricCode?: string | null;
      includedUnits?: number | null;
      hardLimitUnits?: number | null;
      overageUnitAmountMicros?: number | null;
      isActive: boolean;
    }) => upsertPriceFn({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "addons"] }),
  });

  return { updateCatalog, upsertPrice };
}
