import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

const MAX_BODY_BYTES = 8 * 1024;

export const Route = createFileRoute("/api/public/storefront/$slug/preco")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request, params }) => {
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);

        let body: unknown;
        try {
          body = JSON.parse(raw || "{}");
        } catch {
          return json({ error: "invalid_request" }, 400);
        }

        const storefront = await import("@/lib/storefront.server");
        const promotions = await import("@/lib/storefront-promotions.server");
        try {
          const input = storefront.priceInputSchema.parse({
            ...(body as Record<string, unknown>),
            slug: params.slug,
          });
          const result = await promotions.computePromotionalPublicPrice(input);
          return json(result, result.ok ? 200 : 422);
        } catch (error) {
          console.error("[api/public/storefront/preco] failed", error);
          return json({ error: "invalid_request" }, 400);
        }
      },
    },
  },
});
