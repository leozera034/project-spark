import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

/** Formas de pagamento publicadas pela loja, sem qualquer dado administrativo. */
export const Route = createFileRoute("/api/public/storefront/$slug/pagamentos")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ params, request }) => {
        const storefront = await import("@/lib/storefront.server");
        try {
          const url = new URL(request.url);
          const raw = url.searchParams.get("modalidade");
          const type = raw === "entrega" || raw === "retirada" ? raw : null;

          const mod = await import("@/lib/checkout.server");
          return json({ methods: await mod.loadPublicPaymentMethods(params.slug, type) });
        } catch (error) {
          if (error instanceof storefront.StorefrontError) {
            return json({ error: error.code }, error.code === "not_found" ? 404 : 503);
          }
          console.error("[api/public/storefront/pagamentos] failed");
          return json({ error: "invalid_request" }, 400);
        }
      },
    },
  },
});
