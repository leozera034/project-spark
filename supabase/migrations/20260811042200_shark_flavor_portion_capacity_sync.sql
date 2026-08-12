-- SHARK — sincroniza capacidade do grupo/itens de sabor com as porções dos tamanhos.

create or replace function private.sync_product_flavor_group_capacity(_sid uuid,_product_id uuid)
returns void language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  _max_parts integer;
begin
  select max(coalesce(v.flavor_parts,v.max_flavors,1)) into _max_parts
  from public.product_variants v
  where v.store_id=_sid and v.product_id=_product_id
    and v.is_available and not v.is_archived;

  if _max_parts is null then return; end if;

  update public.option_groups og
     set selection_type='quantidade',
         allow_quantity=true,
         max_selections=greatest(1,_max_parts),
         portion_count=null,
         updated_at=now()
  from public.product_option_groups pog
  where pog.store_id=_sid and pog.product_id=_product_id
    and pog.option_group_id=og.id and og.store_id=_sid
    and pog.is_active and not pog.is_archived
    and not og.is_archived and og.role='flavor';

  update public.option_items oi
     set max_quantity=greatest(oi.max_quantity,_max_parts),
         updated_at=now()
  from public.option_groups og
  join public.product_option_groups pog
    on pog.option_group_id=og.id and pog.store_id=og.store_id
  where pog.store_id=_sid and pog.product_id=_product_id
    and oi.store_id=_sid and oi.option_group_id=og.id
    and not oi.is_archived and not og.is_archived
    and og.role='flavor';
end;
$$;

-- Compatibilidade com produtos já existentes na branch/migration anterior.
do $$
declare r record;
begin
  for r in
    select distinct v.store_id,v.product_id
    from public.product_variants v
    join public.products p on p.id=v.product_id and p.store_id=v.store_id
    where not v.is_archived
      and (v.max_flavors is not null or v.flavor_parts is not null)
      and coalesce((p.capabilities->>'multi_flavor')::boolean,false)
  loop
    perform private.sync_product_flavor_group_capacity(r.store_id,r.product_id);
  end loop;
end;
$$;
