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

export const recordClientError = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => payloadSchema.parse(data))
  .handler(async ({ data }) => {
    const bucket = `${data.source ?? "client"}:${data.route ?? "unknown"}`;
    if (!allowEvent(bucket)) return { accepted: false as const, reason: "rate_limited" as const };

    try {
      const { invokePediuPublicSupport, PediuPublicSupportError } = await import(
        "@/integrations/supabase/public-support.server"
      );
      const result = await invokePediuPublicSupport<{ accepted: boolean }>({
        action: "record_client_error",
        input: data,
      });
      return result.accepted
        ? { accepted: true as const }
        : { accepted: false as const, reason: "storage_failed" as const };
    } catch (error) {
      const { PediuPublicSupportError } = await import(
        "@/integrations/supabase/public-support.server"
      );
      if (error instanceof PediuPublicSupportError && error.code === "rate_limited") {
        return { accepted: false as const, reason: "rate_limited" as const };
      }
      console.error("[observability] external support persistence failed");
      return { accepted: false as const, reason: "storage_failed" as const };
    }
  });
