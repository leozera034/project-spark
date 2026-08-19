import { createContext, useCallback, useContext, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useStoreScope } from "@/store-scope/StoreScopeProvider";

import { fetchOperationalPreview, fetchStoreConfiguration } from "./api";
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
  const scope = useStoreScope();
  const effectiveStoreId = scope.storeId;
  const enabled = Boolean(effectiveStoreId) && !scope.selectionRequired && !scope.isLoading;

  const configQuery = useQuery({
    queryKey: ["store-config", "configuration", effectiveStoreId],
    queryFn: () => fetchStoreConfiguration(effectiveStoreId),
    enabled,
    retry: false,
  });

  const operationalQuery = useQuery({
    queryKey: ["store-config", "operational", effectiveStoreId],
    queryFn: () => fetchOperationalPreview(effectiveStoreId),
    enabled: enabled && Boolean(configQuery.data),
    refetchInterval: 60_000,
    retry: false,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["store-config"] });
  }, [queryClient]);

  const mutation = useMutation({ mutationFn: async (fn: () => Promise<unknown>) => fn() });

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
      setStoreId: (id) => void scope.selectStore(id),
      stores: scope.stores,
      selectionRequired: scope.selectionRequired,
      configuration: (configQuery.data as StoreConfiguration | undefined) ?? null,
      operational: (operationalQuery.data as StoreOperationalPreview | undefined) ?? null,
      isLoading: scope.isLoading || (enabled && configQuery.isLoading),
      error: scope.error ? scope.error.message : configQuery.error ? toFriendlyMessage(configQuery.error) : null,
      refresh,
      save,
      isSaving: mutation.isPending,
    }),
    [
      effectiveStoreId,
      scope,
      configQuery.data,
      configQuery.isLoading,
      configQuery.error,
      operationalQuery.data,
      enabled,
      refresh,
      save,
      mutation.isPending,
    ],
  );

  return <StoreConfigContext.Provider value={value}>{children}</StoreConfigContext.Provider>;
}
