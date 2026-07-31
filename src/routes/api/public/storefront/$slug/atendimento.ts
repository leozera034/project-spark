import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=120",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS, ...extra },
  });
}

export const Route = createFileRoute("/api/public/storefront/$slug/atendimento")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ params, request }) => {
        const mod = await import("@/lib/fulfillment.server");
        const storefront = await import("@/lib/storefront.server");
        try {
          const config = await mod.loadPublicFulfillment(params.slug);
          const etag = `W/"${config.configurationVersion}"`;
          if (request.headers.get("if-none-match") === etag) {
            return new Response(null, { status: 304, headers: { ...CORS, ETag: etag } });
          }
          return json(config, 200, { ETag: etag });
        } catch (error) {
          if (error instanceof storefront.StorefrontError) {
            return json({ error: error.code }, error.code === "not_found" ? 404 : 503);
          }
          console.error("[api/public/storefront/atendimento] failed");
          return json({ error: "invalid_request" }, 400);
        }
      },
    },
  },
});
