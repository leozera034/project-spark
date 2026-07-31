/**
 * Fase 14 — Tipos do checkout público (navegador).
 * Nenhum valor aqui é fonte de verdade: o servidor sempre recalcula.
 */

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
  createdAt: string;
};
