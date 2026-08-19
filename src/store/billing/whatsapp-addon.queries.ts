import { useQuery } from "@tanstack/react-query";

import { getWhatsAppAddonProvisioning } from "@/lib/whatsapp-addon.functions";

export function useWhatsAppAddonProvisioning(storeId: string | null) {
  return useQuery({
    queryKey: ["store", storeId, "whatsapp-addon-provisioning"],
    queryFn: () => getWhatsAppAddonProvisioning({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    staleTime: 15_000,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ["paid", "provisioning", "awaiting_customer"].includes(status) ? 5_000 : false;
    },
  });
}
