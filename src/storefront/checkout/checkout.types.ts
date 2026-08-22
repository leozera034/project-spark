/**
 * Fase 14 — Tipos do checkout público (navegador).
 * Nenhum valor aqui é fonte de verdade: o servidor sempre recalcula.
 */
import type { CartLineInput } from "@/storefront/cart/cart.types";

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
  deliveryFee: number;
  total: number;
  etaMinutes: number | null;
};

export type CheckoutSubmitResult =
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

/** Comprovante guardado no aparelho apenas para reexibir a confirmação. */
export type LocalOrderReceipt = {
  schemaVersion: 1;
  slug: string;
  order: PublicOrderReceipt;
  fulfillmentType: "entrega" | "retirada";
  paymentLabel: string;
  paymentInstructions: string | null;
  /** Campos opcionais mantêm compatibilidade com comprovantes criados antes da separação manual/online. */
  paymentKind?: string;
  paymentProcessingMode?: "online" | "manual";
  createdAt: string;
};

/**
 * Cópia local da montagem do último pedido para “Pedir de novo”.
 * Os preços são apenas snapshots: ao restaurar, o carrinho recotiza tudo no servidor.
 * Não contém endereço, telefone, customer_id, store_id nem tokens administrativos.
 */
export type LocalReorderDraft = {
  schemaVersion: 1;
  slug: string;
  orderNumber: number;
  lines: CartLineInput[];
  createdAt: string;
};
