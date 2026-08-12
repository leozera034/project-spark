-- SHARK — invariantes finais de multi-sabor.
-- A estrutura física da variação é autoridade para quantidade de partes; escrita
-- direta não pode contornar as validações da RPC nem deixar override legado menor.

alter table public.product_variants
  drop constraint if exists product_variants_flavor_structure_check;
alter table public.product_variants
  add constraint product_variants_flavor_structure_check
  check (max_flavors is null or flavor_parts is null or max_flavors <= flavor_parts);

create or replace function private.sync_shark_variant_flavor_capacity()
returns trigger
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
begin
  if new.product_id is null or new.store_id is null then return new; end if;

  -- Para produto multi-sabor, flavor_parts governa a capacidade física. Overrides
  -- antigos no vínculo não podem reduzir artificialmente essa capacidade.
  if exists (
    select 1 from public.products p
    where p.id=new.product_id and p.store_id=new.store_id
      and not p.is_archived
      and coalesce((p.capabilities->>'multi_flavor')::boolean,false)
  ) then
    perform private.sync_product_flavor_group_capacity(new.store_id,new.product_id);

    update public.product_option_groups pog
       set max_selections=null,
           updated_at=now()
      from public.option_groups og
     where pog.store_id=new.store_id
       and pog.product_id=new.product_id
       and pog.option_group_id=og.id
       and og.store_id=pog.store_id
       and not pog.is_archived
       and not og.is_archived
       and og.role='flavor'
       and pog.max_selections is not null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_shark_variant_flavor_capacity on public.product_variants;
create trigger trg_shark_variant_flavor_capacity
after insert or update of max_flavors,flavor_parts,is_available,is_archived
on public.product_variants
for each row
execute function private.sync_shark_variant_flavor_capacity();

-- Normaliza vínculos legados já presentes quando a cadeia for aplicada.
update public.product_option_groups pog
   set max_selections=null,
       updated_at=now()
  from public.option_groups og, public.products p
 where pog.option_group_id=og.id
   and og.store_id=pog.store_id
   and p.id=pog.product_id
   and p.store_id=pog.store_id
   and not pog.is_archived
   and not og.is_archived
   and not p.is_archived
   and og.role='flavor'
   and coalesce((p.capabilities->>'multi_flavor')::boolean,false)
   and pog.max_selections is not null;

revoke all on function private.sync_shark_variant_flavor_capacity() from public,anon,authenticated;

comment on function private.sync_shark_variant_flavor_capacity() is
  'Mantém grupos multi-sabor sincronizados com flavor_parts/max_flavors mesmo em escrita direta e neutraliza max_selections legado no vínculo.';
