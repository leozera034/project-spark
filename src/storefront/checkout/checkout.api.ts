/**
 * Acesso do navegador aos endpoints públicos de checkout.
 * Timeout, abort e normalização de erro.
 */
import { clearCart } from "@/storefront/cart/cart.storage";
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
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPaymentMethods(
  slug: string,
  fulfillmentType: "entrega" | "retirada",
): Promise<PublicPaymentMethod[]> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new CheckoutError("offline");
  }
  return withTimeout(async (signal) => {
    const response = await fetch(
      `/api/public/storefront/${slug}/pagamentos?modalidade=${fulfillmentType}`,
      { signal, headers: { accept: "application/json" } },
    );
    if (!response.ok) throw new CheckoutError("failed");
    const payload = (await response.json()) as { methods?: PublicPaymentMethod[] };
    return payload.methods ?? [];
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

  // Resolve the selected public method before creating the order. This prevents
  // every successful manual order (for example card-at-delivery) from making a
  // pointless Stripe checkout request that is expected to fail with 409.
  // The server still validates the payment method again inside storefront_submit_order.
  const methods = await fetchPaymentMethods(slug, body.fulfillment.type);
  const selected = methods.find((method) => method.id === body.payment.methodId);
  if (!selected) throw new CheckoutError("payment_method_unavailable");

  return withTimeout(async (signal) => {
    let response: Response;
    try {
      response = await fetch(`/api/public/storefront/${slug}/pedidos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch {
      throw new CheckoutError("failed");
    }

    if (response.status === 429) throw new CheckoutError("rate_limited");

    let payload: CheckoutSubmitResult;
    try {
      payload = (await response.json()) as CheckoutSubmitResult;
    } catch {
      throw new CheckoutError("failed");
    }

    if (!payload || typeof payload !== "object" || !("ok" in payload)) {
      throw new CheckoutError("failed");
    }

    if (payload.ok && selected.kind === "stripe_online" && typeof window !== "undefined") {
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
        paymentInstructions:
          selected.publicInstructions ?? "Pagamento seguro processado pela Stripe.",
        createdAt: new Date().toISOString(),
      });
      rotateIdempotencyKey(slug);
      clearCart(slug);
      window.location.assign(stripe.checkoutUrl);
      await new Promise<never>(() => undefined);
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
