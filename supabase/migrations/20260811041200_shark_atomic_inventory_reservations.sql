-- SHARK — reserva atômica de estoque por pedido.
-- Evita overselling entre cotação e checkout concorrente e devolve estoque
-- automaticamente quando o pedido termina como recusado/cancelado.

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  option_item_id uuid references public.option_items(id) on delete restrict,
  source_kind text not null check (source_kind in ('product','option_item','combo_product')),
  quantity numeric not null check (quantity > 0),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  check ((source_kind in ('product','combo_product') and product_id is not null)
      or (source_kind='option_item' and option_item_id is not null))
);

create index if not exists inventory_reservations_order_idx
  on public.inventory_reservations(store_id,order_id) where released_at is null;
create index if not exists inventory_reservations_product_idx
  on public.inventory_reservations(store_id,product_id) where released_at is null and product_id is not null;
create index if not exists inventory_reservations_option_idx
  on public.inventory_reservations(store_id,option_item_id) where released_at is null and option_item_id is not null;

alter table public.inventory_reservations enable row level security;
revoke all on public.inventory_reservations from public,anon,authenticated;
grant all on public.inventory_reservations to service_role;

create or replace function private.reserve_product_inventory(
  _store_id uuid,
  _order_id uuid,
  _order_item_id uuid,
  _product_id uuid,
  _quantity numeric,
  _source_kind text
) returns void
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_has_managed_stock boolean;
begin
  if _quantity is null or _quantity <= 0 then
    raise exception 'INVALID_INVENTORY_QUANTITY';
  end if;

  select stock_quantity is not null into v_has_managed_stock
  from public.products
  where id=_product_id and store_id=_store_id and not is_archived
  for update;

  if not found then raise exception 'INVENTORY_PRODUCT_NOT_FOUND'; end if;
  if not v_has_managed_stock then return; end if;

  update public.products
     set stock_quantity=stock_quantity-_quantity,
         updated_at=now()
   where id=_product_id and store_id=_store_id
     and stock_quantity is not null
     and stock_quantity >= _quantity;

  if not found then raise exception 'PRODUCT_STOCK_INSUFFICIENT'; end if;

  insert into public.inventory_reservations(
    store_id,order_id,order_item_id,product_id,source_kind,quantity
  ) values(
    _store_id,_order_id,_order_item_id,_product_id,_source_kind,_quantity
  );
end;
$$;

create or replace function private.reserve_option_inventory_from_order_item()
returns trigger
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_option public.option_items;
  v_parent_qty numeric;
  v_required numeric;
begin
  select * into v_option
  from public.option_items
  where id=new.option_item_id and store_id=new.store_id
  for update;

  if not found then return new; end if;

  select quantity into v_parent_qty
  from public.order_items
  where id=new.order_item_id and store_id=new.store_id;

  v_required:=greatest(1,new.quantity) * greatest(coalesce(v_parent_qty,1),0);
  if v_required <= 0 then return new; end if;

  if v_option.inventory_quantity is not null then
    update public.option_items
       set inventory_quantity=inventory_quantity-v_required,
           updated_at=now()
     where id=v_option.id and store_id=new.store_id
       and inventory_quantity is not null
       and inventory_quantity >= v_required;
    if not found then raise exception 'OPTION_STOCK_INSUFFICIENT'; end if;

    insert into public.inventory_reservations(
      store_id,order_id,order_item_id,option_item_id,source_kind,quantity
    ) select new.store_id,oi.order_id,new.order_item_id,v_option.id,'option_item',v_required
      from public.order_items oi where oi.id=new.order_item_id;
  end if;

  if v_option.linked_product_id is not null then
    perform private.reserve_product_inventory(
      new.store_id,
      (select oi.order_id from public.order_items oi where oi.id=new.order_item_id),
      new.order_item_id,
      v_option.linked_product_id,
      v_required,
      'combo_product'
    );
  end if;

  return new;
end;
$$;

create or replace function private.reserve_product_inventory_from_order_item()
returns trigger
language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if new.product_id is not null then
    perform private.reserve_product_inventory(
      new.store_id,new.order_id,new.id,new.product_id,new.quantity,'product'
    );
  end if;
  return new;
end;
$$;

create or replace function private.release_order_inventory(_store_id uuid,_order_id uuid)
returns void
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  r public.inventory_reservations;
begin
  for r in
    select * from public.inventory_reservations
    where store_id=_store_id and order_id=_order_id and released_at is null
    order by created_at,id
    for update
  loop
    if r.source_kind in ('product','combo_product') and r.product_id is not null then
      update public.products
         set stock_quantity=stock_quantity+r.quantity,
             updated_at=now()
       where id=r.product_id and store_id=r.store_id and stock_quantity is not null;
    elsif r.source_kind='option_item' and r.option_item_id is not null then
      update public.option_items
         set inventory_quantity=inventory_quantity+r.quantity,
             updated_at=now()
       where id=r.option_item_id and store_id=r.store_id and inventory_quantity is not null;
    end if;

    update public.inventory_reservations set released_at=now() where id=r.id;
  end loop;
end;
$$;

create or replace function private.release_inventory_on_terminal_order()
returns trigger
language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if new.status in ('recusado','cancelado')
     and old.status is distinct from new.status then
    perform private.release_order_inventory(new.store_id,new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_shark_reserve_product_inventory on public.order_items;
create trigger trg_shark_reserve_product_inventory
after insert on public.order_items
for each row execute function private.reserve_product_inventory_from_order_item();

drop trigger if exists trg_shark_reserve_option_inventory on public.order_item_options;
create trigger trg_shark_reserve_option_inventory
after insert on public.order_item_options
for each row execute function private.reserve_option_inventory_from_order_item();

drop trigger if exists trg_shark_release_inventory on public.orders;
create trigger trg_shark_release_inventory
after update of status on public.orders
for each row execute function private.release_inventory_on_terminal_order();

revoke all on function private.reserve_product_inventory(uuid,uuid,uuid,uuid,numeric,text) from public;
revoke all on function private.release_order_inventory(uuid,uuid) from public;

comment on table public.inventory_reservations is
  'SHARK inventory ledger. Stock is reserved atomically during order creation and released once on declined/canceled orders.';
