/**
 * Armazenamento local do checkout, isolado por slug.
 *
 * Guardamos apenas conveniência: a chave de idempotência do envio em curso,
 * o comprovante do último pedido e uma montagem local para “Pedir de novo”.
 * Nenhum preço é fonte de verdade e nenhuma URL assinada de imagem é gravada.
 */
import type { LocalOrderReceipt, LocalReorderDraft } from "./checkout.types";

// Mantidos por compatibilidade com carrinhos/comprovantes já gravados em aparelhos existentes.
const KEY_PREFIX = "pediu-aqui:checkout:v1:";
const RECEIPT_PREFIX = "pediu-aqui:pedido:v1:";
const REORDER_PREFIX = "comandiva:reorder:v1:";
const RECEIPT_TTL_MS = 1000 * 60 * 60 * 24 * 2;
const REORDER_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const memory = new Map<string, string>();

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
}

function safeRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    memory.delete(key);
  }
}

function randomKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `k-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/**
 * A mesma tentativa de envio reutiliza a mesma chave: reenviar após uma queda
 * de rede devolve o pedido já criado em vez de duplicá-lo.
 */
export function currentIdempotencyKey(slug: string): string {
  if (typeof window === "undefined") return randomKey();
  const key = `${KEY_PREFIX}${slug}`;
  const existing = safeGet(key);
  if (existing && existing.length >= 8 && existing.length <= 120) return existing;
  const created = randomKey();
  safeSet(key, created);
  return created;
}

/** Chamada só depois de um pedido confirmado: a próxima jornada começa limpa. */
export function rotateIdempotencyKey(slug: string) {
  if (typeof window === "undefined") return;
  safeRemove(`${KEY_PREFIX}${slug}`);
}

export function saveReceipt(slug: string, receipt: LocalOrderReceipt) {
  if (typeof window === "undefined") return;
  safeSet(`${RECEIPT_PREFIX}${slug}`, JSON.stringify(receipt));
}

export function readReceipt(slug: string): LocalOrderReceipt | null {
  if (typeof window === "undefined") return null;
  const raw = safeGet(`${RECEIPT_PREFIX}${slug}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LocalOrderReceipt;
    if (parsed?.schemaVersion !== 1 || parsed.slug !== slug || !parsed.order?.id) return null;
    if (Date.now() - new Date(parsed.createdAt).getTime() > RECEIPT_TTL_MS) {
      safeRemove(`${RECEIPT_PREFIX}${slug}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveReorderDraft(slug: string, draft: LocalReorderDraft) {
  if (typeof window === "undefined" || draft.lines.length === 0) return;
  safeSet(`${REORDER_PREFIX}${slug}`, JSON.stringify(draft));
}

export function readReorderDraft(slug: string): LocalReorderDraft | null {
  if (typeof window === "undefined") return null;
  const key = `${REORDER_PREFIX}${slug}`;
  const raw = safeGet(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LocalReorderDraft;
    if (
      parsed?.schemaVersion !== 1 ||
      parsed.slug !== slug ||
      !Array.isArray(parsed.lines) ||
      parsed.lines.length === 0 ||
      parsed.lines.length > 40
    ) {
      safeRemove(key);
      return null;
    }
    if (Date.now() - new Date(parsed.createdAt).getTime() > REORDER_TTL_MS) {
      safeRemove(key);
      return null;
    }
    return parsed;
  } catch {
    safeRemove(key);
    return null;
  }
}

export function clearReorderDraft(slug: string) {
  if (typeof window === "undefined") return;
  safeRemove(`${REORDER_PREFIX}${slug}`);
}
