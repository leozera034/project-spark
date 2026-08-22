import type {
  PublicOrderReviewState,
  SubmitOrderReviewInput,
  SubmitOrderReviewResult,
} from "@/lib/store-reviews.contracts";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function loadPublicOrderReviewState(token: string): Promise<PublicOrderReviewState> {
  const db = await admin();
  const { data, error } = await db.rpc("get_public_order_review_state", {
    _tracking_token: token,
  });
  if (error) {
    console.error("[reviews] state lookup failed");
    throw new Error("review_state_unavailable");
  }
  return (data ?? { available: false, reason: "not_found" }) as PublicOrderReviewState;
}

export async function submitPublicOrderReview(input: SubmitOrderReviewInput): Promise<SubmitOrderReviewResult> {
  const db = await admin();
  const { data, error } = await db.rpc("submit_store_order_review", {
    _tracking_token: input.token,
    _overall_rating: input.overallRating,
    _food_rating: input.foodRating ?? null,
    _delivery_rating: input.deliveryRating ?? null,
    _comment: input.comment ?? null,
  });
  if (error) {
    console.error("[reviews] submit failed");
    throw new Error("review_submit_unavailable");
  }
  return (data ?? { ok: false, error: "review_submit_unavailable" }) as SubmitOrderReviewResult;
}
