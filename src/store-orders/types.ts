/**
 * Fase 16 — Bloco B: contratos do painel de pedidos da loja.
 *
 * Espelham exatamente o JSON devolvido pelas RPCs `*_store_order*`. Nada aqui
 * é calculado no cliente: status, versão e ações permitidas vêm do servidor.
 */

/** Status internos do pedido (enum `order_status`). */
export type StoreOrderStatus =
  | "aguardando_confirmacao"
  | "aceito"
  | "em_preparo"
  | "pronto"
  | "aguardando_retirada"
  | "aguardando_entregador"
  | "em_rota"
  | "entregue"
  | "retirado"
  | "recusado"
  | "cancelado";

/** Ações que o servidor autoriza para o pedido, já filtradas por permissão. */
export type StoreOrderAction =
  | "accept"
  | "start_preparation"
  | "mark_ready"
  | "complete_pickup"
  | "reject"
  | "cancel";

export type FulfillmentType = "entrega" | "retirada";

export interface StoreOrderListItem {
  id: string;
  orderNumber: number;
  createdAt: string;
  updatedAt: string;
  status: StoreOrderStatus;
  publicCode: string;
  fulfillment: FulfillmentType;
  customerFirstName: string;
  itemCount: number;
  total: number;
  paymentLabel: string | null;
  etaMinutes: number | null;
  version: number;
  isDelayed: boolean;
  delayMinutes: number;
  allowedActions: StoreOrderAction[];
}

export interface StoreOrderListPage {
  orders: StoreOrderListItem[];
  nextCursor?: { createdAt: string; id: string } | null;
}

export interface StoreOrderCounts {
  storeId: string;
  byStatus: Partial<Record<StoreOrderStatus, number>>;
}

export interface StoreOrderDetail {
  id: string;
  orderNumber: number;
  createdAt: string;
  updatedAt: string;
  status: StoreOrderStatus;
  publicCode: string;
  fulfillment: FulfillmentType;
  version: number;
  etaMinutes: number | null;
  customer: { firstName: string; fullName: string | null; phone: string | null };
  delivery: { neighborhood: string | null; address: Record<string, unknown> | null } | null;
  items: Array<{
    productName: string;
    variantName: string | null;
    quantity: number;
    pricingUnit: string;
    unitPrice: number;
    lineTotal: number;
    notes: string | null;
    options: Array<{ groupName: string; optionName: string; quantity: number }>;
  }>;
  notes: string | null;
  payment: {
    label: string | null;
    kind: string | null;
    changeFor: number | null;
    needsChange: boolean | null;
    instructions: string | null;
  };
  totals: { subtotal: number; deliveryFee: number; discount?: number; total: number };
  allowedActions: StoreOrderAction[];
}

export interface StoreOrderHistoryEntry {
  occurredAt: string;
  fromStatus: StoreOrderStatus | null;
  toStatus: StoreOrderStatus;
  action: string;
  actorKind: string;
  actorName: string | null;
  reasonCode: string | null;
  internalNote: string | null;
  customerMessage: string | null;
}

export interface TransitionReason {
  code: string;
  internal_label: string;
  public_message: string | null;
  applies_reject: boolean;
  applies_cancel: boolean;
  sort_order: number;
}

/** Fila operacional: agrupamento de status usado no painel. */
export interface OrderQueue {
  key: string;
  label: string;
  statuses: StoreOrderStatus[];
}

export const ORDER_QUEUES: OrderQueue[] = [
  { key: "novos", label: "Novos", statuses: ["aguardando_confirmacao"] },
  { key: "preparo", label: "Em preparo", statuses: ["aceito", "em_preparo"] },
  {
    key: "prontos",
    label: "Prontos",
    statuses: ["pronto", "aguardando_retirada", "aguardando_entregador"],
  },
  { key: "rota", label: "Em rota", statuses: ["em_rota"] },
  {
    key: "finalizados",
    label: "Finalizados",
    statuses: ["entregue", "retirado", "recusado", "cancelado"],
  },
];

export const STATUS_LABEL: Record<StoreOrderStatus, string> = {
  aguardando_confirmacao: "Aguardando confirmação",
  aceito: "Aceito",
  em_preparo: "Em preparo",
  pronto: "Pronto",
  aguardando_retirada: "Aguardando retirada",
  aguardando_entregador: "Aguardando entregador",
  em_rota: "Em rota",
  entregue: "Entregue",
  retirado: "Retirado",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

export const ACTION_LABEL: Record<StoreOrderAction, string> = {
  accept: "Aceitar",
  start_preparation: "Iniciar preparo",
  mark_ready: "Marcar pronto",
  complete_pickup: "Confirmar retirada",
  reject: "Recusar",
  cancel: "Cancelar",
};
