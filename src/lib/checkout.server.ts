/**
 * Fase 14 — Camada pública de checkout e criação de pedido.
 *
 * SERVIDOR-ONLY (sufixo `.server.ts`). Mesmas regras das Fases 11 a 13:
 * - o visitante nunca toca nas tabelas: tudo passa por RPCs `storefront_*`
 *   concedidas exclusivamente ao servidor;
 * - o `store_id` é resolvido pelo slug dentro do banco e nunca sai daqui;
 * - nenhum preço, desconto, taxa, total ou pedido mínimo enviado pelo navegador é aceito:
 *   a RPC `storefront_submit_order_v2` recalcula tudo e devolve o pedido persistido;
 * - a criação do pedido é idempotente por (loja, chave); o mesmo conteúdo
 *   devolve o mesmo pedido, conteúdo diferente com a mesma chave é recusado;
 * - erros são normalizados; detalhe técnico fica apenas no log do servidor.
 */
import { checkoutRequestSchema, type CheckoutRequest } from "@/lib/checkout-contracts";
import { StorefrontError, slugSchema } from "@/lib/storefront.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type PublicPaymentMethod = {
  id: string;
  kind: string;
  displayName: string;
  publicInstructions: string | null;
  requiresChange: boolean;
  processingMode: "online" | "manual";
  provider: "stripe" | "store";
  confirmationMode: "automatic" | "manual";
};

export type PublicOrderReceipt = {
  id: string;
  orderNumber: number;
  trackingToken: string;
  status: string;
  itemsSubtotal: number;
  discountTotal: number;
  deliveryFee: number;
  total: number;
  etaMinutes: number | null;
};

export type SubmitOrderResult =
  | { ok: true; replayed: boolean; order: PublicOrderReceipt }
  | {
      ok: false;
      error: string;
      lineId?: string;
      reason?: string;
      minimumOrderAmount?: number;
      itemsSubtotal?: number;
      validationErrors?: string[];
    };

const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Formas de pagamento visíveis no cardápio, já filtradas pela modalidade. */
export async function loadPublicPaymentMethods(
  rawSlug: string,
  fulfillmentType: "entrega" | "retirada" | null,
): Promise<PublicPaymentMethod[]> {
  const slug = slugSchema.parse(rawSlug);
  const db = await admin();
  const { data, error } = await db.rpc("storefront_payment_methods", {
    _slug: slug,
    _fulfillment_type: fulfillmentType ?? undefined,
  });

  if (error) {
    console.error("[storefront] payment methods rpc failed", error.message);
    throw new StorefrontError("unavailable");
  }
  if (!data) throw new StorefrontError("not_found");

  const payload = data as Record<string, unknown>;
  return ((payload.methods ?? []) as Record<string, unknown>[]).map((raw) => {
    const online = String(raw.processingMode ?? "manual") === "online";
    return {
      id: String(raw.id),
      kind: String(raw.kind ?? "outro"),
      displayName: String(raw.displayName ?? ""),
      publicInstructions: raw.publicInstructions ? String(raw.publicInstructions) : null,
      requiresChange: Boolean(raw.requiresChange),
      processingMode: online ? "online" : "manual",
      provider: String(raw.provider ?? (online ? "stripe" : "store")) === "stripe" ? "stripe" : "store",
      confirmationMode: String(raw.confirmationMode ?? (online ? "automatic" : "manual")) === "automatic" ? "automatic" : "manual",
    };
  });
}

/**
 * Envia o pedido. Toda a validação final (loja aberta, modalidade, bairro,
 * disponibilidade, montagem, preços, promoção, pedido mínimo e pagamento) é
 * refeita dentro da transação do banco. O recibo vem do pedido persistido.
 */
export async function submitPublicOrder(input: CheckoutRequest): Promise<SubmitOrderResult> {
  const parsed = checkoutRequestSchema.parse(input);
  const db = await admin();
  const { slug, ...payload } = parsed;

  // storefront_submit_order_v2 já está no banco, mas o arquivo gerado de tipos
  // ainda será regenerado em uma etapa separada. O cast fica restrito a esta RPC.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = db.rpc.bind(db) as any;
  const { data, error } = await rpc("storefront_submit_order_v2", {
    _slug: slug,
    _payload: payload,
  }) as { data: unknown; error: { message: string } | null };

  if (error) {
    if (error.message === "rate_limited") return { ok: false, error: "rate_limited" };
    console.error("[storefront] submit order rpc failed", error.message);
    throw new StorefrontError("unavailable");
  }
  if (!data) throw new StorefrontError("not_found");

  const result = data as Record<string, unknown>;

  if (!result.ok) {
    return {
      ok: false,
      error: String(result.error ?? "order_failed"),
      lineId: result.lineId ? String(result.lineId) : undefined,
      reason: result.reason ? String(result.reason) : undefined,
      minimumOrderAmount:
        result.minimumOrderAmount === undefined ? undefined : num(result.minimumOrderAmount),
      itemsSubtotal: result.itemsSubtotal === undefined ? undefined : num(result.itemsSubtotal),
      validationErrors: Array.isArray(result.validationErrors)
        ? result.validationErrors.map((code: unknown) => String(code))
        : undefined,
    };
  }

  const order = (result.order ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    replayed: Boolean(result.replayed),
    order: {
      id: String(order.id),
      orderNumber: Number(order.orderNumber ?? 0),
      trackingToken: String(order.trackingToken ?? ""),
      status: String(order.status ?? "aguardando_confirmacao"),
      itemsSubtotal: num(order.itemsSubtotal),
      discountTotal: num(order.discountTotal),
      deliveryFee: num(order.deliveryFee),
      total: num(order.total),
      etaMinutes:
        order.etaMinutes === null || order.etaMinutes === undefined ? null : num(order.etaMinutes),
    },
  };
}
