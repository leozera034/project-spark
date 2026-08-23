begin;

alter table public.promotions
  add column if not exists description text,
  add column if not exists max_discount_amount numeric(10,2),
  add column if not exists is_archived boolean not null default false;

alter table public.promotions
  drop constraint if exists promotions_scope_check;
alter table public.promotions
  add constraint promotions_scope_check
  check (not (product_id is not null and category_id is not null));

alter table public.promotions
  drop constraint if exists promotions_max_discount_check;
alter table public.promotions
  add constraint promotions_max_discount_check
  check (max_discount_amount is null or max_discount_amount > 0);

alter table public.order_items
  add column if not exists discount_total numeric(10,2) not null default 0,
  add column if not exists promotion_id uuid,
  add column if not exists promotion_name text,
  add column if not exists promotion_snapshot jsonb;

alter table public.order_items
  drop constraint if exists order_items_discount_total_check;
alter table public.order_items
  add constraint order_items_discount_total_check
  check (discount_total >= 0 and discount_total <= line_total);

alter table public.order_items
  drop constraint if exists order_items_promotion_fk;
alter table public.order_items
  add constraint order_items_promotion_fk
  foreign key (promotion_id, store_id)
  references public.promotions(id, store_id)
  on delete set null;

alter table public.orders
  add column if not exists catalog_pricing_finalized_at timestamptz;

create index if not exists promotions_store_product_runtime_idx
  on public.promotions(store_id, product_id, is_active, is_archived)
  where product_id is not null;
create index if not exists promotions_store_category_runtime_idx
  on public.promotions(store_id, category_id, is_active, is_archived)
  where category_id is not null;

