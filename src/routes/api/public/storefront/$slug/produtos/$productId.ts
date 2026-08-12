import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/storefront/$slug/produtos/$productId")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ params }) => {
        const mod = await import("@/lib/storefront.server");
        try {
          const detail = await mod.loadPublicProduct(params.slug, params.productId);
          const shark = await import("@/lib/storefront-shark-product.server");
          const augmented = await shark.augmentProductWithSharkFlavorStructure(
            params.slug,
            params.productId,
            detail,
          );
          return json(augmented);
        } catch (error) {
          if (error instanceof mod.StorefrontError) {
            return json({ error: error.code }, error.code === "not_found" ? 404 : 503);
          }
          console.error("[api/public/storefront/produto] failed", error);
          return json({ error: "invalid_request" }, 400);
        }
      },
    },
  },
});
