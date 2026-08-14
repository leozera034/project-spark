import { createServerFn } from "@tanstack/react-start";

/** Endereço público atual do Pediu Aqui no Lovable. */
export const PUBLIC_SITE_ORIGIN = "https://shark-cardapio.lovable.app";

/** Imagens oficiais de compartilhamento social. */
export const OG_IMAGE_PATH = "/brand/og-image-1200x630.png";
export const TWITTER_IMAGE_PATH = "/brand/twitter-card-1200x600.png";
export const SOCIAL_IMAGE_ALT = "Pediu Aqui — cardápio digital, pedidos, cozinha e entregas";

/**
 * Origem pública da requisição atual (ex.: https://meu-dominio.com).
 * Redes sociais exigem URLs absolutas em og:image — derivamos do request
 * para funcionar em preview, domínio próprio e publicação.
 */
export const getSiteOrigin = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getRequestUrl } = await import("@tanstack/react-start/server");
    return getRequestUrl({ xForwardedHost: true, xForwardedProto: true }).origin;
  } catch {
    return PUBLIC_SITE_ORIGIN;
  }
});

/** URL canônica da requisição sem query string ou hash. */
export const getCanonicalUrl = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getRequestUrl } = await import("@tanstack/react-start/server");
    const url = getRequestUrl({ xForwardedHost: true, xForwardedProto: true });
    return `${url.origin}${url.pathname}`;
  } catch {
    return `${PUBLIC_SITE_ORIGIN}/`;
  }
});

/** Monta URL absoluta sem corromper URLs externas já completas. */
export function absoluteUrl(origin: string | undefined | null, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const safeOrigin = (origin || PUBLIC_SITE_ORIGIN).replace(/\/$/, "");
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return `${safeOrigin}${safePath}`;
}

export function publicUrl(path = "/") {
  return absoluteUrl(PUBLIC_SITE_ORIGIN, path);
}
