-- SHARK — publicação segura de grupos sugeridos.
-- A UI ajuda o lojista, mas a regra final é validada no banco.

create or replace function public.publish_shark_option_group(
  _store_id uuid,
  _group_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _group public.option_groups;
  _active_items integer;
begin
  perform private.require_permission('catalog.update',_sid);

  select * into _group
  from public.option_groups
  where id=_group_id and store_id=_sid
  for update;

  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if _group.is_archived then raise exception 'GROUP_ARCHIVED'; end if;
  if _group.min_selections < 0 or _group.max_selections < 1 or _group.min_selections > _group.max_selections then
    raise exception 'INVALID_SELECTION_LIMITS';
  end if;
  if coalesce(_group.included_selections,0) < 0 or coalesce(_group.included_selections,0) > _group.max_selections then
    raise exception 'INVALID_INCLUDED_SELECTIONS';
  end if;

  select count(*)::integer into _active_items
  from public.option_items item
  where item.store_id=_sid
    and item.option_group_id=_group_id
    and item.is_available
    and not item.is_archived;

  if _active_items = 0 then raise exception 'GROUP_WITHOUT_ITEMS'; end if;
  if _active_items < _group.min_selections then raise exception 'GROUP_MINIMUM_UNREACHABLE'; end if;
  if _group.is_required and _group.min_selections < 1 then raise exception 'GROUP_REQUIRED_WITHOUT_MINIMUM'; end if;

  update public.option_groups
     set is_active=true,
         configuration=(coalesce(configuration,'{}'::jsonb) - 'shark_draft') || jsonb_build_object('shark_published_at',now()),
         updated_at=now()
   where id=_group_id and store_id=_sid
   returning * into _group;

  perform private.log_config_audit(
    _sid,
    'catalog.option_group.shark_published',
    'option_groups',
    _group_id,
    array['is_active','configuration']
  );

  return private.catalog_option_group_json(_group);
end;
$$;

grant execute on function public.publish_shark_option_group(uuid,uuid) to authenticated;
revoke all on function public.publish_shark_option_group(uuid,uuid) from anon;

comment on function public.publish_shark_option_group(uuid,uuid) is
  'Publica grupo somente após validar opções ativas, mínimo/máximo, obrigatoriedade e escolhas incluídas.';
