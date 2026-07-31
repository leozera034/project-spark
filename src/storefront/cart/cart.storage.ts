/**
 * Armazenamento local do carrinho, isolado por slug canônico.
 *
 * localStorage → carrinho da loja atual (conveniência, TTL de 7 dias).
 *
 * Se o Storage estiver bloqueado, corrompido ou cheio, tudo continua
 * funcionando em memória. Nada aqui é fonte de verdade de preço.
 */
import { normalizeSlug } from "@/storefront/customer/customer-wizard.routes";
import { emptyCart, parseCart } from "./cart.validation";
import type { CartDocument } from "./cart.types";

export const CART_KEY_PREFIX = "pediu-aqui:cart:v1:";
const MAX_RAW_BYTES = 64 * 1024;

const memoryCarts = new Map<string, CartDocument>();

function store(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const target = window.localStorage;
    const probe = "pediu-aqui:probe";
    target.setItem(probe, "1");
    target.removeItem(probe);
    return target;
  } catch {
    return null;
  }
}

export function isCartStorageAvailable(): boolean {
  return store() !== null;
}

export function cartKey(slug: string): string | null {
  const canonical = normalizeSlug(slug);
  return canonical ? `${CART_KEY_PREFIX}${canonical}` : null;
}

function readRaw(key: string): unknown | null {
  const target = store();
  if (!target) return null;
  let raw: string | null = null;
  try {
    raw = target.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  if (raw.length > MAX_RAW_BYTES) {
    try {
      target.removeItem(key);
    } catch {
      /* nada a fazer */
    }
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    // Sem prototype pollution: descartamos qualquer chave perigosa.
    const clean: Record<string, unknown> = {};
    for (const [entryKey, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (entryKey === "__proto__" || entryKey === "constructor" || entryKey === "prototype") {
        continue;
      }
      clean[entryKey] = value;
    }
    return clean;
  } catch {
    try {
      target.removeItem(key);
    } catch {
      /* nada a fazer */
    }
    return null;
  }
}

export function readCart(slug: string): CartDocument {
  const key = cartKey(slug);
  if (!key) return emptyCart(slug);
  const stored = parseCart(readRaw(key), normalizeSlug(slug) ?? slug);
  if (stored) return stored;
  const mirrored = memoryCarts.get(key);
  if (mirrored && Date.parse(mirrored.expiresAt) > Date.now()) return mirrored;
  return emptyCart(normalizeSlug(slug) ?? slug);
}

export function writeCart(slug: string, cart: CartDocument): boolean {
  const key = cartKey(slug);
  if (!key) return false;
  const value: CartDocument = { ...cart, updatedAt: new Date().toISOString() };
  memoryCarts.set(key, value);
  const target = store();
  if (!target) return false;
  try {
    target.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Esvazia o carrinho apenas desta loja. */
export function clearCart(slug: string): void {
  const key = cartKey(slug);
  if (!key) return;
  memoryCarts.delete(key);
  try {
    store()?.removeItem(key);
  } catch {
    /* nada a fazer */
  }
}

/** Uso em testes: limpa apenas o espelho em memória. */
export function __resetCartMemoryMirror(): void {
  memoryCarts.clear();
}
