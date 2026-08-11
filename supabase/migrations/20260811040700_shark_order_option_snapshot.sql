-- SHARK — preserva semântica da montagem no pedido gravado.
-- Totais continuam vindo do motor canônico; estes campos são snapshots estruturais
-- para cozinha, suporte e futuras integrações sem depender da configuração atual.

alter table public.order_item_options add column if not exists option_role text;
alter table public.order_item_options add column if not exists linked_product_id uuid;
alter table public.order_item_options add column if not exists linked_variant_id uuid;
alter table public.order_item_options add column if not exists engine_metadata jsonb not null default '{}'::jsonb;

create or replace function private.snapshot_order_item_option_engine()
returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  oi public.option_items;
  og public.option_groups;
  lp text;
  lv text;
begin
  if new.option_item_id is null then return new; end if;

  select * into oi from public.option_items
  where id=new.option_item_id and store_id=new.store_id;
  if not found then return new; end if;

  select * into og from public.option_groups
  where id=oi.option_group_id and store_id=new.store_id;

  if oi.linked_product_id is not null then
    select name into lp from public.products where id=oi.linked_product_id and store_id=new.store_id;
  end if;
  if oi.linked_variant_id is not null then
    select name into lv from public.product_variants where id=oi.linked_variant_id and store_id=new.store_id;
  end if;

  new.option_role := coalesce(og.role,'generic');
  new.linked_product_id := oi.linked_product_id;
  new.linked_variant_id := oi.linked_variant_id;
  new.engine_metadata := coalesce(oi.metadata,'{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'linked_product_name',lp,
    'linked_variant_name',lv,
    'included_selections',og.included_selections,
    'group_configuration',og.configuration
  ));
  return new;
end; $$;

drop trigger if exists trg_snapshot_order_item_option_engine on public.order_item_options;
create trigger trg_snapshot_order_item_option_engine
before insert on public.order_item_options
for each row execute function private.snapshot_order_item_option_engine();

create index if not exists order_item_options_linked_product_idx
  on public.order_item_options(store_id,linked_product_id) where linked_product_id is not null;
