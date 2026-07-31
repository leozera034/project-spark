import { createFileRoute } from "@tanstack/react-router";

import { trackingRequestSchema } from "@/lib/tracking-contracts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "no-store",
};

const MAX_BODY_BYTES = 4 * 1024;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;

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
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-robots-tag": "noindex, nofollow",
      ...CORS,
      ...extra,
    },
  });
}

async function fingerprintOf(request: Request): Promise<string> {
  const raw = request.headers.get("x-forwarded-for") ?? "anon";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Acompanhamento público do pedido.
 *
 * O token viaja no corpo (nunca na URL, para não vazar em logs de proxy ou no
 * Referer). A resposta é sempre uma projeção sanitizada: sem identificadores
 * internos, sem endereço completo e sem telefone do cliente.
 */
export const Route = createFileRoute("/api/public/storefront/pedido/status")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const retryAfter = rateLimited(await fingerprintOf(request));
          if (retryAfter !== null) {
            return json({ ok: false, error: "rate_limited" }, 429, {
              "Retry-After": String(retryAfter),
            });
          }

          const body = await request.text();
          if (body.length > MAX_BODY_BYTES) return json({ ok: false, error: "invalid_request" }, 413);

          const parsed = trackingRequestSchema.parse(JSON.parse(body || "{}"));

          const mod = await import("@/lib/tracking.server");
          const result = await mod.loadOrderTracking(parsed.token, parsed.knownVersion ?? null);

          if (!result.ok) {
            return json(result, result.error === "not_found" ? 404 : 503);
          }
          return json(result);
        } catch {
          return json({ ok: false, error: "invalid_request" }, 400);
        }
      },
    },
  },
});
