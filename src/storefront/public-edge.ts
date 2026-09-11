import { createClientOnlyFn } from "@tanstack/react-start";

import type { PriceInput } from "@/lib/storefront.server";

/**
 * Route-safe bridge for the public storefront. The implementation that imports
 * the browser Supabase client is tree-shaken out of the server bundle.
 */
export const loadStorefrontForRoute = createClientOnlyFn(async (slug: string) => {
  const { loadStorefrontFromBrowser } = await import("./public-edge.client");
  return loadStorefrontFromBrowser(slug);
});

export const loadProductForConfigurator = createClientOnlyFn(
  async ({ slug, productId }: { slug: string; productId: string }) => {
    const { loadPublicProductFromBrowser } = await import("./public-edge.client");
    return loadPublicProductFromBrowser(slug, productId);
  },
);

export const computePriceForConfigurator = createClientOnlyFn(async (input: PriceInput) => {
  const { computePublicPriceFromBrowser } = await import("./public-edge.client");
  return computePublicPriceFromBrowser(input);
});

export const installStorefrontPublicApiBridgeForApp = createClientOnlyFn(async () => {
  const { installStorefrontPublicApiBridge } = await import("./public-api-bridge.client");
  installStorefrontPublicApiBridge();
});
