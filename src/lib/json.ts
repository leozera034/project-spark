/**
 * Valores JSON serializáveis com segurança entre servidor e navegador.
 * Usado em contratos de dados para evitar campos opacos que não atravessam
 * a fronteira de serialização.
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

/** Normaliza um valor desconhecido em objeto JSON serializável. */
export function toJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonObject;
}
