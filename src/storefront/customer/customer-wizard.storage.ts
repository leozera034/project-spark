/**
 * Armazenamento local do cliente, isolado por slug canônico.
 *
 * localStorage  → nome, preferência, endereços salvos (conveniência).
 * sessionStorage → etapa, rascunho, confirmação da jornada atual.
 *
 * Se o Storage estiver bloqueado, corrompido ou cheio, tudo continua
 * funcionando em memória. Nada aqui é considerado fonte de verdade.
 */
import { normalizeSlug } from "./customer-wizard.routes";
import {
  emptyProfile,
  emptySession,
  parseProfile,
  parseSession,
} from "./customer-wizard.validation";
import type { CustomerLocalProfile, CustomerSessionContext } from "./customer-wizard.types";

export const PROFILE_KEY_PREFIX = "pediu-aqui:customer:v1:";
export const SESSION_KEY_PREFIX = "pediu-aqui:session:v1:";
const MAX_RAW_BYTES = 32 * 1024;

const memoryProfiles = new Map<string, CustomerLocalProfile>();
const memorySessions = new Map<string, CustomerSessionContext>();

export type StorageKind = "local" | "session";

function store(kind: StorageKind): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const target = kind === "local" ? window.localStorage : window.sessionStorage;
    const probe = "pediu-aqui:probe";
    target.setItem(probe, "1");
    target.removeItem(probe);
    return target;
  } catch {
    return null;
  }
}

export function isStorageAvailable(): boolean {
  return store("local") !== null && store("session") !== null;
}

export function profileKey(slug: string): string | null {
  const canonical = normalizeSlug(slug);
  return canonical ? `${PROFILE_KEY_PREFIX}${canonical}` : null;
}

export function sessionKey(slug: string): string | null {
  const canonical = normalizeSlug(slug);
  return canonical ? `${SESSION_KEY_PREFIX}${canonical}` : null;
}

function readRaw(kind: StorageKind, key: string): unknown | null {
  const target = store(kind);
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
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
      clean[key] = value;
    }
    return clean;
  } catch {
    // JSON corrompido: remove somente a chave afetada.
    try {
      target.removeItem(key);
    } catch {
      /* nada a fazer */
    }
    return null;
  }
}

function writeRaw(kind: StorageKind, key: string, value: unknown): boolean {
  const target = store(kind);
  if (!target) return false;
  try {
    target.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readProfile(slug: string): CustomerLocalProfile {
  const key = profileKey(slug);
  if (!key) return emptyProfile();
  const stored = parseProfile(readRaw("local", key));
  if (stored) return stored;
  return memoryProfiles.get(key) ?? emptyProfile();
}

export function writeProfile(slug: string, profile: CustomerLocalProfile): boolean {
  const key = profileKey(slug);
  if (!key) return false;
  const value: CustomerLocalProfile = { ...profile, updatedAt: new Date().toISOString() };
  memoryProfiles.set(key, value);
  return writeRaw("local", key, value);
}

export function readSession(slug: string): CustomerSessionContext {
  const key = sessionKey(slug);
  if (!key) return emptySession();
  const stored = parseSession(readRaw("session", key));
  if (stored) return stored;
  return memorySessions.get(key) ?? emptySession();
}

export function writeSession(slug: string, session: CustomerSessionContext): boolean {
  const key = sessionKey(slug);
  if (!key) return false;
  const value: CustomerSessionContext = { ...session, updatedAt: new Date().toISOString() };
  memorySessions.set(key, value);
  return writeRaw("session", key, value);
}

/** "Esquecer meus dados neste aparelho" — apenas desta loja. */
export function forgetStore(slug: string): void {
  const pKey = profileKey(slug);
  const sKey = sessionKey(slug);
  if (pKey) {
    memoryProfiles.delete(pKey);
    try {
      store("local")?.removeItem(pKey);
    } catch {
      /* nada a fazer */
    }
  }
  if (sKey) {
    memorySessions.delete(sKey);
    try {
      store("session")?.removeItem(sKey);
    } catch {
      /* nada a fazer */
    }
  }
}

/** Uso em testes: limpa apenas o espelho em memória. */
export function __resetMemoryMirror(): void {
  memoryProfiles.clear();
  memorySessions.clear();
}
