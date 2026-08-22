import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "private, max-age=30",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

const MAX_BODY_BYTES = 4 * 1024;

export const Route = createFileRoute("/api/public/storefront/$slug/recomendacoes")({
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

        const productIds = Array.isArray((body as Record<string, unknown>)?.productIds)
          ? ((body as Record<string, unknown>).productIds as unknown[])
          : [];

        const mod = await import("@/lib/storefront-recommendations.server");
        try {
          const result = await mod.loadStorefrontRecommendations(
            params.slug,
            productIds.filter((id): id is string => typeof id === "string"),
          );
          return json(result);
        } catch (error) {
          console.error("[api/public/storefront/recomendacoes] failed", error);
          return json({ error: "unavailable" }, 503);
        }
      },
    },
  },
});
