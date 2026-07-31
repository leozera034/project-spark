/**
 * Slug público da loja — implementação canônica compartilhada.
 *
 * A mesma normalização existe no banco (`public.normalize_store_slug`) e a lista
 * de termos reservados espelha `private.reserved_slugs()`. O servidor é sempre
 * a autoridade final; isto aqui existe apenas para dar retorno imediato ao lojista.
 */

export const RESERVED_STORE_SLUGS = [
  "admin",
  "app",
  "api",
  "auth",
  "entrar",
  "login",
  "logout",
  "preview",
  "design-system",
  "suporte",
  "ajuda",
  "assets",
  "brand",
  "public",
  "loja",
  "entregador",
  "configuracoes",
  "sobre",
  "contato",
  "termos",
  "privacidade",
  "status",
  "static",
  "www",
  "cdn",
  "root",
] as const;

export const STORE_SLUG_MIN_LENGTH = 3;
export const STORE_SLUG_MAX_LENGTH = 60;

export function normalizeStoreSlug(value: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type StoreSlugIssue = "formato" | "curto" | "longo" | "reservado";

export interface StoreSlugValidation {
  slug: string;
  valid: boolean;
  issue: StoreSlugIssue | null;
}

export function validateStoreSlug(value: string): StoreSlugValidation {
  const slug = normalizeStoreSlug(value);

  if (slug.length === 0) return { slug, valid: false, issue: "formato" };
  if (slug.length < STORE_SLUG_MIN_LENGTH) return { slug, valid: false, issue: "curto" };
  if (slug.length > STORE_SLUG_MAX_LENGTH) return { slug, valid: false, issue: "longo" };
  if ((RESERVED_STORE_SLUGS as readonly string[]).includes(slug)) {
    return { slug, valid: false, issue: "reservado" };
  }
  return { slug, valid: true, issue: null };
}

export const STORE_SLUG_ISSUE_MESSAGES: Record<StoreSlugIssue, string> = {
  formato: "Use apenas letras, números e hífens.",
  curto: `Use pelo menos ${STORE_SLUG_MIN_LENGTH} caracteres.`,
  longo: `Use no máximo ${STORE_SLUG_MAX_LENGTH} caracteres.`,
  reservado: "Este endereço é reservado pelo sistema.",
};
