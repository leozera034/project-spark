import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};
const MAX_BODY_BYTES = 8 * 1024;
const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

const tokenSchema = z.string().min(16).max(256);
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("state"), token: tokenSchema }),
  z.object({
    action: z.literal("submit"),
    token: tokenSchema,
    overallRating: z.number().int().min(1).max(5),
    foodRating: z.number().int().min(1).max(5).nullable().optional(),
    deliveryRating: z.number().int().min(1).max(5).nullable().optional(),
    comment: z.string().trim().max(1000).nullable().optional(),
  }),
]);

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...HEADERS, ...extra },
  });
}

async function fingerprintOf(request: Request): Promise<string> {
  const raw = request.headers.get("x-forwarded-for") ?? "anon";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function rateLimited(key: string, max: number): number | null {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (buckets.size > 5000) buckets.clear();
    return null;
  }
  current.count += 1;
  if (current.count > max) return Math.ceil((current.resetAt - now) / 1000);
  return null;
}

export const Route = createFileRoute("/api/public/storefront/pedido/avaliacao")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.text();
          if (body.length > MAX_BODY_BYTES) return json({ ok: false, error: "invalid_request" }, 413);
          const parsed = requestSchema.parse(JSON.parse(body || "{}"));
          const fingerprint = await fingerprintOf(request);
          const retryAfter = rateLimited(`${fingerprint}:${parsed.action}`, parsed.action === "submit" ? 6 : 30);
          if (retryAfter !== null) {
            return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": String(retryAfter) });
          }

          const mod = await import("@/lib/store-reviews.server");
          if (parsed.action === "state") {
            const result = await mod.loadPublicOrderReviewState(parsed.token);
            return json(result, result.reason === "not_found" ? 404 : 200);
          }

          const result = await mod.submitPublicOrderReview({
            token: parsed.token,
            overallRating: parsed.overallRating,
            foodRating: parsed.foodRating ?? null,
            deliveryRating: parsed.deliveryRating ?? null,
            comment: parsed.comment ?? null,
          });
          const status = result.ok
            ? 200
            : result.error === "review_not_available"
              ? 404
              : result.error === "order_not_completed"
                ? 409
                : 400;
          return json(result, status);
        } catch (error) {
          if (error instanceof z.ZodError || error instanceof SyntaxError) {
            return json({ ok: false, error: "invalid_request" }, 400);
          }
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
