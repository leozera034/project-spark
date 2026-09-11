/**
 * Acesso do navegador ao checkout público.
 * As leituras e a criação do pedido usam diretamente o Edge do Supabase externo;
 * o Stripe já possui Edge próprio no mesmo projeto.
 */
import { clearCart } from "@/storefront/cart/cart.storage";
import {
  paymentMethodsForBrowser,
  submitOrderForBrowser,
} from "@/storefront/public-commerce";
import { rotateIdempotencyKey, saveReceipt } from "./checkout.storage";
import type { CheckoutSubmitResult, PublicPaymentMethod } from "./checkout.types";

const TIMEOUT_MS = 20_000;
const STRIPE_ORDER_CHECKOUT_URL =
  "https://ypgteuxzgqmkkkpvibhi.supabase.co/functions/v1/comandiva-stripe-order-checkout";

export class CheckoutError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new CheckoutError("failed"));
    }, TIMEOUT_MS);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeCommerceError(error: unknown): CheckoutError {
  if (error instanceof CheckoutError) return error;
  if (error instanceof Error && error.message === "rate_limited") {
    return new CheckoutError("rate_limited");
  }
  return new CheckoutError("failed");
}

export async function fetchPaymentMethods(
  slug: string,
  fulfillmentType: "entrega" | "retirada",
): Promise<PublicPaymentMethod[]> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new CheckoutError("offline");
  }
  return withTimeout(async () => {
    try {
      return await paymentMethodsForBrowser({ slug, fulfillmentType });
    } catch (error) {
      throw normalizeCommerceError(error);
    }
  });
}

export type SubmitOrderBody = {
  idempotencyKey: string;
  customer: { firstName: string; phone: string };
  fulfillment: {
    type: "entrega" | "retirada";
    deliveryAreaId: string | null;
    configurationVersion: string | null;
  };
  address: {
    street: string;
    number: string | null;
    hasNoNumber: boolean;
    complement: string | null;
    reference: string | null;
    label: string | null;
    latitude?: number | null;
    longitude?: number | null;
    accuracyMeters?: number | null;
  } | null;
  payment: { methodId: string; changeFor: number | null };
  notes: string | null;
  lines: {
    lineId: string;
    product_id: string;
    variant_id: string | null;
    quantity: number;
    notes: string | null;
    selections: { option_group_id: string; option_item_id: string; quantity: number }[];
  }[];
};

export async function postOrder(
  slug: string,
  body: SubmitOrderBody,
): Promise<CheckoutSubmitResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new CheckoutError("offline");
  }

  return withTimeout(async () => {
    let payload: CheckoutSubmitResult;
    try {
      payload = await submitOrderForBrowser({ slug, body });
    } catch (error) {
      throw normalizeCommerceError(error);
    }

    if (!payload || typeof payload !== "object" || !("ok" in payload)) {
      throw new CheckoutError("failed");
    }

    if (payload.ok && typeof window !== "undefined") {
      const methods = await fetchPaymentMethods(slug, body.fulfillment.type).catch(() => []);
      const selected = methods.find((method) => method.id === body.payment.methodId);
      const online = selected?.kind === "stripe_online" || selected?.processingMode === "online";

      if (online && selected) {
        const stripe = await createStripeOrderCheckout({
          slug,
          orderId: payload.order.id,
          trackingToken: payload.order.trackingToken,
        });
        saveReceipt(slug, {
          schemaVersion: 1,
          slug,
          order: payload.order,
          fulfillmentType: body.fulfillment.type,
          paymentLabel: selected.displayName,
          paymentInstructions: selected.publicInstructions,
          paymentKind: selected.kind,
          paymentProcessingMode: selected.processingMode,
          createdAt: new Date().toISOString(),
        });
        rotateIdempotencyKey(slug);
        clearCart(slug);
        window.location.assign(stripe.checkoutUrl);
        await new Promise<never>(() => undefined);
      }
    }

    return payload;
  });
}

export async function createStripeOrderCheckout(input: {
  slug: string;
  orderId: string;
  trackingToken: string;
}): Promise<{ checkoutUrl: string }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new CheckoutError("offline");
  }
  return withTimeout(async (signal) => {
    const response = await fetch(STRIPE_ORDER_CHECKOUT_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "create_checkout", ...input }),
      signal,
    });
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; checkoutUrl?: string; error?: string }
      | null;
    if (!response.ok || !payload?.ok || !payload.checkoutUrl) {
      throw new CheckoutError(payload?.error ?? "stripe_checkout_failed");
    }
    return { checkoutUrl: payload.checkoutUrl };
  });
}

export type StripeOrderPaymentStatus = {
  configured: boolean;
  status: string;
  amount_cents?: number;
  currency?: string;
  updated_at?: string;
};

export async function fetchStripeOrderPaymentStatus(input: {
  orderId: string;
  trackingToken: string;
}): Promise<StripeOrderPaymentStatus> {
  return withTimeout(async (signal) => {
    const response = await fetch(STRIPE_ORDER_CHECKOUT_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "status", ...input }),
      signal,
    });
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; payment?: StripeOrderPaymentStatus; error?: string }
      | null;
    if (!response.ok || !payload?.ok || !payload.payment) {
      throw new CheckoutError(payload?.error ?? "stripe_status_failed");
    }
    return payload.payment;
  });
}
