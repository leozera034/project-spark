/**
 * Acesso do navegador à cotação canônica do carrinho.
 * Em produção o fluxo público fala com o Edge do Supabase externo, evitando o
 * runtime server-side do Lovable, que não alcança esse backend de forma confiável.
 */
import { quoteCartForBrowser } from "@/storefront/public-commerce";
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
  const externalAbort = () => controller.abort();
  signal?.addEventListener("abort", externalAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const aborted = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener(
        "abort",
        () => reject(new CartQuoteError("failed")),
        { once: true },
      );
    });

    return await Promise.race([
      quoteCartForBrowser({ slug, body }),
      aborted,
    ]);
  } catch (error) {
    if (error instanceof CartQuoteError) throw error;
    if (error instanceof Error && error.message === "rate_limited") {
      throw new CartQuoteError("rate_limited");
    }
    throw new CartQuoteError("failed");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", externalAbort);
  }
}
