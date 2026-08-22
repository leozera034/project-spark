-- Hardening de produção: o checkout público já passa pela Edge Function
-- `pediu-public-support`, portanto os RPCs SECURITY DEFINER abaixo não precisam
-- permanecer chamáveis diretamente por clientes anon/authenticated.
revoke execute on function public.storefront_delivery_quote(text, numeric, numeric, uuid) from public, anon, authenticated;
revoke execute on function public.storefront_validate_fulfillment_v2(text, text, uuid, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.storefront_delivery_quote(text, numeric, numeric, uuid) to service_role;
grant execute on function public.storefront_validate_fulfillment_v2(text, text, uuid, text, numeric, numeric) to service_role;

-- Índices de cobertura para FKs dos caminhos quentes de catálogo, carrinho,
-- pedido e entrega. A ordem acompanha exatamente as colunas das FKs para
-- acelerar validações, cascatas/deletes administrativos e joins de produção.
create index if not exists categories_parent_store_fk_idx
  on public.categories(parent_id, store_id)
  where parent_id is not null;

create index if not exists products_category_store_fk_idx
  on public.products(category_id, store_id)
  where category_id is not null;

create index if not exists product_variants_product_store_fk_idx
  on public.product_variants(product_id, store_id);

create index if not exists product_option_groups_product_store_fk_idx
  on public.product_option_groups(product_id, store_id);
create index if not exists product_option_groups_group_store_fk_idx
  on public.product_option_groups(option_group_id, store_id);

create index if not exists customer_addresses_customer_store_fk_idx
  on public.customer_addresses(customer_id, store_id);
create index if not exists customer_addresses_neighborhood_store_fk_idx
  on public.customer_addresses(neighborhood_id, store_id)
  where neighborhood_id is not null;

create index if not exists orders_customer_store_fk_idx
  on public.orders(customer_id, store_id)
  where customer_id is not null;
create index if not exists orders_address_store_fk_idx
  on public.orders(address_id, store_id)
  where address_id is not null;
create index if not exists orders_neighborhood_store_fk_idx
  on public.orders(neighborhood_id, store_id)
  where neighborhood_id is not null;
create index if not exists orders_payment_method_store_fk_idx
  on public.orders(payment_method_id, store_id)
  where payment_method_id is not null;

create index if not exists order_items_order_store_fk_idx
  on public.order_items(order_id, store_id);
create index if not exists order_items_product_store_fk_idx
  on public.order_items(product_id, store_id)
  where product_id is not null;
create index if not exists order_items_variant_store_fk_idx
  on public.order_items(variant_id, store_id)
  where variant_id is not null;

create index if not exists order_item_options_item_store_fk_idx
  on public.order_item_options(order_item_id, store_id);
create index if not exists order_item_options_group_store_fk_idx
  on public.order_item_options(option_group_id, store_id)
  where option_group_id is not null;
create index if not exists order_item_options_option_store_fk_idx
  on public.order_item_options(option_item_id, store_id)
  where option_item_id is not null;

create index if not exists deliveries_order_store_fk_idx
  on public.deliveries(order_id, store_id);
create index if not exists deliveries_courier_store_fk_idx
  on public.deliveries(courier_id, store_id)
  where courier_id is not null;

create index if not exists delivery_events_delivery_store_fk_idx
  on public.delivery_events(delivery_id, store_id);
create index if not exists delivery_events_courier_store_fk_idx
  on public.delivery_events(courier_id, store_id)
  where courier_id is not null;
