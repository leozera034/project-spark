-- SHARK — operação simples de estoque pelo lojista.

alter table public.products
  add column if not exists low_stock_threshold numeric not null default 5;

alter table public.products
  drop constraint if exists products_low_stock_threshold_check;
alter table public.products
  add constraint products_low_stock_threshold_check check (low_stock_threshold >= 0);

create or replace function public.get_product_inventory(_store_id uuid,_product_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare
  _sid uuid:=private.resolve_store(_store_id);
  p public.products;
begin
  perform private.require_permission('catalog.view',_sid);
  select * into p from public.products
   where id=_product_id and store_id=_sid and not is_archived;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  return jsonb_build_object(
    'managed',p.stock_quantity is not null,
    'quantity',p.stock_quantity,
    'low_stock_threshold',p.low_stock_threshold,
    'is_low',p.stock_quantity is not null and p.stock_quantity <= p.low_stock_threshold,
    'is_empty',p.stock_quantity is not null and p.stock_quantity <= 0
  );
end;
$$;

create or replace function public.update_product_inventory(
  _store_id uuid,
  _product_id uuid,
  _managed boolean,
  _quantity numeric default null,
  _low_stock_threshold numeric default 5
) returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  _sid uuid:=private.resolve_store(_store_id);
  p public.products;
  q numeric;
  t numeric;
begin
  perform private.require_permission('catalog.update',_sid);
  t:=coalesce(_low_stock_threshold,5);
  if t<0 then raise exception 'INVALID_LOW_STOCK_THRESHOLD'; end if;

  if coalesce(_managed,false) then
    q:=coalesce(_quantity,0);
    if q<0 then raise exception 'INVALID_STOCK_QUANTITY'; end if;
  else
    q:=null;
  end if;

  update public.products
     set stock_quantity=q,
         low_stock_threshold=t,
         updated_at=now()
   where id=_product_id and store_id=_sid and not is_archived
   returning * into p;

  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;

  perform private.log_config_audit(_sid,'catalog.product.inventory.updated','products',p.id,
    array['stock_quantity','low_stock_threshold']);

  return jsonb_build_object(
    'managed',p.stock_quantity is not null,
    'quantity',p.stock_quantity,
    'low_stock_threshold',p.low_stock_threshold,
    'is_low',p.stock_quantity is not null and p.stock_quantity <= p.low_stock_threshold,
    'is_empty',p.stock_quantity is not null and p.stock_quantity <= 0
  );
end;
$$;

grant execute on function public.get_product_inventory(uuid,uuid) to authenticated;
grant execute on function public.update_product_inventory(uuid,uuid,boolean,numeric,numeric) to authenticated;
revoke all on function public.get_product_inventory(uuid,uuid) from anon;
revoke all on function public.update_product_inventory(uuid,uuid,boolean,numeric,numeric) from anon;
