import { useSyncExternalStore } from "react";

let selectedStoreId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getSelectedStoreId(): string | null {
  return selectedStoreId;
}

export function setSelectedStoreId(storeId: string | null) {
  if (selectedStoreId === storeId) return;
  selectedStoreId = storeId;
  emit();
}

export function subscribeSelectedStore(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSelectedStoreId(): string | null {
  return useSyncExternalStore(subscribeSelectedStore, getSelectedStoreId, () => null);
}

export function prioritizeStoreIds(storeIds: string[]): string[] {
  const selected = getSelectedStoreId();
  if (!selected || !storeIds.includes(selected)) return storeIds;
  return [selected, ...storeIds.filter((id) => id !== selected)];
}
