import { useCallback, useEffect, useMemo, useState } from "react";

type PreferenceDocument = {
  schemaVersion: 1;
  slug: string;
  favoriteProductIds: string[];
  recentProductIds: string[];
  updatedAt: string;
};

const STORAGE_PREFIX = "comandiva:storefront-preferences:v1:";
const EVENT_NAME = "comandiva:storefront-preferences";
const MAX_FAVORITES = 40;
const MAX_RECENTS = 12;

const memory = new Map<string, string>();

function keyFor(slug: string) {
  return `${STORAGE_PREFIX}${slug}`;
}

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function safeSet(key: string, value: string) {
  if (typeof window === "undefined") {
    memory.set(key, value);
    return;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
}

function emptyDocument(slug: string): PreferenceDocument {
  return {
    schemaVersion: 1,
    slug,
    favoriteProductIds: [],
    recentProductIds: [],
    updatedAt: new Date(0).toISOString(),
  };
}

function sanitizeIds(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "string") continue;
    const id = candidate.trim();
    if (!id || id.length > 100 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= max) break;
  }
  return ids;
}

function readDocument(slug: string): PreferenceDocument {
  const raw = safeGet(keyFor(slug));
  if (!raw) return emptyDocument(slug);
  try {
    const parsed = JSON.parse(raw) as Partial<PreferenceDocument>;
    if (parsed.schemaVersion !== 1 || parsed.slug !== slug) return emptyDocument(slug);
    return {
      schemaVersion: 1,
      slug,
      favoriteProductIds: sanitizeIds(parsed.favoriteProductIds, MAX_FAVORITES),
      recentProductIds: sanitizeIds(parsed.recentProductIds, MAX_RECENTS),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return emptyDocument(slug);
  }
}

function writeDocument(next: PreferenceDocument) {
  safeSet(keyFor(next.slug), JSON.stringify(next));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { slug: next.slug } }));
  }
}

export function useStorefrontPreferences(slug: string) {
  const [document, setDocument] = useState<PreferenceDocument>(() => emptyDocument(slug));

  useEffect(() => {
    setDocument(readDocument(slug));

    const refresh = (event?: Event) => {
      if (event instanceof CustomEvent && event.detail?.slug && event.detail.slug !== slug) return;
      setDocument(readDocument(slug));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === keyFor(slug)) refresh();
    };

    window.addEventListener(EVENT_NAME, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [slug]);

  const favoriteSet = useMemo(() => new Set(document.favoriteProductIds), [document.favoriteProductIds]);

  const commit = useCallback(
    (updater: (current: PreferenceDocument) => PreferenceDocument) => {
      const next = updater(readDocument(slug));
      writeDocument(next);
      setDocument(next);
    },
    [slug],
  );

  const toggleFavorite = useCallback(
    (productId: string) => {
      commit((current) => {
        const exists = current.favoriteProductIds.includes(productId);
        const favoriteProductIds = exists
          ? current.favoriteProductIds.filter((id) => id !== productId)
          : [productId, ...current.favoriteProductIds.filter((id) => id !== productId)].slice(0, MAX_FAVORITES);
        return { ...current, favoriteProductIds, updatedAt: new Date().toISOString() };
      });
    },
    [commit],
  );

  const rememberViewed = useCallback(
    (productId: string) => {
      commit((current) => ({
        ...current,
        recentProductIds: [productId, ...current.recentProductIds.filter((id) => id !== productId)].slice(0, MAX_RECENTS),
        updatedAt: new Date().toISOString(),
      }));
    },
    [commit],
  );

  return {
    favoriteProductIds: document.favoriteProductIds,
    recentProductIds: document.recentProductIds,
    favoriteCount: document.favoriteProductIds.length,
    isFavorite: (productId: string) => favoriteSet.has(productId),
    toggleFavorite,
    rememberViewed,
  };
}
