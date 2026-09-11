import type { PriceInput } from "@/lib/storefront.server";
import {
  computePublicPriceFromBrowser,
  loadPublicProductFromBrowser,
  PublicStorefrontClientError,
} from "./public-edge.client";

const PRODUCT_PATH = /^\/api\/public\/storefront\/([^/]+)\/produtos\/([^/]+)$/;
const PRICE_PATH = /^\/api\/public\/storefront\/([^/]+)\/preco$/;

let installed = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function publicErrorResponse(error: unknown) {
  if (error instanceof PublicStorefrontClientError) {
    return json({ error: error.code }, error.code === "not_found" ? 404 : 503);
  }
  console.error("[storefront] browser public API bridge failed", error);
  return json({ error: "unavailable" }, 503);
}

async function requestBody(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof init?.body === "string") return init.body;
  if (typeof Request !== "undefined" && input instanceof Request) return input.clone().text();
  return "";
}

/**
 * Lovable production currently cannot reach the external Supabase Edge runtime
 * from its SSR/server environment. Browser CORS is allowed, so keep the public
 * storefront on the same external backend by bridging only the two configurator
 * endpoints that still use same-origin HTTP routes.
 */
export function installStorefrontPublicApiBridge() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    const url = new URL(rawUrl, window.location.origin);
    if (url.origin !== window.location.origin) return nativeFetch(input, init);

    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const productMatch = url.pathname.match(PRODUCT_PATH);
    if (method === "GET" && productMatch) {
      try {
        const [, slug, productId] = productMatch;
        return json(
          await loadPublicProductFromBrowser(
            decodeURIComponent(slug),
            decodeURIComponent(productId),
          ),
        );
      } catch (error) {
        return publicErrorResponse(error);
      }
    }

    const priceMatch = url.pathname.match(PRICE_PATH);
    if (method === "POST" && priceMatch) {
      try {
        const body = JSON.parse((await requestBody(input, init)) || "{}") as Omit<PriceInput, "slug">;
        return json(
          await computePublicPriceFromBrowser({
            ...body,
            slug: decodeURIComponent(priceMatch[1]),
          }),
        );
      } catch (error) {
        return publicErrorResponse(error);
      }
    }

    return nativeFetch(input, init);
  };
}
