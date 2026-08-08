/**
 * Pediu Aqui — Tipos de domínio (Fase 04)
 *
 * Fonte de verdade: schema físico do banco.
 * Estes aliases derivam dos tipos gerados em `src/integrations/supabase/types.ts`,
 * de modo que qualquer migration futura propaga automaticamente para a aplicação.
 *
 * IMPORTANTE (Fase 04): nenhuma tela consome estes tipos ainda. O protótipo
 * continua usando os dados fictícios locais em `src/demo/`.
 */
import type { Tables, TablesInsert, TablesUpdate, Enums } from "@/integrations/supabase/types";

/* ------------------------------------------------------------------ enums */
export type StoreStatus = Enums<"store_status">;
export type FulfillmentType = Enums<"fulfillment_type">;
export type OrderStatus = Enums<"order_status">;
export type AppRole = Enums<"app_role">;
export type OptionSelectionType = Enums<"option_selection_type">;
export type PricingUnit = Enums<"pricing_unit">;
export type PaymentMethodKind = Enums<"payment_method_kind">;
export type PromotionType = Enums<"promotion_type">;
export type CourierStatus = Enums<"courier_status">;
export type DeliveryStatus = Enums<"delivery_status">;
export type DeliveryEventType = Enums<"delivery_event_type">;
export type SubscriptionStatus = Enums<"subscription_status">;
export type SubscriptionPaymentStatus = Enums<"subscription_payment_status">;

/* ------------------------------------------------------------- entidades */
export type Plan = Tables<"plans">;
export type Store = Tables<"stores">;
export type StoreSettings = Tables<"store_settings">;
export type StoreHour = Tables<"store_hours">;
export type Neighborhood = Tables<"neighborhoods">;
export type PaymentMethod = Tables<"payment_methods">;
export type UserProfile = Tables<"user_profiles">;
export type UserRole = Tables<"user_roles">;
export type Category = Tables<"categories">;
export type Product = Tables<"products">;
export type ProductVariant = Tables<"product_variants">;
export type OptionGroup = Tables<"option_groups">;
export type OptionItem = Tables<"option_items">;
export type ProductOptionGroup = Tables<"product_option_groups">;
export type Combo = Tables<"combos">;
export type ComboItem = Tables<"combo_items">;
export type Promotion = Tables<"promotions">;
export type Customer = Tables<"customers">;
export type CustomerAddress = Tables<"customer_addresses">;
export type Order = Tables<"orders">;
export type OrderItem = Tables<"order_items">;
export type OrderItemOption = Tables<"order_item_options">;
export type OrderStatusHistory = Tables<"order_status_history">;
export type Courier = Tables<"couriers">;
export type Delivery = Tables<"deliveries">;
export type DeliveryEvent = Tables<"delivery_events">;
export type StoreSubscription = Tables<"store_subscriptions">;
export type SubscriptionPayment = Tables<"subscription_payments">;
export type AuditLog = Tables<"audit_logs">;
export type DevicePushToken = Tables<"device_push_tokens">;

/* ------------------------------------------------------- insert / update */
export type NewOrder = TablesInsert<"orders">;
export type NewOrderItem = TablesInsert<"order_items">;
export type NewOrderItemOption = TablesInsert<"order_item_options">;
export type OrderPatch = TablesUpdate<"orders">;
export type NewProduct = TablesInsert<"products">;
export type ProductPatch = TablesUpdate<"products">;
export type NewCustomer = TablesInsert<"customers">;
export type NewCustomerAddress = TablesInsert<"customer_addresses">;
export type NewDelivery = TablesInsert<"deliveries">;
export type DeliveryPatch = TablesUpdate<"deliveries">;

/* -------------------------------------------------- máquina de estados */
/** Transições permitidas do pedido. Espelha o Plano Mestre, seção 13. */
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  aguardando_confirmacao: ["aceito", "recusado", "cancelado"],
  aceito: ["em_preparo", "cancelado"],
  em_preparo: ["pronto", "cancelado"],
  pronto: ["aguardando_entregador", "aguardando_retirada", "cancelado"],
  aguardando_entregador: ["saiu_para_entrega", "cancelado"],
  saiu_para_entrega: ["entregue", "cancelado"],
  aguardando_retirada: ["retirado", "cancelado"],
  entregue: [],
  retirado: [],
  recusado: [],
  cancelado: [],
} as const;

export const FINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  "entregue",
  "retirado",
  "recusado",
  "cancelado",
] as const;

export function isFinalOrderStatus(status: OrderStatus): boolean {
  return FINAL_ORDER_STATUSES.includes(status);
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/* ------------------------------------------------------------- agregados */
export type ProductWithOptions = Product & {
  variants: ProductVariant[];
  optionGroups: Array<OptionGroup & { items: OptionItem[] }>;
};

export type OrderWithDetails = Order & {
  items: Array<OrderItem & { options: OrderItemOption[] }>;
  history: OrderStatusHistory[];
  delivery: Delivery | null;
};
