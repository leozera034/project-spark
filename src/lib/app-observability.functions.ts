import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const payloadSchema = z.object({
  message: z.string().trim().min(1).max(500),
  stack: z.string().max(4000).optional(),
  route: z.string().max(300).optional(),
  source: z.string().max(120).optional(),
  boundary: z.string().max(120).optional(),
  userAgent: z.string().max(500).optional(),
});

const WINDOW_MS = 60_000;
const MAX_EVENTS = 20;
const buckets = new Map<string, { count: number; resetAt: number }>();

function allowEvent(bucket: string) {
  const now = Date.now();
  const current = buckets.get(bucket);
  if (!current || current.resetAt <= now) {
    buckets.set(bucket, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  current.count += 1;
  return current.count <= MAX_EVENTS;
}

function sanitize(value: string | undefined) {
  if (!value) return undefined;
  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/gi, "sb_[redacted]")
    .replace(/[A-Fa-f0-9]{32,}/g, "[redacted]");
}

export const recordClientError = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => payloadSchema.parse(data))
  .handler(async ({ data }) => {
    const bucket = `${data.source ?? "client"}:${data.route ?? "unknown"}`;
    if (!allowEvent(bucket)) return { accepted: false as const, reason: "rate_limited" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      actor_kind: "sistema",
      action: "app.error",
      entity: "application",
      context: {
        message: sanitize(data.message),
        stack: sanitize(data.stack),
        route: data.route,
        source: data.source,
        boundary: data.boundary,
        userAgent: data.userAgent,
      },
    });

    if (error) {
      console.error("[observability] failed to persist client error", error);
      return { accepted: false as const, reason: "storage_failed" as const };
    }

    return { accepted: true as const };
  });
