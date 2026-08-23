begin;

create or replace function private.catalog_promotion_negative_margin_count(_promotion_id uuid)
returns integer
language sql
stable
set search_path to ''
as $$
  with pr as (
    select * from public.promotions where id=_promotion_id and not is_archived
  ), eligible as (
    select p.id,p.base_price,p.unit_cost,
      least(
        p.base_price,
        coalesce(pr.max_discount_amount,999999999::numeric),
        case when pr.kind='percentual'
          then private.money(p.base_price*pr.value/100)
          else private.money(pr.value)
        end
      ) as discount
    from pr
    join public.products p on p.store_id=pr.store_id and not p.is_archived
      and (pr.product_id=p.id or (pr.product_id is null and pr.category_id=p.category_id) or (pr.product_id is null and pr.category_id is null))
    where p.unit_cost is not null
  )
  select count(*)::integer from eligible where private.money(base_price-discount) < unit_cost
$$;
revoke all on function private.catalog_promotion_negative_margin_count(uuid) from public,anon,authenticated;

create or replace function public.set_catalog_promotion_active_v2(
  _store_id uuid,
  _id uuid,
  _is_active boolean,
  _expected_updated_at timestamptz default null,
  _acknowledge_negative_margin boolean default false
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _row public.promotions;
  _negative_count integer:=0;
begin
  perform private.require_permission('catalog.update',_sid);
  select * into _row from public.promotions pr where pr.store_id=_sid and pr.id=_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  if _row.is_archived then raise exception 'PROMOTION_ARCHIVED' using errcode='P0001'; end if;
  perform private.assert_version(_expected_updated_at,_row.updated_at);

  if _is_active then
    _negative_count:=private.catalog_promotion_negative_margin_count(_id);
    if _negative_count>0 and not coalesce(_acknowledge_negative_margin,false) then
      raise exception 'PROMOTION_NEGATIVE_MARGIN_ACK_REQUIRED' using errcode='P0001', detail=_negative_count::text;
    end if;
  end if;

  update public.promotions set is_active=_is_active where store_id=_sid and id=_id returning * into _row;
  perform private.log_config_audit(_sid,
    case when _is_active and _negative_count>0 then 'catalog.promotion.activated_with_margin_risk' else 'catalog.promotion.active_changed' end,
    'promotions',_id,array['is_active']);
  return jsonb_build_object('id',_row.id,'is_active',_row.is_active,'updated_at',_row.updated_at,'negative_margin_products',_negative_count,'margin_risk_acknowledged',(_is_active and _negative_count>0 and coalesce(_acknowledge_negative_margin,false)));
end;
$$;
revoke all on function public.set_catalog_promotion_active_v2(uuid,uuid,boolean,timestamptz,boolean) from public,anon;
grant execute on function public.set_catalog_promotion_active_v2(uuid,uuid,boolean,timestamptz,boolean) to authenticated,service_role;

create or replace function public.create_catalog_promotion_v2(
  _store_id uuid,
  _name text,
  _description text default null,
  _kind text default 'percentual',
  _value numeric default 0,
  _max_discount_amount numeric default null,
  _product_id uuid default null,
  _category_id uuid default null,
  _starts_at timestamptz default null,
  _ends_at timestamptz default null,
  _is_active boolean default true,
  _acknowledge_negative_margin boolean default false
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  _created jsonb;
  _id uuid;
  _updated jsonb;
begin
  _created:=public.create_catalog_promotion(
    _store_id,_name,_description,_kind,_value,_max_discount_amount,
    _product_id,_category_id,_starts_at,_ends_at,false
  );
  _id:=nullif(_created->>'id','')::uuid;
  if _is_active and _id is not null then
    _updated:=public.set_catalog_promotion_active_v2(_store_id,_id,true,null,_acknowledge_negative_margin);
    _created:=_created || jsonb_build_object('is_active',true,'updated_at',_updated->>'updated_at','negative_margin_products',coalesce((_updated->>'negative_margin_products')::integer,0),'margin_risk_acknowledged',coalesce((_updated->>'margin_risk_acknowledged')::boolean,false));
  end if;
  return _created;
end;
$$;
revoke all on function public.create_catalog_promotion_v2(uuid,text,text,text,numeric,numeric,uuid,uuid,timestamptz,timestamptz,boolean,boolean) from public,anon;
grant execute on function public.create_catalog_promotion_v2(uuid,text,text,text,numeric,numeric,uuid,uuid,timestamptz,timestamptz,boolean,boolean) to authenticated,service_role;

commit;
