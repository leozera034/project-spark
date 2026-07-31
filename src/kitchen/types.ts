/**
 * Fase 17 — contratos do Modo Cozinha.
 *
 * A projeção é intencionalmente mínima: não existe tipo para cliente,
 * telefone, endereço, modalidade, pagamento ou qualquer valor financeiro.
 * O que não está aqui também não é devolvido pelo banco.
 */

export type KitchenStatus = "aceito" | "em_preparo";

export type KitchenAction = "start_preparation" | "mark_ready";

export type KitchenUrgency = "normal" | "attention" | "delayed";

export interface KitchenOptionLine {
  groupName: string;
  itemName: string;
  quantity: number;
  portionLabel: string | null;
}

export interface KitchenItem {
  itemId: string;
  displayOrder: number;
  quantity: number;
  measurementUnit: string;
  productName: string;
  variantName: string | null;
  note: string | null;
  optionGroups: KitchenOptionLine[];
}

export interface KitchenOrder {
  orderId: string;
  orderNumber: number;
  status: KitchenStatus;
  version: number;
  createdAt: string;
  acceptedAt: string | null;
  preparationStartedAt: string | null;
  estimatedPreparationMinutes: number | null;
  serverNow: string;
  isDelayed: boolean;
  delayMinutes: number;
  urgencyLevel: KitchenUrgency;
  allowedActions: KitchenAction[];
  items: KitchenItem[];
}

export interface KitchenProjection {
  storeId: string;
  serverNow: string;
  orders: KitchenOrder[];
}

export const KITCHEN_ACTION_LABEL: Record<KitchenAction, string> = {
  start_preparation: "Iniciar preparo",
  mark_ready: "Marcar como pronto",
};

export const KITCHEN_UNIT_LABEL: Record<string, string> = {
  unidade: "",
  peso: "kg",
  volume: "L",
};

/** Quantidade legível a partir do snapshot congelado, sem recalcular nada. */
export function formatKitchenQuantity(quantity: number, unit: string): string {
  const suffix = KITCHEN_UNIT_LABEL[unit] ?? "";
  if (!suffix) {
    const inteiro = Number.isInteger(quantity)
      ? String(quantity)
      : quantity.toLocaleString("pt-BR");
    return `${inteiro} ×`;
  }
  return `${quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${suffix} de`;
}
