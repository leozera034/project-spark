import { ArrowRight, Building2, RefreshCw } from "lucide-react";
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
    // A seleção melhora a experiência, mas nunca participa da autorização.
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
      <div className="flex min-h-dvh items-center justify-center bg-background px-4" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <RefreshCw className="size-4 animate-spin" /> Preparando sua operação…
        </div>
      </div>
    );
  }

  if (storesQuery.error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="panel w-full max-w-md rounded-3xl p-6 text-center sm:p-8" role="alert">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-danger-soft text-danger"><Building2 className="size-6" /></span>
          <h1 className="mt-4 font-display text-xl font-black">Não foi possível carregar suas lojas</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Sua operação não foi alterada. Tente carregar novamente.</p>
          <Button className="mt-5" variant="outline" onClick={() => void storesQuery.refetch()}>
            <RefreshCw className="size-4" /> Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="panel w-full max-w-md rounded-3xl p-6 text-center sm:p-8">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand"><Building2 className="size-6" /></span>
          <h1 className="mt-4 font-display text-xl font-black">Nenhuma loja disponível</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Sua conta ainda não possui uma loja ativa disponível para operar.</p>
        </div>
      </div>
    );
  }

  if (selectionRequired) {
    return (
      <StoreScopeContext.Provider value={value}>
        <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
          <div className="panel w-full max-w-2xl rounded-3xl p-5 sm:p-8">
            <div className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                <Building2 className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand">Suas lojas</p>
                <h1 className="mt-1 font-display text-2xl font-black tracking-tight">Qual operação você quer abrir?</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Você tem acesso a {stores.length} lojas. A unidade escolhida passa a valer para pedidos, cozinha, cardápio, entregas, clientes e relatórios.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {stores.map((store) => (
                <button
                  key={store.id}
                  type="button"
                  className="group flex min-h-24 w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-brand/30 hover:bg-brand-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => void selectStore(store.id)}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Building2 className="size-4.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-foreground">{store.name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">Abrir esta operação</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-brand" />
                </button>
              ))}
            </div>

            <p className="mt-5 text-center text-xs text-muted-foreground">Você poderá trocar de loja a qualquer momento pelo seletor no topo do painel.</p>
          </div>
        </div>
      </StoreScopeContext.Provider>
    );
  }

  return <StoreScopeContext.Provider value={value}>{children}</StoreScopeContext.Provider>;
}
