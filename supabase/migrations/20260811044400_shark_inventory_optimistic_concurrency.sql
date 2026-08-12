-- SHARK — concorrência otimista no ajuste manual de estoque.
-- Evita que uma tela antiga sobrescreva uma baixa feita por checkout concorrente.

create or replace function public.get_product_inventory(_store_id uuid,_product_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare
  _sid uuid:=private.resolve_store(_store_id);
  p public.products;
begin
  perform private.require_permission('catalog.view',_sid);
  select * into p
  from public.products
  where id=_product_id and store_id=_sid and not is_archived;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;

  return jsonb_build_object(
    'managed',p.stock_quantity is not null,
    'quantity',p.stock_quantity,
    'low_stock_threshold',p.low_stock_threshold,
    'is_low',p.stock_quantity is not null and p.stock_quantity <= p.low_stock_threshold,
    'is_empty',p.stock_quantity is not null and p.stock_quantity <= 0,
    'updated_at',p.updated_at
  );
end;
$$;

create or replace function public.update_product_inventory_v2(
  _store_id uuid,
  _product_id uuid,
  _managed boolean,
  _quantity numeric,
  _low_stock_threshold numeric,
  _expected_updated_at timestamptz
) returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  _sid uuid:=private.resolve_store(_store_id);
  p public.products;
  q numeric;
  t numeric;
begin
  perform private.require_permission('catalog.update',_sid);

  select * into p
  from public.products
  where id=_product_id and store_id=_sid and not is_archived
  for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;

  if _expected_updated_at is null or p.updated_at is distinct from _expected_updated_at then
    raise exception 'INVENTORY_VERSION_CONFLICT';
  end if;

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
   where id=_product_id and store_id=_sid
   returning * into p;

  perform private.log_config_audit(
    _sid,
    'catalog.product.inventory.updated',
    'products',
    p.id,
    array['stock_quantity','low_stock_threshold']
  );

  return jsonb_build_object(
    'managed',p.stock_quantity is not null,
    'quantity',p.stock_quantity,
    'low_stock_threshold',p.low_stock_threshold,
    'is_low',p.stock_quantity is not null and p.stock_quantity <= p.low_stock_threshold,
    'is_empty',p.stock_quantity is not null and p.stock_quantity <= 0,
    'updated_at',p.updated_at
  );
end;
$$;

grant execute on function public.update_product_inventory_v2(uuid,uuid,boolean,numeric,numeric,timestamptz) to authenticated;
revoke all on function public.update_product_inventory_v2(uuid,uuid,boolean,numeric,numeric,timestamptz) from anon;

comment on function public.update_product_inventory_v2(uuid,uuid,boolean,numeric,numeric,timestamptz) is
  'Ajuste manual de estoque com optimistic concurrency. Rejeita snapshots anteriores a qualquer venda ou ajuste concorrente.';
