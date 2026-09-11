import { createClientOnlyFn } from "@tanstack/react-start";

/**
 * Route-safe bridge for the public storefront. The implementation that imports
 * the browser Supabase client is tree-shaken out of the server bundle.
 */
export const loadStorefrontForRoute = createClientOnlyFn(async (slug: string) => {
  const { loadStorefrontFromBrowser } = await import("./public-edge.client");
  return loadStorefrontFromBrowser(slug);
});
