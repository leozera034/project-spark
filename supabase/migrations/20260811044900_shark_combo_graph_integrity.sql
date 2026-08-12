-- SHARK — integridade estrutural final de combos.
-- A UI/RPC não é autoridade suficiente: protege escrita direta e service role contra
-- variação pertencente a outro produto e contra ciclos A -> B -> ... -> A.

create or replace function private.validate_shark_combo_item_integrity()
returns trigger
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  _owner uuid;
  _cycle boolean;
begin
  if new.linked_product_id is null then
    if new.linked_variant_id is not null then
      raise exception 'LINKED_VARIANT_WITHOUT_PRODUCT';
    end if;
    return new;
  end if;

  if new.linked_variant_id is not null and not exists (
    select 1
    from public.product_variants v
    where v.id=new.linked_variant_id
      and v.product_id=new.linked_product_id
      and v.store_id=new.store_id
      and not v.is_archived
  ) then
    raise exception 'LINKED_VARIANT_PRODUCT_MISMATCH';
  end if;

  -- Só referências usadas por grupos de combo participam do grafo.
  if not exists (
    select 1
    from public.option_groups og
    where og.id=new.option_group_id
      and og.store_id=new.store_id
      and not og.is_archived
      and og.role='combo_step'
  ) then
    return new;
  end if;

  -- Um option_group pode ser reutilizado por mais de um produto. Cada vínculo é uma
  -- aresta owner_product -> linked_product e precisa permanecer acíclico.
  for _owner in
    select distinct pog.product_id
    from public.product_option_groups pog
    where pog.store_id=new.store_id
      and pog.option_group_id=new.option_group_id
      and not pog.is_archived
  loop
    if _owner=new.linked_product_id then
      raise exception 'COMBO_SELF_REFERENCE';
    end if;

    with recursive reachable(product_id) as (
      select new.linked_product_id
      union
      select oi.linked_product_id
      from reachable r
      join public.product_option_groups pog
        on pog.store_id=new.store_id
       and pog.product_id=r.product_id
       and not pog.is_archived
      join public.option_groups og
        on og.id=pog.option_group_id
       and og.store_id=pog.store_id
       and not og.is_archived
       and og.role='combo_step'
      join public.option_items oi
        on oi.option_group_id=og.id
       and oi.store_id=og.store_id
       and not oi.is_archived
       and oi.linked_product_id is not null
      where oi.id is distinct from new.id
    )
    select exists(select 1 from reachable where product_id=_owner) into _cycle;

    if _cycle then
      raise exception 'COMBO_CYCLE_DETECTED';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_shark_combo_item_integrity on public.option_items;
create trigger trg_shark_combo_item_integrity
before insert or update of store_id,option_group_id,linked_product_id,linked_variant_id,is_archived
on public.option_items
for each row
execute function private.validate_shark_combo_item_integrity();

revoke all on function private.validate_shark_combo_item_integrity() from public,anon,authenticated;

comment on function private.validate_shark_combo_item_integrity() is
  'Guarda estrutural de combos: linked_variant deve pertencer ao linked_product e o grafo de escolhas combo deve permanecer acíclico.';
