import { createServerFn } from "@tanstack/react-start";

import { storefrontRequestSchema } from "@/lib/storefront-contracts";
import { dbRpc } from "@/lib/rpc-caller";

export interface PublicStoreReviewSummary {
  total: number;
  averageRating: number;
  replied: number;
}

export const getPublicStoreReviewSummary = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => storefrontRequestSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payload, error } = await dbRpc(supabaseAdmin)("storefront_review_summary", {
      _slug: data.slug,
    });

    if (error) {
      console.error("[storefront] review summary rpc failed", error.message);
      return { total: 0, averageRating: 0, replied: 0 } satisfies PublicStoreReviewSummary;
    }

    const summary = (payload ?? {}) as Record<string, unknown>;
    return {
      total: Math.max(0, Number(summary.total ?? 0)),
      averageRating: Math.max(0, Math.min(5, Number(summary.averageRating ?? 0))),
      replied: Math.max(0, Number(summary.replied ?? 0)),
    } satisfies PublicStoreReviewSummary;
  });
