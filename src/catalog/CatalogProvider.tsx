import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useStoreScope } from "@/store-scope/StoreScopeProvider";
import type { StoreOption } from "@/store-config/types";

import { catalogErrorMessage, fetchCatalogOverview, listCategories } from "./api";
import type { CatalogCategory, CatalogOverview } from "./types";

interface CatalogValue {
  storeId: string | null;
  stores: StoreOption[];
  selectionRequired: boolean;
  setStoreId: (id: string) => void;
  overview: CatalogOverview | null;
  categories: CatalogCategory[];
  activeCategories: CatalogCategory[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  /** Executa uma operação de escrita com tratamento de erro, conflito e recarga. */
  run: <T>(fn: () => Promise<T>, successMessage: string) => Promise<T | null>;
  pendingKey: string | null;
  setPendingKey: (key: string | null) => void;
  isBusy: boolean;
}

const CatalogContext = createContext<CatalogValue | null>(null);

export function useCatalog(): CatalogValue {
  const value = useContext(CatalogContext);
  if (!value) throw new Error("useCatalog precisa estar dentro de CatalogProvider");
  return value;
}

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const scope = useStoreScope();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const effectiveStoreId = scope.storeId;
  const enabled = Boolean(effectiveStoreId) && !scope.selectionRequired && !scope.isLoading;

  const overviewQuery = useQuery({
    queryKey: ["catalog", "overview", effectiveStoreId],
    queryFn: () => fetchCatalogOverview(effectiveStoreId),
    enabled,
    retry: false,
  });

  const categoriesQuery = useQuery({
    queryKey: ["catalog", "categories", effectiveStoreId],
    queryFn: () => listCategories(effectiveStoreId, true),
    enabled,
    retry: false,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["catalog"] });
  }, [queryClient]);

  const mutation = useMutation({ mutationFn: async (fn: () => Promise<unknown>) => fn() });

  const run = useCallback<CatalogValue["run"]>(
    async (fn, successMessage) => {
      try {
        const result = await mutation.mutateAsync(fn as () => Promise<unknown>);
        refresh();
        toast.success(successMessage);
        return result as never;
      } catch (error) {
        refresh();
        toast.error(catalogErrorMessage(error));
        return null;
      } finally {
        setPendingKey(null);
      }
    },
    [mutation, refresh],
  );

  const categories = categoriesQuery.data ?? [];

  const value = useMemo<CatalogValue>(
    () => ({
      storeId: effectiveStoreId,
      stores: scope.stores,
      selectionRequired: scope.selectionRequired,
      setStoreId: (id) => {
        void scope.selectStore(id);
      },
      overview: overviewQuery.data ?? null,
      categories,
      activeCategories: categories.filter((c) => !c.is_archived),
      isLoading: scope.isLoading || (enabled && (overviewQuery.isLoading || categoriesQuery.isLoading)),
      error: scope.error
        ? scope.error.message
        : overviewQuery.error
          ? catalogErrorMessage(overviewQuery.error)
          : categoriesQuery.error
            ? catalogErrorMessage(categoriesQuery.error)
            : null,
      refresh,
      run,
      pendingKey,
      setPendingKey,
      isBusy: mutation.isPending,
    }),
    [
      effectiveStoreId,
      scope.stores,
      scope.selectionRequired,
      scope.selectStore,
      scope.isLoading,
      scope.error,
      overviewQuery.data,
      overviewQuery.isLoading,
      overviewQuery.error,
      categories,
      categoriesQuery.isLoading,
      categoriesQuery.error,
      enabled,
      refresh,
      run,
      pendingKey,
      mutation.isPending,
    ],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}
