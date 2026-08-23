begin;

update public.orders
   set catalog_pricing_finalized_at=coalesce(created_at,now())
 where catalog_pricing_finalized_at is null;

alter table public.order_items
  drop constraint if exists order_items_promotion_fk;
alter table public.order_items
  add constraint order_items_promotion_fk
  foreign key (promotion_id, store_id)
  references public.promotions(id, store_id)
  on delete restrict;

comment on column public.orders.catalog_pricing_finalized_at is
  'Congela o conjunto de promoções do catálogo aplicado ao pedido. Pedidos históricos foram backfilled para impedir reprecificação retroativa.';
comment on column public.order_items.discount_total is
  'Desconto promocional congelado desta linha. line_total permanece como valor original; receita líquida da linha = line_total - discount_total.';

commit;
