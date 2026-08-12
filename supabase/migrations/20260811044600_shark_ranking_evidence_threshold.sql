-- SHARK — qualidade estatística mínima para ranking e co-compra.
-- Evita rotular produto como popular ou recomendado com base em apenas um pedido.

create or replace function public.storefront_popular_products(
  _slug text,
  _days integer default 60,
  _limit integer default 8
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_slug text:=public.storefront_normalize_slug(_slug);
  v_store uuid;
  v_days integer:=greatest(7,least(coalesce(_days,60),180));
  v_limit integer:=greatest(1,least(coalesce(_limit,8),20));
begin
  if v_slug is null then return '[]'::jsonb; end if;

  select st.id into v_store
  from public.stores st
  where st.slug=v_slug and st.status='ativa'
  limit 1;

  if v_store is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'product_id',ranked.product_id,
        'units',ranked.units,
        'order_count',ranked.order_count
      )
      order by ranked.units desc,ranked.order_count desc,ranked.product_id
    )
    from (
      select
        oi.product_id,
        sum(oi.quantity)::numeric as units,
        count(distinct oi.order_id)::integer as order_count
      from public.order_items oi
      join public.orders o on o.id=oi.order_id and o.store_id=oi.store_id
      join public.products p on p.id=oi.product_id and p.store_id=oi.store_id
      where oi.store_id=v_store
        and oi.product_id is not null
        and o.created_at>=now()-make_interval(days=>v_days)
        and o.status in (
          'aceito','em_preparo','pronto','aguardando_entregador',
          'saiu_para_entrega','aguardando_retirada','entregue','retirado'
        )
        and p.is_available and not p.is_archived and not p.is_sold_out
      group by oi.product_id
      having count(distinct oi.order_id)>=2
      order by sum(oi.quantity) desc,count(distinct oi.order_id) desc,oi.product_id
      limit v_limit
    ) ranked
  ),'[]'::jsonb);
end;
$$;

create or replace function public.storefront_product_recommendations(
  _slug text,
  _product_id uuid,
  _days integer default 90,
  _limit integer default 4
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_slug text:=public.storefront_normalize_slug(_slug);
  v_store uuid;
  v_days integer:=greatest(14,least(coalesce(_days,90),365));
  v_limit integer:=greatest(1,least(coalesce(_limit,4),8));
begin
  if v_slug is null or _product_id is null then return '[]'::jsonb; end if;

  select st.id into v_store
  from public.stores st
  where st.slug=v_slug and st.status='ativa'
  limit 1;

  if v_store is null or not exists(
    select 1 from public.products p
    where p.id=_product_id and p.store_id=v_store and p.is_available and not p.is_archived
  ) then return '[]'::jsonb; end if;

  return coalesce((
    with source_orders as (
      select distinct oi.order_id
      from public.order_items oi
      join public.orders o on o.id=oi.order_id and o.store_id=oi.store_id
      where oi.store_id=v_store
        and oi.product_id=_product_id
        and o.created_at>=now()-make_interval(days=>v_days)
        and o.status in (
          'aceito','em_preparo','pronto','aguardando_entregador',
          'saiu_para_entrega','aguardando_retirada','entregue','retirado'
        )
    ), ranked as (
      select
        oi.product_id,
        count(distinct oi.order_id)::integer as together_orders,
        sum(oi.quantity)::numeric as units
      from public.order_items oi
      join source_orders so on so.order_id=oi.order_id
      join public.products p on p.id=oi.product_id and p.store_id=oi.store_id
      where oi.store_id=v_store
        and oi.product_id is not null
        and oi.product_id<>_product_id
        and p.is_available and not p.is_archived and not p.is_sold_out
      group by oi.product_id
      having count(distinct oi.order_id)>=2
      order by count(distinct oi.order_id) desc,sum(oi.quantity) desc,oi.product_id
      limit v_limit
    )
    select jsonb_agg(jsonb_build_object(
      'product_id',product_id,
      'together_orders',together_orders,
      'units',units
    ) order by together_orders desc,units desc,product_id)
    from ranked
  ),'[]'::jsonb);
end;
$$;

revoke all on function public.storefront_popular_products(text,integer,integer) from public,anon,authenticated;
grant execute on function public.storefront_popular_products(text,integer,integer) to service_role;
revoke all on function public.storefront_product_recommendations(text,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.storefront_product_recommendations(text,uuid,integer,integer) to service_role;

comment on function public.storefront_popular_products(text,integer,integer) is
  'Ranking agregado de produtos com evidência mínima de dois pedidos confirmados.';
comment on function public.storefront_product_recommendations(text,uuid,integer,integer) is
  'Co-compra agregada com evidência mínima de dois pedidos em conjunto.';