/**
 * Catálogo de permissões — espelho de `public.app_permission` (Fase 07).
 *
 * Este arquivo existe apenas para tipar a interface. A autorização real é
 * decidida no banco por `private.has_permission(acao, loja)`; nada aqui
 * concede acesso.
 */

export const APP_PERMISSIONS = [
  "store.view_basic",
  "store.update_profile",
  "store.manage_settings",
  "store.manage_hours",
  "store.manage_neighborhoods",
  "store.manage_payment_methods",

  "catalog.view",
  "catalog.create",
  "catalog.update",
  "catalog.archive",

  "orders.view_queue",
  "orders.view_customer_contact",
  "orders.accept",
  "orders.reject",
  "orders.start_preparation",
  "orders.mark_ready",
  "orders.cancel",

  "kitchen.view",
  "kitchen.start_preparation",
  "kitchen.mark_ready",

  "team.view",
  "team.invite",
  "team.change_role",
  "team.disable",

  "couriers.view",
  "couriers.create",
  "couriers.update",
  "couriers.assign",
  "couriers.reset_access",

  "courier.view_self",
  "courier.view_offered_deliveries",
  "courier.view_assigned_delivery",
  "courier.update_delivery_status",
  "courier.register_incident",

  "reports.view_operational",
  "subscription.view",

  "platform.stores.view",
  "platform.stores.create",
  "platform.stores.update",
  "platform.stores.suspend",
  "platform.stores.reactivate",
  "platform.plans.view",
  "platform.plans.manage",
  "platform.billing.view",
  "platform.billing.register_payment",
  "platform.audit.view",
  "platform.support.open_context",
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];

/** Uma permissão concedida ao próprio usuário. `store_id` nulo = ação global da plataforma. */
export interface GrantedPermission {
  permission: AppPermission;
  store_id: string | null;
}

/**
 * Verificação apenas para orientar a interface (esconder botão, ocultar menu).
 * Nunca use isto como barreira de segurança.
 */
export function uiCan(
  granted: readonly GrantedPermission[] | null | undefined,
  permission: AppPermission,
  storeId?: string | null,
): boolean {
  if (!granted) return false;
  return granted.some(
    (g) =>
      g.permission === permission &&
      (storeId === undefined || storeId === null
        ? g.store_id === null
        : g.store_id === storeId),
  );
}
