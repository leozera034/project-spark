import { Building2, RefreshCw } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { listMyStores } from "@/store-config/api";
import type { StoreOption } from "@/store-config/types";

import { setSelectedStoreId, useSelectedStoreId } from "./store-scope";

type StoreScopeValue = {
  storeId: string | null;
  selectedStore: StoreOption | null;
  stores: StoreOption[];
  selectionRequired: boolean;
  isLoading: boolean;
  error: Error | null;
  selectStore: (storeId: string) => Promise<void>;
  refreshStores: () => Promise<unknown>;
};

const StoreScopeContext = createContext<StoreScopeValue | null>(null);

function storageKey(userId: string) {
  return `comandiva:selected-store:${userId}`;
}

function readPersistedStore(userId: string | null | undefined): string | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

function persistStore(userId: string | null | undefined, storeId: string | null) {
  if (!userId || typeof window === "undefined") return;
  try {
    if (storeId) window.sessionStorage.setItem(storageKey(userId), storeId);
    else window.sessionStorage.removeItem(storageKey(userId));
  } catch {
    // Seleção de sessão é conveniência de UX; falha de storage nunca altera autorização.
  }
}

export function useStoreScope(): StoreScopeValue {
  const value = useContext(StoreScopeContext);
  if (!value) throw new Error("useStoreScope precisa estar dentro de StoreScopeProvider");
  return value;
}

export function StoreScopeProvider({ children }: { children: ReactNode }) {
  const { authContext, refreshAuthContext } = useAuth();
  const queryClient = useQueryClient();
  const selectedStoreId = useSelectedStoreId();
  const storesQuery = useQuery({
    queryKey: ["store-scope", "stores", authContext?.user_id ?? null],
    queryFn: listMyStores,
    staleTime: 60_000,
    retry: false,
  });

  const stores = storesQuery.data ?? [];
  const persistedStoreId = readPersistedStore(authContext?.user_id);
  const selectedIsValid = Boolean(selectedStoreId && stores.some((store) => store.id === selectedStoreId));
  const persistedIsValid = Boolean(persistedStoreId && stores.some((store) => store.id === persistedStoreId));
  const effectiveStoreId = selectedIsValid
    ? selectedStoreId
    : persistedIsValid
      ? persistedStoreId
      : stores.length === 1
        ? stores[0].id
        : null;
  const selectedStore = stores.find((store) => store.id === effectiveStoreId) ?? null;
  const selectionRequired = !storesQuery.isLoading && stores.length > 1 && !effectiveStoreId;
  const scopeHydrating = Boolean(effectiveStoreId && effectiveStoreId !== selectedStoreId);

  useEffect(() => {
    if (storesQuery.isLoading) return;
    if (effectiveStoreId && effectiveStoreId !== selectedStoreId) {
      setSelectedStoreId(effectiveStoreId);
      persistStore(authContext?.user_id, effectiveStoreId);
      void refreshAuthContext();
      return;
    }
    if (selectedStoreId && !selectedIsValid) {
      setSelectedStoreId(null);
      persistStore(authContext?.user_id, null);
      void refreshAuthContext();
    }
  }, [
    authContext?.user_id,
    effectiveStoreId,
    refreshAuthContext,
    selectedIsValid,
    selectedStoreId,
    storesQuery.isLoading,
  ]);

  const selectStore = useCallback(
    async (storeId: string) => {
      if (!stores.some((store) => store.id === storeId)) return;
      setSelectedStoreId(storeId);
      persistStore(authContext?.user_id, storeId);
      await refreshAuthContext();
      await queryClient.invalidateQueries({ type: "active" });
    },
    [authContext?.user_id, queryClient, refreshAuthContext, stores],
  );

  const refreshStores = useCallback(async () => storesQuery.refetch(), [storesQuery.refetch]);
  const scopeError = storesQuery.error instanceof Error
    ? storesQuery.error
    : storesQuery.error
      ? new Error("STORE_SCOPE_ERROR")
      : null;

  const value = useMemo<StoreScopeValue>(
    () => ({
      storeId: effectiveStoreId,
      selectedStore,
      stores,
      selectionRequired,
      isLoading: storesQuery.isLoading || scopeHydrating,
      error: scopeError,
      selectStore,
      refreshStores,
    }),
    [
      effectiveStoreId,
      selectedStore,
      stores,
      selectionRequired,
      storesQuery.isLoading,
      scopeHydrating,
      scopeError,
      selectStore,
      refreshStores,
    ],
  );

  if (storesQuery.isLoading || scopeHydrating) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4" role="status">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <RefreshCw className="size-4 animate-spin" /> Carregando sua loja…
        </div>
      </div>
    );
  }

  if (storesQuery.error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="panel w-full max-w-md p-6 text-center">
          <Building2 className="mx-auto size-8 text-brand" />
          <h1 className="mt-4 font-display text-xl font-bold">Não foi possível carregar suas lojas</h1>
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma operação foi alterada. Tente carregar novamente.</p>
          <Button className="mt-5" variant="outline" onClick={() => void storesQuery.refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="panel w-full max-w-md p-6 text-center">
          <Building2 className="mx-auto size-8 text-brand" />
          <h1 className="mt-4 font-display text-xl font-bold">Nenhuma loja vinculada</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sua conta não possui uma loja ativa disponível para operar.</p>
        </div>
      </div>
    );
  }

  if (selectionRequired) {
    return (
      <StoreScopeContext.Provider value={value}>
        <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
          <div className="panel w-full max-w-xl p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand-soft-foreground">
                <Building2 className="size-5" />
              </span>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand">Escopo da operação</p>
                <h1 className="font-display text-2xl font-black">Escolha a loja</h1>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Sua conta possui acesso a mais de uma loja. A Comandiva não escolhe uma delas silenciosamente: selecione o contexto antes de consultar ou alterar dados.
            </p>
            <div className="mt-6 grid gap-2">
              {stores.map((store) => (
                <Button
                  key={store.id}
                  variant="outline"
                  className="h-auto justify-start px-4 py-4 text-left"
                  onClick={() => void selectStore(store.id)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{store.name}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">/{store.slug}</span>
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </StoreScopeContext.Provider>
    );
  }

  return (
    <StoreScopeContext.Provider value={value}>
      {children}
      {stores.length > 1 && selectedStore ? (
        <label className="fixed right-3 top-[4.75rem] z-40 flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-xl border border-border bg-background/95 px-3 py-2 shadow-e2 backdrop-blur sm:right-4">
          <Building2 className="size-4 shrink-0 text-brand" aria-hidden="true" />
          <span className="sr-only">Loja em operação</span>
          <select
            aria-label="Loja em operação"
            value={selectedStore.id}
            onChange={(event) => void selectStore(event.target.value)}
            className="max-w-48 bg-transparent text-sm font-bold text-foreground outline-none sm:max-w-64"
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
        </label>
      ) : null}
    </StoreScopeContext.Provider>
  );
}
