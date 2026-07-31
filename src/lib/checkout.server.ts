/**
 * Fase 14 — Camada pública de checkout e criação de pedido.
 *
 * SERVIDOR-ONLY (sufixo `.server.ts`). Mesmas regras das Fases 11 a 13:
 * - o visitante nunca toca nas tabelas: tudo passa por RPCs `storefront_*`
 *   concedidas exclusivamente ao servidor;
 * - o `store_id` é resolvido pelo slug dentro do banco e nunca sai daqui;
 * - nenhum preço, taxa, total ou pedido mínimo enviado pelo navegador é aceito:
 *   a RPC `storefront_submit_order` recalcula tudo dentro da transação;
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
};

export type PublicOrderReceipt = {
  id: string;
  orderNumber: number;
  trackingToken: string;
  status: string;
  itemsSubtotal: number;
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

  const payload = data as Record<string, any>;
  return ((payload.methods ?? []) as Record<string, unknown>[]).map((raw) => ({
    id: String(raw.id),
    kind: String(raw.kind ?? "outro"),
    displayName: String(raw.displayName ?? ""),
    publicInstructions: raw.publicInstructions ? String(raw.publicInstructions) : null,
    requiresChange: Boolean(raw.requiresChange),
  }));
}

/**
 * Envia o pedido. Toda a validação final (loja aberta, modalidade, bairro,
 * disponibilidade, montagem, preços, pedido mínimo, forma de pagamento) é
 * refeita dentro da transação do banco.
 */
export async function submitPublicOrder(input: CheckoutRequest): Promise<SubmitOrderResult> {
  const parsed = checkoutRequestSchema.parse(input);
  const db = await admin();

  const { slug, ...payload } = parsed;

  const { data, error } = await db.rpc("storefront_submit_order", {
    _slug: slug,
    _payload: payload as unknown as never,
  });

  if (error) {
    console.error("[storefront] submit order rpc failed", error.message);
    throw new StorefrontError(("DEBUG:" + error.message) as never);
  }
  if (!data) throw new StorefrontError("not_found");

  const result = data as Record<string, any>;

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
      deliveryFee: num(order.deliveryFee),
      total: num(order.total),
      etaMinutes:
        order.etaMinutes === null || order.etaMinutes === undefined ? null : num(order.etaMinutes),
    },
  };
}
