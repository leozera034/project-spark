import { createServerFn } from "@tanstack/react-start";

/** Caminho da imagem padrão de compartilhamento (1200x630). */
export const OG_IMAGE_PATH = "/brand/og-image-1200x630.png";

/**
 * Origem pública da requisição atual (ex.: https://meu-dominio.com).
 * Redes sociais exigem URLs absolutas em og:image — derivamos do request
 * para funcionar em preview, domínio próprio e publicação.
 * Retorna string vazia durante prerender, quando não há requisição.
 */
export const getSiteOrigin = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getRequestUrl } = await import("@tanstack/react-start/server");
    return getRequestUrl({ xForwardedHost: true, xForwardedProto: true }).origin;
  } catch {
    return "";
  }
});

/** Monta uma URL absoluta quando a origem é conhecida; senão devolve o caminho relativo. */
export function absoluteUrl(origin: string | undefined | null, path: string) {
  if (!origin) return path;
  return `${origin.replace(/\/$/, "")}${path}`;
}
