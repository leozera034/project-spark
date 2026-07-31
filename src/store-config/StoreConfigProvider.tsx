import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  fetchOperationalPreview,
  fetchStoreConfiguration,
  listMyStores,
} from "./api";
import { extractCode, toFriendlyMessage } from "./errors";
import type { StoreConfiguration, StoreOperationalPreview, StoreOption } from "./types";

interface StoreConfigValue {
  storeId: string | null;
  setStoreId: (id: string) => void;
  stores: StoreOption[];
  selectionRequired: boolean;
  configuration: StoreConfiguration | null;
  operational: StoreOperationalPreview | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  /** Executa uma RPC de escrita, tratando conflito, auditoria e recarga. */
  save: <T>(fn: () => Promise<T>, successMessage: string) => Promise<boolean>;
  isSaving: boolean;
}

const StoreConfigContext = createContext<StoreConfigValue | null>(null);

export function useStoreConfig(): StoreConfigValue {
  const value = useContext(StoreConfigContext);
  if (!value) throw new Error("useStoreConfig precisa estar dentro de StoreConfigProvider");
  return value;
}

export function StoreConfigProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState<string | null>(null);

  const storesQuery = useQuery({
    queryKey: ["store-config", "stores"],
    queryFn: listMyStores,
    staleTime: 60_000,
  });

  const stores = storesQuery.data ?? [];
  const effectiveStoreId = storeId ?? (stores.length === 1 ? stores[0].id : null);
  const selectionRequired = storeId === null && stores.length > 1;

  const configQuery = useQuery({
    queryKey: ["store-config", "configuration", effectiveStoreId],
    queryFn: () => fetchStoreConfiguration(effectiveStoreId),
    enabled: !selectionRequired && (stores.length > 0 || storesQuery.isLoading === false),
    retry: false,
  });

  const operationalQuery = useQuery({
    queryKey: ["store-config", "operational", effectiveStoreId],
    queryFn: () => fetchOperationalPreview(effectiveStoreId),
    enabled: !selectionRequired && Boolean(configQuery.data),
    refetchInterval: 60_000,
    retry: false,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["store-config"] });
  }, [queryClient]);

  const mutation = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
  });

  const save = useCallback<StoreConfigValue["save"]>(
    async (fn, successMessage) => {
      try {
        await mutation.mutateAsync(fn as () => Promise<unknown>);
        refresh();
        toast.success(successMessage);
        return true;
      } catch (error) {
        const code = extractCode(error);
        if (code === "VERSION_CONFLICT" || code === "STORE_SELECTION_REQUIRED") refresh();
        toast.error(toFriendlyMessage(error));
        return false;
      }
    },
    [mutation, refresh],
  );

  const value = useMemo<StoreConfigValue>(
    () => ({
      storeId: effectiveStoreId,
      setStoreId,
      stores,
      selectionRequired,
      configuration: (configQuery.data as StoreConfiguration | undefined) ?? null,
      operational: (operationalQuery.data as StoreOperationalPreview | undefined) ?? null,
      isLoading: storesQuery.isLoading || (!selectionRequired && configQuery.isLoading),
      error: configQuery.error ? toFriendlyMessage(configQuery.error) : null,
      refresh,
      save,
      isSaving: mutation.isPending,
    }),
    [
      effectiveStoreId,
      stores,
      selectionRequired,
      configQuery.data,
      configQuery.isLoading,
      configQuery.error,
      operationalQuery.data,
      storesQuery.isLoading,
      refresh,
      save,
      mutation.isPending,
    ],
  );

  return <StoreConfigContext.Provider value={value}>{children}</StoreConfigContext.Provider>;
}
