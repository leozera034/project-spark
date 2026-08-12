-- SHARK — integridade forte das regras de grupo por tamanho.
-- A RPC valida a entrada, mas a tabela também deve proteger tenant, vínculos e
-- limites efetivos após os fallbacks para o grupo base.

alter table public.product_variant_option_group_rules
  add constraint pvogr_product_store_fk
  foreign key (product_id,store_id)
  references public.products(id,store_id)
  on delete cascade;

alter table public.product_variant_option_group_rules
  add constraint pvogr_variant_store_fk
  foreign key (product_variant_id,store_id)
  references public.product_variants(id,store_id)
  on delete cascade;

alter table public.product_variant_option_group_rules
  add constraint pvogr_group_store_fk
  foreign key (option_group_id,store_id)
  references public.option_groups(id,store_id)
  on delete cascade;

create or replace function private.validate_shark_variant_group_rule()
returns trigger
language plpgsql
set search_path=public,private,pg_temp
as $$
declare
  _variant_product uuid;
  _base_min integer;
  _base_max integer;
  _base_included integer;
  _effective_min integer;
  _effective_max integer;
  _effective_included integer;
begin
  select v.product_id
    into _variant_product
  from public.product_variants v
  where v.id=new.product_variant_id
    and v.store_id=new.store_id
    and not v.is_archived;

  if _variant_product is null or _variant_product<>new.product_id then
    raise exception 'VARIANT_PRODUCT_MISMATCH';
  end if;

  select
    coalesce(pog.min_selections,og.min_selections),
    coalesce(pog.max_selections,og.max_selections),
    og.included_selections
    into _base_min,_base_max,_base_included
  from public.product_option_groups pog
  join public.option_groups og
    on og.id=pog.option_group_id and og.store_id=pog.store_id
  where pog.store_id=new.store_id
    and pog.product_id=new.product_id
    and pog.option_group_id=new.option_group_id
    and not pog.is_archived
    and not og.is_archived
  limit 1;

  if not found then
    raise exception 'GROUP_PRODUCT_MISMATCH';
  end if;

  _effective_min:=coalesce(new.min_selections,_base_min,0);
  _effective_max:=coalesce(new.max_selections,_base_max,1);
  _effective_included:=coalesce(new.included_selections,_base_included,0);

  if _effective_min<0 or _effective_max<1 or _effective_min>_effective_max then
    raise exception 'INVALID_EFFECTIVE_SELECTION_BOUNDS';
  end if;

  if _effective_included<0 or _effective_included>_effective_max then
    raise exception 'INVALID_EFFECTIVE_INCLUDED_BOUNDS';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_shark_variant_group_rule() from public,anon,authenticated;

drop trigger if exists trg_shark_validate_variant_group_rule
  on public.product_variant_option_group_rules;
create trigger trg_shark_validate_variant_group_rule
before insert or update
on public.product_variant_option_group_rules
for each row execute function private.validate_shark_variant_group_rule();

comment on function private.validate_shark_variant_group_rule() is
  'Valida tenant, pertencimento produto-variação-grupo e limites efetivos após fallbacks da regra por tamanho.';
