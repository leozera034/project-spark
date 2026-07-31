/**
 * Identificador de acesso do entregador.
 *
 * Regras (D-031 / D-032):
 * - minúsculas, sem acentos, sem espaços;
 * - caracteres permitidos: a-z, 0-9, ponto, hífen e sublinhado;
 * - tamanho entre 4 e 48;
 * - não inicia nem termina com separador;
 * - separadores consecutivos são normalizados.
 *
 * O e-mail sintético é derivado deterministicamente do identificador
 * normalizado. Ele existe apenas porque o provedor de autenticação exige um
 * endereço; nunca é exibido, enviado ou usado em recuperação.
 */

export const COURIER_SYNTHETIC_EMAIL_DOMAIN = "courier.pediuaqui.internal";

export const COURIER_IDENTIFIER_MIN_LENGTH = 4;
export const COURIER_IDENTIFIER_MAX_LENGTH = 48;

const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._-]{2,46}[a-z0-9]$/;

/** Normaliza o identificador informado pelo usuário. */
export function normalizeCourierIdentifier(raw: string): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/([._-])\1+/g, "$1")
    .replace(/^[._-]+/, "")
    .replace(/[._-]+$/, "");
}

export type CourierIdentifierValidation =
  | { valid: true; value: string }
  | { valid: false; reason: "too_short" | "too_long" | "invalid_format" };

/** Valida o identificador já normalizado. */
export function validateCourierIdentifier(raw: string): CourierIdentifierValidation {
  const value = normalizeCourierIdentifier(raw);
  if (value.length < COURIER_IDENTIFIER_MIN_LENGTH) return { valid: false, reason: "too_short" };
  if (value.length > COURIER_IDENTIFIER_MAX_LENGTH) return { valid: false, reason: "too_long" };
  if (!IDENTIFIER_PATTERN.test(value)) return { valid: false, reason: "invalid_format" };
  return { valid: true, value };
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Converte o identificador em e-mail sintético determinístico.
 * O mesmo identificador normalizado sempre produz o mesmo endereço, tanto no
 * navegador quanto no script de provisionamento.
 */
export async function courierIdentifierToSyntheticEmail(raw: string): Promise<string> {
  const validation = validateCourierIdentifier(raw);
  if (!validation.valid) {
    throw new Error("identificador_invalido");
  }
  const bytes = new TextEncoder().encode(`pediu-aqui:courier:${validation.value}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `${toHex(digest).slice(0, 32)}@${COURIER_SYNTHETIC_EMAIL_DOMAIN}`;
}
