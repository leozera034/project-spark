-- SHARK — todo sabor novo herda automaticamente a maior capacidade de porções
-- dos produtos aos quais o grupo está ligado.

create or replace function private.apply_flavor_item_capacity()
returns trigger
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  _role text;
  _parts integer;
begin
  select role into _role
  from public.option_groups
  where id=new.option_group_id and store_id=new.store_id;

  if _role is distinct from 'flavor' then return new; end if;

  select max(coalesce(v.flavor_parts,v.max_flavors,1)) into _parts
  from public.product_option_groups pog
  join public.product_variants v
    on v.product_id=pog.product_id and v.store_id=pog.store_id
  where pog.option_group_id=new.option_group_id
    and pog.store_id=new.store_id
    and pog.is_active and not pog.is_archived
    and v.is_available and not v.is_archived;

  new.max_quantity:=greatest(coalesce(new.max_quantity,1),coalesce(_parts,1));
  return new;
end;
$$;

drop trigger if exists trg_shark_flavor_item_capacity on public.option_items;
create trigger trg_shark_flavor_item_capacity
before insert or update of option_group_id,max_quantity
on public.option_items
for each row execute function private.apply_flavor_item_capacity();
