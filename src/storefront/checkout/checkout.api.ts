/**
 * Acesso do navegador aos endpoints públicos de checkout.
 * Timeout, abort e normalização de erro.
 */
import type { CheckoutSubmitResult, PublicPaymentMethod } from "./checkout.types";
import { rotateIdempotencyKey } from "./checkout.storage";

const TIMEOUT_MS = 20_000;

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

    // Before the atomicity fix, a failed checkout could leave a partial order
    // attached to the current idempotency key. The hardened RPC detects that legacy
    // condition and refuses to replay it. Rotate only for this explicit condition so
    // the next user retry starts a clean attempt; ordinary network failures keep the
    // same key and preserve normal idempotent recovery.
    if (!payload.ok && payload.error === "idempotency_incomplete_order") {
      rotateIdempotencyKey(slug);
    }

    return payload;
  });
}
