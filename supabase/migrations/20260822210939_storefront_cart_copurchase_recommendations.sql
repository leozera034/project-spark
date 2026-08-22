begin;

-- Recomendações públicas baseadas somente em comportamento agregado da loja.
-- O visitante envia apenas os IDs que já estão no próprio carrinho; nenhum
-- histórico individual, cliente, telefone ou endereço entra no cálculo.
create or replace function public.storefront_product_recommendations(
  _slug text,
  _product_ids uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_slug text := public.storefront_normalize_slug(_slug);
  v_store uuid;
  v_input uuid[] := '{}'::uuid[];
  v_ids uuid[] := '{}'::uuid[];
  v_source text := 'copurchase';
begin
  if v_slug is null then
    return null;
  end if;

  select s.id
    into v_store
    from public.stores s
   where s.slug = v_slug
     and s.status = 'ativa'
   limit 1;

  if v_store is null then
    return null;
  end if;

  select coalesce(array_agg(t.product_id), '{}'::uuid[])
    into v_input
    from (
      select distinct x as product_id
        from unnest(coalesce(_product_ids, '{}'::uuid[])) x
       limit 20
    ) t;

  if cardinality(v_input) > 0 then
    with relevant_orders as (
      select distinct oi.order_id
        from public.order_items oi
        join public.orders o
          on o.id = oi.order_id
         and o.store_id = oi.store_id
       where oi.store_id = v_store
         and oi.product_id = any(v_input)
         and o.created_at >= now() - interval '90 days'
         and o.status not in ('recusado','cancelado')
         and private.order_payment_operational_ready(o.payment_method_kind, o.payment_status)
    ), ranked as (
      select oi.product_id,
             count(distinct oi.order_id) as co_orders,
             sum(oi.quantity) as sold_quantity
        from public.order_items oi
        join relevant_orders ro on ro.order_id = oi.order_id
        join public.products p
          on p.id = oi.product_id
         and p.store_id = oi.store_id
       where oi.store_id = v_store
         and oi.product_id is not null
         and not (oi.product_id = any(v_input))
         and private.product_runtime_available(v_store, oi.product_id, now())
       group by oi.product_id
       order by co_orders desc, sold_quantity desc, oi.product_id
       limit 6
    )
    select coalesce(array_agg(r.product_id order by r.co_orders desc, r.sold_quantity desc, r.product_id), '{}'::uuid[])
      into v_ids
      from ranked r;
  end if;

  -- Loja nova ou carrinho sem histórico suficiente: fallback determinístico
  -- para os produtos mais vendidos, sem repetir itens já presentes no carrinho.
  if cardinality(v_ids) = 0 then
    v_source := 'bestseller_fallback';
    with ranked as (
      select oi.product_id,
             sum(oi.quantity) as sold_quantity
        from public.order_items oi
        join public.orders o
          on o.id = oi.order_id
         and o.store_id = oi.store_id
       where oi.store_id = v_store
         and oi.product_id is not null
         and not (oi.product_id = any(v_input))
         and o.created_at >= now() - interval '30 days'
         and o.status not in ('recusado','cancelado')
         and private.order_payment_operational_ready(o.payment_method_kind, o.payment_status)
         and private.product_runtime_available(v_store, oi.product_id, now())
       group by oi.product_id
       order by sold_quantity desc, oi.product_id
       limit 6
    )
    select coalesce(array_agg(r.product_id order by r.sold_quantity desc, r.product_id), '{}'::uuid[])
      into v_ids
      from ranked r;
  end if;

  return jsonb_build_object(
    'product_ids', to_jsonb(v_ids),
    'source', v_source
  );
end;
$$;

revoke all on function public.storefront_product_recommendations(text, uuid[]) from public, anon, authenticated;
grant execute on function public.storefront_product_recommendations(text, uuid[]) to service_role;

commit;
