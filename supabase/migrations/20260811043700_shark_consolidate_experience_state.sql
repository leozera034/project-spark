-- SHARK — consolidação do estado final das experiências de produto.
-- Não remove histórico; normaliza o resultado final após as migrations evolutivas anteriores.

-- 1) Um produto não pode ser simultaneamente experiência de lanche e de refeição.
-- Usa contenção JSON para evitar casts frágeis de valores arbitrários.
alter table public.products drop constraint if exists products_shark_experience_exclusive_check;
alter table public.products add constraint products_shark_experience_exclusive_check
  check (not (
    capabilities @> '{"burger_experience":true}'::jsonb
    and capabilities @> '{"meal_experience":true}'::jsonb
  ));

-- 2) Remove o desvio semântico temporário usado antes do storefront consumir hints explícitos.
-- Somente rascunhos gerados pelo Shark são normalizados; configurações publicadas pelo lojista não são tocadas.
update public.option_groups og
set role='side',
    configuration=(og.configuration - 'semantic_role') || jsonb_build_object('experience','burger','experience_order',70),
    updated_at=now()
from public.product_option_groups pog
join public.products p on p.id=pog.product_id and p.store_id=pog.store_id
where og.id=pog.option_group_id and og.store_id=pog.store_id
  and p.capabilities @> '{"burger_experience":true}'::jsonb
  and coalesce((og.configuration->>'shark_draft')::boolean,false)=true
  and og.configuration->>'semantic_role'='side';

-- 3) Mantém a ordem do vínculo sincronizada com a ordem semântica registrada no grupo.
update public.product_option_groups pog
set sort_order=(og.configuration->>'experience_order')::integer,
    updated_at=now()
from public.option_groups og
where og.id=pog.option_group_id and og.store_id=pog.store_id
  and coalesce((og.configuration->>'shark_draft')::boolean,false)=true
  and (og.configuration->>'experience_order') ~ '^[0-9]+$'
  and pog.sort_order is distinct from (og.configuration->>'experience_order')::integer;

-- 4) Reinstala a versão canônica final do normalizador de rascunhos de lanche.
create or replace function public.apply_shark_buildable_experience_drafts(_store_id uuid,_product_id uuid)
returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _p public.products;
  _g record;
  _name text;
  _order integer;
  _count integer:=0;
begin
  perform private.require_permission('catalog.update',_sid);
  select * into _p from public.products where id=_product_id and store_id=_sid and not is_archived;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;

  if not (_p.capabilities @> '{"burger_experience":true}'::jsonb) then
    return jsonb_build_object('updated_count',0);
  end if;
  if _p.capabilities @> '{"meal_experience":true}'::jsonb then
    raise exception 'CONFLICTING_PRODUCT_EXPERIENCE';
  end if;

  for _g in
    select og.id,og.role
    from public.product_option_groups pog
    join public.option_groups og on og.id=pog.option_group_id and og.store_id=pog.store_id
    where pog.product_id=_p.id and pog.store_id=_sid and not pog.is_archived
      and coalesce((og.configuration->>'shark_draft')::boolean,false)=true
  loop
    _name := case _g.role
      when 'bread' then 'Escolha o pão'
      when 'protein' then 'Hambúrguer / carne'
      when 'doneness' then 'Ponto da carne'
      when 'sauce' then 'Molhos'
      when 'addon' then 'Adicionais'
      when 'removal' then 'Retirar ingredientes'
      when 'side' then 'Acompanhamento'
      when 'beverage' then 'Bebida'
      else null
    end;

    _order := case _g.role
      when 'bread' then 10
      when 'protein' then 20
      when 'doneness' then 30
      when 'sauce' then 40
      when 'addon' then 50
      when 'removal' then 60
      when 'side' then 70
      when 'beverage' then 80
      else 100
    end;

    if _name is not null then
      update public.option_groups
      set name=_name,
          sort_order=_order,
          description='Rascunho sugerido pelo Shark para montagem de lanche. Edite e publique quando estiver pronto.',
          configuration=(configuration - 'semantic_role') || jsonb_build_object(
            'experience','burger',
            'experience_order',_order
          ),
          updated_at=now()
      where id=_g.id and store_id=_sid;

      update public.product_option_groups
      set sort_order=_order,updated_at=now()
      where store_id=_sid and product_id=_p.id and option_group_id=_g.id;

      _count:=_count+1;
    end if;
  end loop;

  return jsonb_build_object('updated_count',_count);
end;
$$;

grant execute on function public.apply_shark_buildable_experience_drafts(uuid,uuid) to authenticated;
revoke all on function public.apply_shark_buildable_experience_drafts(uuid,uuid) from anon;

comment on function public.apply_shark_buildable_experience_drafts(uuid,uuid) is
  'Versão canônica consolidada: organiza somente rascunhos burger_experience, preservando role=side real e rejeitando hints conflitantes.';
