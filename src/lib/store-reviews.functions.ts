import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;

function rpcCaller(client: { rpc: unknown }): RpcCaller {
  return client.rpc as RpcCaller;
}

export interface StoreReviewSummary {
  total: number;
  averageRating: number;
  averageFoodRating: number;
  averageDeliveryRating: number;
  replied: number;
  responseRate: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
}

export interface StoreReviewItem {
  id: string;
  orderId: string;
  orderNumber: number;
  customerName: string;
  fulfillment: "entrega" | "retirada";
  overallRating: number;
  foodRating: number | null;
  deliveryRating: number | null;
  comment: string | null;
  merchantReply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

export interface StoreReviewCenter {
  summary: StoreReviewSummary;
  items: StoreReviewItem[];
  generatedAt: string;
}

export const getStoreReviewCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("get_my_store_review_center", {
      _store_id: data.storeId,
      _limit: 200,
      _offset: 0,
    });
    if (result.error) throw result.error;
    return result.data as StoreReviewCenter;
  });

export const replyToStoreReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      storeId: z.string().uuid(),
      reviewId: z.string().uuid(),
      reply: z.string().trim().min(1).max(1000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("reply_to_store_review", {
      _store_id: data.storeId,
      _review_id: data.reviewId,
      _reply: data.reply,
    });
    if (result.error) throw result.error;
    return result.data as { ok: boolean; reviewId: string; repliedAt: string };
  });
