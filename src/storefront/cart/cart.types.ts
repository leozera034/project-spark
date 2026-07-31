/**
 * Fase 13 — Contratos do carrinho público.
 *
 * O carrinho vive apenas no aparelho do cliente (localStorage isolado por
 * slug). Nada aqui é fonte de verdade de preço: os valores guardados são
 * apenas o último valor conhecido, usado para detectar mudanças.
 *
 * NUNCA guardamos: URL assinada de imagem, store_id, dados do cliente,
 * endereço, telefone ou qualquer identificador administrativo.
 */

export type CartSelection = {
  option_group_id: string;
  option_item_id: string;
  quantity: number;
  /** Espelho apenas para exibição offline. Nunca enviado como verdade. */
  nameSnapshot: string;
};

export type CartLine = {
  lineId: string;
  productId: string;
  productNameSnapshot: string;
  variantId: string | null;
  variantNameSnapshot: string | null;
  selections: CartSelection[];
  quantity: number;
  notes: string | null;
  saleMode: string;
  unitLabel: string;
  minimumQuantity: number;
  quantityStep: number;
  maxQuantity: number | null;
  /** Último valor conhecido (informativo). O servidor sempre recalcula. */
  lastKnownUnitPrice: number;
  lastKnownTotal: number;
  addedAt: string;
  updatedAt: string;
};

export type CartDocument = {
  schemaVersion: 1;
  slug: string;
  lines: CartLine[];
  updatedAt: string;
  /** ISO. Passou disso, o carrinho é descartado na leitura. */
  expiresAt: string;
};

export type CartLineIssue =
  | "sold_out"
  | "unavailable"
  | "invalid_configuration"
  | "unpriceable"
  | "price_changed";

export type CartQuoteLine = {
  lineId: string;
  productId: string;
  status: "ok" | "sold_out" | "unavailable" | "invalid_configuration" | "unpriceable";
  productName: string | null;
  unitPrice: number | null;
  total: number | null;
  optionsTotal: number | null;
  validationErrors: string[];
};

export type CartQuote = {
  currency: "BRL";
  quotedAt: string;
  configurationVersion: string | null;
  fulfillmentType: "entrega" | "retirada" | null;
  fulfillmentValid: boolean;
  fulfillmentErrors: string[];
  storeIsOpen: boolean;
  subtotal: number;
  deliveryFee: number | null;
  minimumOrderAmount: number | null;
  minimumOrderMet: boolean;
  estimatedMinutes: number | null;
  total: number;
  hasBlockingIssues: boolean;
  lines: CartQuoteLine[];
};

export type CartQuoteState = "idle" | "loading" | "ready" | "error" | "offline";

/** Entrada usada para adicionar ou substituir uma linha. */
export type CartLineInput = {
  productId: string;
  productNameSnapshot: string;
  variantId: string | null;
  variantNameSnapshot: string | null;
  selections: CartSelection[];
  quantity: number;
  notes: string | null;
  saleMode: string;
  unitLabel: string;
  minimumQuantity: number;
  quantityStep: number;
  maxQuantity: number | null;
  lastKnownUnitPrice: number;
  lastKnownTotal: number;
};
