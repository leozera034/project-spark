/**
 * Acesso do navegador ao endpoint de cotação do carrinho.
 * Timeout, abort e proteção contra resposta fora de ordem.
 */
import type { CartQuote } from "./cart.types";

const TIMEOUT_MS = 12_000;

export class CartQuoteError extends Error {
  constructor(public readonly code: "offline" | "rate_limited" | "failed") {
    super(code);
  }
}

export type CartQuoteRequestBody = {
  fulfillmentType: "entrega" | "retirada" | null;
  deliveryAreaId: string | null;
  configurationVersion: string | null;
  lines: {
    lineId: string;
    product_id: string;
    variant_id: string | null;
    quantity: number;
    selections: { option_group_id: string; option_item_id: string; quantity: number }[];
  }[];
};

export async function postCartQuote(
  slug: string,
  body: CartQuoteRequestBody,
  signal?: AbortSignal,
): Promise<CartQuote> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new CartQuoteError("offline");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const response = await fetch(`/api/public/storefront/${slug}/carrinho/cotacao`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 429) throw new CartQuoteError("rate_limited");
    if (!response.ok) throw new CartQuoteError("failed");

    const payload = (await response.json()) as CartQuote & { error?: string };
    if (payload.error) throw new CartQuoteError("failed");
    return payload;
  } catch (error) {
    if (error instanceof CartQuoteError) throw error;
    throw new CartQuoteError("failed");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