create or replace function private.best_catalog_promotion(
  _store_id uuid,
  _product_id uuid,
  _base_amount numeric,
  _quantity numeric,
  _at timestamptz default now()
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  _product public.products;
  _pricing_units numeric := 1;
  _reference_quantity numeric := 1;
  _result jsonb;
begin
  if _store_id is null or _product_id is null or coalesce(_base_amount,0) <= 0 or coalesce(_quantity,0) <= 0 then
    return null;
  end if;

  select * into _product
    from public.products p
   where p.store_id=_store_id and p.id=_product_id and not p.is_archived;
  if not found then return null; end if;

  if _product.sale_mode::text='measured' then
    _reference_quantity := greatest(
      coalesce(
        nullif(_product.pricing_rules->>'price_reference_quantity','')::numeric,
        nullif(_product.minimum_quantity,0),
        1
      ),
      0.000001
    );
    _pricing_units := _quantity / _reference_quantity;
  else
    _pricing_units := _quantity;
  end if;

  select jsonb_build_object(
    'id', ranked.id,
    'name', ranked.name,
    'kind', ranked.kind,
    'value', ranked.value,
    'max_discount_amount', ranked.max_discount_amount,
    'discount_total', ranked.discount_total,
    'scope', ranked.scope
  )
  into _result
  from (
    select
      pr.id,
      pr.name,
      pr.kind::text as kind,
      pr.value,
      pr.max_discount_amount,
      case
        when pr.product_id is not null then 'product'
        when pr.category_id is not null then 'category'
        else 'store'
      end as scope,
      least(
        _base_amount,
        coalesce(pr.max_discount_amount, 999999999::numeric),
        case
          when pr.kind='percentual' then private.money(_base_amount * pr.value / 100)
          else private.money(pr.value * _pricing_units)
        end
      ) as discount_total,
      case when pr.product_id is not null then 3 when pr.category_id is not null then 2 else 1 end as specificity
    from public.promotions pr
    where pr.store_id=_store_id
      and pr.is_active
      and not pr.is_archived
      and (pr.starts_at is null or pr.starts_at <= _at)
      and (pr.ends_at is null or pr.ends_at > _at)
      and (
        pr.product_id=_product_id
        or (pr.product_id is null and pr.category_id=_product.category_id)
        or (pr.product_id is null and pr.category_id is null)
      )
  ) ranked
  where ranked.discount_total > 0
  order by ranked.discount_total desc, ranked.specificity desc, ranked.id
  limit 1;

  return _result;
end;
$$;

revoke all on function private.best_catalog_promotion(uuid,uuid,numeric,numeric,timestamptz) from public,anon,authenticated;

create or replace function private.apply_catalog_promotion_to_price(
  _store_id uuid,
  _product_id uuid,
  _quantity numeric,
  _price jsonb,
  _at timestamptz default now()
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  _promo jsonb;
  _base_total numeric;
  _original_total numeric;
  _original_unit numeric;
  _discount numeric;
  _discounted_total numeric;
  _discounted_unit numeric;
begin
  if _price is null then return _price; end if;
  if jsonb_array_length(coalesce(_price->'validation_errors','[]'::jsonb)) > 0 then return _price; end if;
  if _price->>'final_total' is null then return _price; end if;

  _base_total := coalesce((_price->>'base_total')::numeric,0);
  _original_total := coalesce((_price->>'final_total')::numeric,0);
  _original_unit := coalesce((_price->>'final_unit_price')::numeric,coalesce((_price->>'base_price')::numeric,0));
  _promo := private.best_catalog_promotion(_store_id,_product_id,_base_total,_quantity,_at);

  if _promo is null then
    return jsonb_set(
      jsonb_set(_price,'{original_total}',to_jsonb(private.money(_original_total)),true),
      '{discount_total}',to_jsonb(0::numeric),true
    );
  end if;

  _discount := coalesce((_promo->>'discount_total')::numeric,0);
  _discounted_total := private.money(greatest(0,_original_total-_discount));
  _discounted_unit := case
    when coalesce(_quantity,0) > 0 then private.money(greatest(0,_original_unit-(_discount/_quantity)))
    else _original_unit
  end;

  _price := jsonb_set(_price,'{original_total}',to_jsonb(private.money(_original_total)),true);
  _price := jsonb_set(_price,'{discount_total}',to_jsonb(private.money(_discount)),true);
  _price := jsonb_set(_price,'{final_total}',to_jsonb(_discounted_total),true);
  _price := jsonb_set(_price,'{final_unit_price}',to_jsonb(_discounted_unit),true);
  _price := jsonb_set(_price,'{promotion}',_promo,true);
  return _price;
end;
$$;

revoke all on function private.apply_catalog_promotion_to_price(uuid,uuid,numeric,jsonb,timestamptz) from public,anon,authenticated;

create or replace function public.storefront_price_with_promotions(
  _slug text,
  _product_id uuid,
  _variant_id uuid default null,
  _quantity numeric default 1,
  _selections jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _base jsonb;
  _store_id uuid;
  _result jsonb;
begin
  _base := public.storefront_price(_slug,_product_id,_variant_id,_quantity,_selections);
  if not coalesce((_base->>'ok')::boolean,false) then return _base; end if;

  select s.id into _store_id
    from public.stores s
   where s.slug=public.storefront_normalize_slug(_slug) and s.status='ativa'
   limit 1;
  if _store_id is null then return _base; end if;

  _result := private.apply_catalog_promotion_to_price(
    _store_id,
    _product_id,
    _quantity,
    coalesce(_base->'result','{}'::jsonb),
    now()
  );
  return jsonb_set(_base,'{result}',_result,true);
end;
$$;

revoke all on function public.storefront_price_with_promotions(text,uuid,uuid,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.storefront_price_with_promotions(text,uuid,uuid,numeric,jsonb) to service_role;

create or replace function public.storefront_active_promotions(_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _store_id uuid;
begin
  select s.id into _store_id
    from public.stores s
   where s.slug=public.storefront_normalize_slug(_slug) and s.status='ativa'
   limit 1;
  if _store_id is null then return jsonb_build_object('products','[]'::jsonb); end if;

  return jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', p.id,
        'promotion', promo.value
      ) order by p.sort_order,p.name)
      from public.products p
      cross join lateral (
        select private.best_catalog_promotion(
          _store_id,
          p.id,
          greatest(0,coalesce((select min(v.price) from public.product_variants v where v.store_id=_store_id and v.product_id=p.id and v.is_available and not v.is_archived),p.base_price)),
          case when p.sale_mode::text='measured' then greatest(coalesce(p.minimum_quantity,1),0.000001) else 1 end,
          now()
        ) as value
      ) promo
      where p.store_id=_store_id
        and not p.is_archived
        and promo.value is not null
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.storefront_active_promotions(text) from public,anon,authenticated;
grant execute on function public.storefront_active_promotions(text) to service_role;

create or replace function private.finalize_public_order_catalog_promotions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _item record;
  _promo jsonb;
  _discount numeric;
  _discount_sum numeric := 0;
begin
  if new.source is distinct from 'publico' then return new; end if;
  if old.catalog_pricing_finalized_at is not null or new.catalog_pricing_finalized_at is not null then return new; end if;

  for _item in
    select oi.id,oi.product_id,oi.line_total,oi.options_total,oi.quantity
      from public.order_items oi
     where oi.store_id=new.store_id and oi.order_id=new.id and oi.product_id is not null
     order by oi.sort_order,oi.id
  loop
    _promo := private.best_catalog_promotion(
      new.store_id,
      _item.product_id,
      greatest(0,coalesce(_item.line_total,0)-coalesce(_item.options_total,0)),
      _item.quantity,
      now()
    );
    _discount := least(coalesce(_item.line_total,0),coalesce((_promo->>'discount_total')::numeric,0));

    update public.order_items oi
       set discount_total=private.money(_discount),
           promotion_id=nullif(_promo->>'id','')::uuid,
           promotion_name=nullif(_promo->>'name',''),
           promotion_snapshot=case when _promo is null then null else _promo end
     where oi.id=_item.id and oi.store_id=new.store_id;

    _discount_sum := _discount_sum + _discount;
  end loop;

  new.discount_total := private.money(least(coalesce(new.items_subtotal,0),_discount_sum));
  new.total_amount := private.money(greatest(0,coalesce(new.items_subtotal,0)+coalesce(new.delivery_fee,0)-new.discount_total));
  new.catalog_pricing_finalized_at := now();
  return new;
end;
$$;

revoke all on function private.finalize_public_order_catalog_promotions() from public,anon,authenticated;

drop trigger if exists trg_finalize_public_order_catalog_promotions on public.orders;
create trigger trg_finalize_public_order_catalog_promotions
before update of items_subtotal,delivery_fee,total_amount on public.orders
for each row
when (old.catalog_pricing_finalized_at is null)
execute function private.finalize_public_order_catalog_promotions();

create or replace function public.list_my_catalog_promotions(
  _store_id uuid default null,
  _include_archived boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _sid uuid := private.resolve_store(_store_id);
begin
  perform private.require_permission('catalog.update',_sid);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',pr.id,
      'name',pr.name,
      'description',pr.description,
      'kind',pr.kind,
      'value',pr.value,
      'max_discount_amount',pr.max_discount_amount,
      'product_id',pr.product_id,
      'product_name',p.name,
      'category_id',pr.category_id,
      'category_name',c.name,
      'starts_at',pr.starts_at,
      'ends_at',pr.ends_at,
      'is_active',pr.is_active,
      'is_archived',pr.is_archived,
      'runtime_active',pr.is_active and not pr.is_archived and (pr.starts_at is null or pr.starts_at<=now()) and (pr.ends_at is null or pr.ends_at>now()),
      'created_at',pr.created_at,
      'updated_at',pr.updated_at
    ) order by pr.is_archived,pr.created_at desc,pr.id)
    from public.promotions pr
    left join public.products p on p.id=pr.product_id and p.store_id=pr.store_id
    left join public.categories c on c.id=pr.category_id and c.store_id=pr.store_id
    where pr.store_id=_sid and (_include_archived or not pr.is_archived)
  ),'[]'::jsonb);
