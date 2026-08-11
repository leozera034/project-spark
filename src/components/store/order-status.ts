/**
 * Mapa único de cor semântica por status de pedido.
 *
 * Todas as telas da loja (dashboard, pedidos, cozinha) devem usar este mapa
 * para badges/indicadores de status, garantindo consistência visual. Não
 * altera rótulos oficiais (ver STATUS_LABEL em src/store-orders/types.ts).
 */
import type { StoreOrderStatus } from "@/store-orders/types";

export type OrderStatusTone = "warning" | "info" | "brand" | "success" | "danger" | "neutral";

export const ORDER_STATUS_TONE: Record<StoreOrderStatus, OrderStatusTone> = {
  aguardando_confirmacao: "warning",
  aceito: "info",
  em_preparo: "brand",
  pronto: "success",
  aguardando_retirada: "success",
  aguardando_entregador: "warning",
  em_rota: "info",
  entregue: "success",
  retirado: "success",
  recusado: "danger",
  cancelado: "neutral",
};

/** Variante equivalente do componente <Badge /> para cada tom semântico. */
export const TONE_BADGE_VARIANT: Record<
  OrderStatusTone,
  "warning" | "info" | "brandSoft" | "success" | "danger" | "secondary"
> = {
  warning: "warning",
  info: "info",
  brand: "brandSoft",
  success: "success",
  danger: "danger",
  neutral: "secondary",
};

export function orderStatusBadgeVariant(status: StoreOrderStatus) {
  return TONE_BADGE_VARIANT[ORDER_STATUS_TONE[status]];
}

/** Classes utilitárias para indicadores de ponto/borda (fora do <Badge />). */
export const TONE_DOT_CLASSNAME: Record<OrderStatusTone, string> = {
  warning: "bg-warning",
  info: "bg-info",
  brand: "bg-brand",
  success: "bg-success",
  danger: "bg-danger",
  neutral: "bg-muted-foreground",
};

export function orderStatusDotClassName(status: StoreOrderStatus) {
  return TONE_DOT_CLASSNAME[ORDER_STATUS_TONE[status]];
}
