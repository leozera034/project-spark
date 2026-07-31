import { createFileRoute } from "@tanstack/react-router";

import { checkoutRequestSchema } from "@/lib/checkout-contracts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "no-store",
};

const MAX_BODY_BYTES = 32 * 1024;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;

/** Limite best-effort por instância. Nenhum IP bruto é persistido. */
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(fingerprint: string): number | null {
  const now = Date.now();
  const bucket = hits.get(fingerprint);
  if (!bucket || bucket.resetAt <= now) {
    hits.set(fingerprint, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 5000) hits.clear();
    return null;
  }
  bucket.count += 1;
  if (bucket.count > MAX_PER_WINDOW) return Math.ceil((bucket.resetAt - now) / 1000);
  return null;
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS, ...extra },
  });
}

async function fingerprintOf(request: Request, slug: string): Promise<string> {
  const raw = `${request.headers.get("x-forwarded-for") ?? "anon"}|${slug}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Criação do pedido público.
 *
 * O corpo carrega apenas identificadores, quantidades, contato e endereço
 * digitados pelo cliente. Preço, taxa, total, pedido mínimo e disponibilidade
 * são sempre recalculados dentro da transação do banco.
 */
export const Route = createFileRoute("/api/public/storefront/$slug/pedidos")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ params, request }) => {
        const storefront = await import("@/lib/storefront.server");
        try {
          const retryAfter = rateLimited(await fingerprintOf(request, params.slug));
          if (retryAfter !== null) {
            return json({ ok: false, error: "rate_limited" }, 429, {
              "Retry-After": String(retryAfter),
            });
          }

          const body = await request.text();
          if (body.length > MAX_BODY_BYTES) return json({ ok: false, error: "invalid_request" }, 413);

          const parsed = checkoutRequestSchema.parse({
            ...(JSON.parse(body || "{}") as Record<string, unknown>),
            slug: params.slug,
          });

          const mod = await import("@/lib/checkout.server");
          const result = await mod.submitPublicOrder(parsed);

          if (!result.ok) {
            const status =
              result.error === "idempotency_conflict"
                ? 409
                : result.error === "store_closed" || result.error === "fulfillment_invalid"
                  ? 409
                  : 422;
            return json(result, status);
          }

          return json(result, result.replayed ? 200 : 201);
        } catch (error) {
          if (error instanceof storefront.StorefrontError) {
            return json({ ok: false, error: error.code }, error.code === "not_found" ? 404 : 503);
          }
          console.error("[api/public/storefront/pedidos] failed");
          return json({ ok: false, error: "invalid_request" }, 400);
        }
      },
    },
  },
});