end;
$$;

revoke all on function public.list_my_catalog_promotions(uuid,boolean) from public,anon;
grant execute on function public.list_my_catalog_promotions(uuid,boolean) to authenticated;

create or replace function public.create_catalog_promotion(
  _store_id uuid,
  _name text,
  _description text,
  _kind public.promotion_type,
  _value numeric,
  _max_discount_amount numeric default null,
  _product_id uuid default null,
  _category_id uuid default null,
  _starts_at timestamptz default null,
  _ends_at timestamptz default null,
  _is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _sid uuid := private.resolve_store(_store_id);
  _row public.promotions;
begin
  perform private.require_permission('catalog.update',_sid);

  if length(btrim(coalesce(_name,''))) < 2 or length(btrim(_name)) > 100 then
    raise exception 'INVALID_PROMOTION_NAME' using errcode='P0001';
  end if;
  if _value is null or _value<=0 or (_kind='percentual' and _value>100) then
    raise exception 'INVALID_PROMOTION_VALUE' using errcode='P0001';
  end if;
  if _max_discount_amount is not null and _max_discount_amount<=0 then
    raise exception 'INVALID_PROMOTION_CAP' using errcode='P0001';
  end if;
  if _product_id is not null and _category_id is not null then
    raise exception 'INVALID_PROMOTION_SCOPE' using errcode='P0001';
  end if;
  if _starts_at is not null and _ends_at is not null and _ends_at<=_starts_at then
    raise exception 'INVALID_PROMOTION_WINDOW' using errcode='P0001';
  end if;
  if _product_id is not null and not exists(select 1 from public.products p where p.store_id=_sid and p.id=_product_id and not p.is_archived) then
    raise exception 'PRODUCT_NOT_FOUND' using errcode='P0001';
  end if;
  if _category_id is not null and not exists(select 1 from public.categories c where c.store_id=_sid and c.id=_category_id and not c.is_archived) then
    raise exception 'CATEGORY_NOT_FOUND' using errcode='P0001';
  end if;

  insert into public.promotions(store_id,name,description,kind,value,max_discount_amount,product_id,category_id,starts_at,ends_at,is_active,is_archived)
  values(_sid,btrim(_name),nullif(btrim(coalesce(_description,'')),''),_kind,_value,_max_discount_amount,_product_id,_category_id,_starts_at,_ends_at,coalesce(_is_active,true),false)
  returning * into _row;

  perform private.log_config_audit(_sid,'catalog.promotion.created','promotions',_row.id,array['name','kind','value','scope','window']);
  return (public.list_my_catalog_promotions(_sid,false)->0);
end;
$$;

revoke all on function public.create_catalog_promotion(uuid,text,text,public.promotion_type,numeric,numeric,uuid,uuid,timestamptz,timestamptz,boolean) from public,anon;
grant execute on function public.create_catalog_promotion(uuid,text,text,public.promotion_type,numeric,numeric,uuid,uuid,timestamptz,timestamptz,boolean) to authenticated;

create or replace function public.set_catalog_promotion_active(
  _store_id uuid,
  _id uuid,
  _is_active boolean,
  _expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _sid uuid := private.resolve_store(_store_id);
  _row public.promotions;
begin
  perform private.require_permission('catalog.update',_sid);
  select * into _row from public.promotions pr where pr.store_id=_sid and pr.id=_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  if _row.is_archived then raise exception 'PROMOTION_ARCHIVED' using errcode='P0001'; end if;
  perform private.assert_version(_expected_updated_at,_row.updated_at);
  update public.promotions set is_active=_is_active where store_id=_sid and id=_id returning * into _row;
  perform private.log_config_audit(_sid,'catalog.promotion.active_changed','promotions',_id,array['is_active']);
  return jsonb_build_object('id',_row.id,'is_active',_row.is_active,'updated_at',_row.updated_at);
end;
$$;

revoke all on function public.set_catalog_promotion_active(uuid,uuid,boolean,timestamptz) from public,anon;
grant execute on function public.set_catalog_promotion_active(uuid,uuid,boolean,timestamptz) to authenticated;

create or replace function public.archive_catalog_promotion(
  _store_id uuid,
  _id uuid,
  _expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _sid uuid := private.resolve_store(_store_id);
  _row public.promotions;
begin
  perform private.require_permission('catalog.update',_sid);
  select * into _row from public.promotions pr where pr.store_id=_sid and pr.id=_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  perform private.assert_version(_expected_updated_at,_row.updated_at);
  update public.promotions set is_archived=true,is_active=false where store_id=_sid and id=_id returning * into _row;
  perform private.log_config_audit(_sid,'catalog.promotion.archived','promotions',_id,array['is_archived','is_active']);
  return jsonb_build_object('id',_row.id,'is_archived',true,'updated_at',_row.updated_at);
end;
$$;

revoke all on function public.archive_catalog_promotion(uuid,uuid,timestamptz) from public,anon;
grant execute on function public.archive_catalog_promotion(uuid,uuid,timestamptz) to authenticated;

create or replace function public.simulate_catalog_promotion(
  _store_id uuid,
  _kind public.promotion_type,
  _value numeric,
  _max_discount_amount numeric default null,
  _product_id uuid default null,
  _category_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _sid uuid := private.resolve_store(_store_id);
  _result jsonb;
begin
  perform private.require_permission('catalog.update',_sid);
  perform private.require_permission('reports.view_operational',_sid);
  if _value is null or _value<=0 or (_kind='percentual' and _value>100) then raise exception 'INVALID_PROMOTION_VALUE' using errcode='P0001'; end if;
  if _product_id is not null and _category_id is not null then raise exception 'INVALID_PROMOTION_SCOPE' using errcode='P0001'; end if;

  with scoped as (
    select p.id,p.name,p.base_price,p.unit_cost,p.has_variants,
      least(
        p.base_price,
        coalesce(_max_discount_amount,999999999::numeric),
        case when _kind='percentual' then private.money(p.base_price*_value/100) else least(p.base_price,_value) end
      ) as discount
    from public.products p
    where p.store_id=_sid and not p.is_archived
      and (_product_id is null or p.id=_product_id)
      and (_category_id is null or p.category_id=_category_id)
  ), calc as (
    select *,private.money(base_price-discount) as promotional_price,
      case when unit_cost is null or base_price-discount<=0 then null
           else round((((base_price-discount)-unit_cost)/(base_price-discount)*100)::numeric,2) end as margin_percent
    from scoped
  )
  select jsonb_build_object(
    'products',count(*)::int,
    'products_with_cost',count(*) filter(where unit_cost is not null)::int,
    'variant_products',count(*) filter(where has_variants)::int,
    'negative_margin_products',count(*) filter(where margin_percent<0)::int,
    'low_margin_products',count(*) filter(where margin_percent>=0 and margin_percent<20)::int,
    'minimum_margin_percent',min(margin_percent),
    'average_margin_percent',round(avg(margin_percent),2),
    'items',coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'name',name,'base_price',base_price,'unit_cost',unit_cost,'discount',discount,'promotional_price',promotional_price,'margin_percent',margin_percent,'has_variants',has_variants
    ) order by margin_percent nulls last,name) filter(where unit_cost is not null),'[]'::jsonb)
  ) into _result from calc;
  return _result;
end;
$$;

revoke all on function public.simulate_catalog_promotion(uuid,public.promotion_type,numeric,numeric,uuid,uuid) from public,anon;
grant execute on function public.simulate_catalog_promotion(uuid,public.promotion_type,numeric,numeric,uuid,uuid) to authenticated;

create or replace function public.get_catalog_menu_intelligence(
  _store_id uuid default null,
  _days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _sid uuid := private.resolve_store(_store_id);
  _period integer := coalesce(_days, 30);
  _result jsonb;
begin
  perform private.require_permission('reports.view_operational', _sid);
  if _period < 7 or _period > 365 then raise exception 'INVALID_PERIOD' using errcode = 'P0001'; end if;

  with valid_orders as (
    select o.id from public.orders o
     where o.store_id=_sid
       and o.created_at>=now()-make_interval(days=>_period)
       and o.status not in ('recusado','cancelado')
       and private.order_payment_operational_ready(o.payment_method_kind,o.payment_status)
  ), sales as (
    select oi.product_id,
      count(distinct oi.order_id)::integer as order_count,
      coalesce(sum(oi.quantity),0)::numeric as sold_quantity,
      coalesce(sum(oi.line_total-coalesce(oi.discount_total,0)),0)::numeric as revenue,
      coalesce(sum(coalesce(oi.discount_total,0)),0)::numeric as discounts
    from public.order_items oi join valid_orders vo on vo.id=oi.order_id
    where oi.store_id=_sid and oi.product_id is not null
    group by oi.product_id
  ), rows as (
    select p.id,p.category_id,c.name as category_name,p.name,p.base_price,p.unit_cost,p.has_variants,p.is_available as is_active,p.is_sold_out,
      coalesce(s.order_count,0) as order_count,coalesce(s.sold_quantity,0)::numeric as sold_quantity,coalesce(s.revenue,0)::numeric as revenue,coalesce(s.discounts,0)::numeric as discounts,
      case when p.unit_cost is null then null else round((coalesce(s.sold_quantity,0)*p.unit_cost)::numeric,2) end as estimated_cost,
      case when p.unit_cost is null then null else round((coalesce(s.revenue,0)-(coalesce(s.sold_quantity,0)*p.unit_cost))::numeric,2) end as estimated_margin,
      case when p.unit_cost is null or coalesce(s.revenue,0)<=0 then null else round((((coalesce(s.revenue,0)-(coalesce(s.sold_quantity,0)*p.unit_cost))/s.revenue)*100)::numeric,2) end as estimated_margin_percent
    from public.products p left join public.categories c on c.id=p.category_id and c.store_id=p.store_id left join sales s on s.product_id=p.id
    where p.store_id=_sid and not p.is_archived
  ), summary as (
    select (select count(*)::integer from valid_orders) as order_count,count(*)::integer as product_count,
      count(*) filter(where unit_cost is not null)::integer as configured_cost_products,count(*) filter(where unit_cost is null)::integer as products_without_cost,
      count(*) filter(where unit_cost is null and sold_quantity>0)::integer as sold_products_without_cost,
      coalesce(sum(revenue),0)::numeric as revenue,coalesce(sum(discounts),0)::numeric as discounts,
      coalesce(sum(revenue) filter(where unit_cost is not null),0)::numeric as revenue_with_cost,
      coalesce(sum(estimated_cost) filter(where unit_cost is not null),0)::numeric as estimated_cost,
      coalesce(sum(estimated_margin) filter(where unit_cost is not null),0)::numeric as estimated_margin
    from rows
  )
  select jsonb_build_object(
    'period_days',_period,'cost_scope','base_product_only',
    'summary',jsonb_build_object('orders',s.order_count,'products',s.product_count,'configured_cost_products',s.configured_cost_products,'products_without_cost',s.products_without_cost,'sold_products_without_cost',s.sold_products_without_cost,'revenue',round(s.revenue,2),'discounts',round(s.discounts,2),'revenue_with_cost',round(s.revenue_with_cost,2),'cost_coverage_percent',case when s.revenue<=0 then 0 else round((s.revenue_with_cost/s.revenue)*100,2) end,'estimated_cost',round(s.estimated_cost,2),'estimated_margin',round(s.estimated_margin,2),'estimated_margin_percent',case when s.revenue_with_cost<=0 then null else round((s.estimated_margin/s.revenue_with_cost)*100,2) end),
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'category_id',r.category_id,'category_name',r.category_name,'name',r.name,'base_price',r.base_price,'unit_cost',r.unit_cost,'has_variants',r.has_variants,'is_active',r.is_active,'is_sold_out',r.is_sold_out,'orders',r.order_count,'sold_quantity',r.sold_quantity,'revenue',round(r.revenue,2),'discounts',round(r.discounts,2),'estimated_cost',r.estimated_cost,'estimated_margin',r.estimated_margin,'estimated_margin_percent',r.estimated_margin_percent) order by r.revenue desc,r.sold_quantity desc,r.name,r.id) from rows r),'[]'::jsonb)
  ) into _result from summary s;
  return _result;
end;
$$;

revoke all on function public.get_catalog_menu_intelligence(uuid,integer) from public,anon;
grant execute on function public.get_catalog_menu_intelligence(uuid,integer) to authenticated;

commit;
