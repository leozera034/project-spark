-- SHARK — semântica e ordem dos rascunhos de lanche.
-- Afeta somente grupos ainda marcados como shark_draft.

do $$
declare
  _p record;
  _g record;
  _name text;
  _order integer;
begin
  for _p in
    select id,store_id
    from public.products
    where product_type='buildable'
      and coalesce((capabilities->>'burger_experience')::boolean,false)=true
      and not is_archived
  loop
    for _g in
      select og.id,og.role,og.configuration
      from public.product_option_groups pog
      join public.option_groups og on og.id=pog.option_group_id and og.store_id=pog.store_id
      where pog.product_id=_p.id and pog.store_id=_p.store_id and not pog.is_archived
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
            configuration=configuration||jsonb_build_object('experience','burger','experience_order',_order),
            updated_at=now()
        where id=_g.id and store_id=_p.store_id;

        update public.product_option_groups
        set sort_order=_order,updated_at=now()
        where store_id=_p.store_id and product_id=_p.id and option_group_id=_g.id;
      end if;
    end loop;
  end loop;
end $$;

-- Função idempotente para produtos criados depois desta migration.
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
  if coalesce((_p.capabilities->>'burger_experience')::boolean,false)=false then
    return jsonb_build_object('updated_count',0);
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
      when 'bread' then 10 when 'protein' then 20 when 'doneness' then 30 when 'sauce' then 40
      when 'addon' then 50 when 'removal' then 60 when 'side' then 70 when 'beverage' then 80 else 100 end;
    if _name is not null then
      update public.option_groups
      set name=_name,sort_order=_order,
          description='Rascunho sugerido pelo Shark para montagem de lanche. Edite e publique quando estiver pronto.',
          configuration=configuration||jsonb_build_object('experience','burger','experience_order',_order),updated_at=now()
      where id=_g.id and store_id=_sid;
      update public.product_option_groups set sort_order=_order,updated_at=now()
      where store_id=_sid and product_id=_p.id and option_group_id=_g.id;
      _count:=_count+1;
    end if;
  end loop;
  return jsonb_build_object('updated_count',_count);
end;
$$;

grant execute on function public.apply_shark_buildable_experience_drafts(uuid,uuid) to authenticated;
revoke all on function public.apply_shark_buildable_experience_drafts(uuid,uuid) from anon;
