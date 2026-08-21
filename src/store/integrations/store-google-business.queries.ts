import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  disconnectStoreGoogleBusinessConnection,
  getStoreGoogleBusinessConnection,
  startStoreGoogleBusinessConnection,
} from "@/lib/store-google-business.functions";

export function useStoreGoogleBusinessConnection(storeId: string | null | undefined) {
  const fn = useServerFn(getStoreGoogleBusinessConnection);
  return useQuery({
    queryKey: ["store", storeId, "google-business-connection"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useStoreGoogleBusinessActions() {
  const queryClient = useQueryClient();
  const startFn = useServerFn(startStoreGoogleBusinessConnection);
  const disconnectFn = useServerFn(disconnectStoreGoogleBusinessConnection);

  const invalidate = async (storeId: string) => {
    await queryClient.invalidateQueries({ queryKey: ["store", storeId, "google-business-connection"] });
  };

  const start = useMutation({
    mutationFn: (storeId: string) => startFn({ data: { storeId } }),
  });

  const disconnect = useMutation({
    mutationFn: (storeId: string) => disconnectFn({ data: { storeId } }),
    onSuccess: async (_result, storeId) => invalidate(storeId),
  });

  return { start, disconnect, invalidate };
}
