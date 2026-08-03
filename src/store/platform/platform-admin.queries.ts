import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getPlatformHealth, 
  listPlatformStores, 
  adminSuspendStore, 
  adminReactivateStore 
} from "@/lib/platform-admin.functions";

export function usePlatformHealth() {
  const fetchHealth = useServerFn(getPlatformHealth);
  return useQuery({
    queryKey: ['platform', 'health'],
    queryFn: () => fetchHealth({ data: undefined }),
    refetchInterval: 60000, // 1 minute
  });
}

export function usePlatformStores(filters: { search?: string; status?: string; limit?: number; offset?: number } = {}) {
  const fetchStores = useServerFn(listPlatformStores);
  return useQuery({
    queryKey: ['platform', 'stores', filters],
    queryFn: () => fetchStores({ data: filters }),
  });
}

export function useAdminActions() {
  const queryClient = useQueryClient();
  const suspendFn = useServerFn(adminSuspendStore);
  const reactivateFn = useServerFn(adminReactivateStore);

  const suspend = useMutation({
    mutationFn: (vars: { storeId: string; reason: string }) => suspendFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform'] });
    },
  });

  const reactivate = useMutation({
    mutationFn: (vars: { storeId: string }) => reactivateFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform'] });
    },
  });

  return {
    suspend,
    reactivate,
    isLoading: suspend.isPending || reactivate.isPending
  };
}
