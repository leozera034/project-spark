/**
 * Caminho de retorno interno. Nunca aceita URL absoluta, outro domínio,
 * `javascript:` ou outra loja.
 */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function normalizeSlug(raw: string): string | null {
  const slug = String(raw ?? "")
    .trim()
    .toLowerCase();
  return SLUG_RE.test(slug) ? slug : null;
}

/**
 * Aceita apenas caminhos internos da mesma loja, como
 * `/loja/minha-loja?produto=<uuid>`.
 */
export function sanitizeReturnPath(raw: unknown, slug: string): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (value.length === 0 || value.length > 300) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (/[\u0000-\u001f]/.test(value)) return null;
  if (/^\/*[a-z][a-z0-9+.-]*:/i.test(value)) return null;

  const canonical = normalizeSlug(slug);
  if (!canonical) return null;
  const prefix = `/loja/${canonical}`;
  if (value !== prefix && !value.startsWith(`${prefix}?`) && !value.startsWith(`${prefix}/`)) {
    return null;
  }
  return value;
}

export function storefrontPath(slug: string, productId?: string | null): string {
  const canonical = normalizeSlug(slug) ?? "";
  return productId ? `/loja/${canonical}?produto=${productId}` : `/loja/${canonical}`;
}
