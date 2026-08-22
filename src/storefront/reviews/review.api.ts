import type {
  PublicOrderReviewState,
  SubmitOrderReviewInput,
  SubmitOrderReviewResult,
} from "@/lib/store-reviews.contracts";

const TIMEOUT_MS = 15_000;

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch("/api/public/storefront/pedido/avaliacao", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as T | null;
    if (!payload || typeof payload !== "object") throw new Error("review_api_invalid_response");
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export function fetchOrderReviewState(token: string): Promise<PublicOrderReviewState> {
  return post<PublicOrderReviewState>({ action: "state", token });
}

export function submitOrderReview(input: SubmitOrderReviewInput): Promise<SubmitOrderReviewResult> {
  return post<SubmitOrderReviewResult>({ action: "submit", ...input });
}
