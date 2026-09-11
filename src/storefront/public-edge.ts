import { createClientOnlyFn } from "@tanstack/react-start";

/**
 * Route-safe bridge for the public storefront. The browser-only imports are
 * tree-shaken out of the server bundle and only execute for `/loja/:slug`.
 */
export const loadStorefrontForRoute = createClientOnlyFn(async (slug: string) => {
  const [{ loadStorefrontFromBrowser }, { installStorefrontPublicApiBridge }] =
    await Promise.all([
      import("./public-edge.client"),
      import("./public-api-bridge.client"),
    ]);

  installStorefrontPublicApiBridge();
  return loadStorefrontFromBrowser(slug);
});
