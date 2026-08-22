-- Authoritative manual/automatic merchant opening contract.
-- Run with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/store_manual_open_contract.sql

begin;

do $$
declare
  _uid uuid;
  _sid uuid;
  _other uuid;
  _cfg jsonb;
  _preview jsonb;
  _slug text;
  _public jsonb;
  _forbidden boolean:=false;
  _auto_blocked boolean:=false;
begin
  select r.user_id,r.store_id,s.slug into _uid,_sid,_slug
  from public.user_roles r
  join public.user_profiles p on p.id=r.user_id and p.is_active
  join public.stores s on s.id=r.store_id and s.status='ativa'
  where r.is_active and r.store_id is not null and r.role in ('proprietario','gerente')
    and not private.is_platform_admin_user(r.user_id)
  order by r.created_at limit 1;
  if _uid is null then raise exception 'NO_MANAGER_FOR_MANUAL_OPEN_TEST'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',_uid::text,'role','authenticated')::text,true);

  _cfg:=public.get_my_store_configuration(_sid);
  if not (_cfg#>'{settings}' ? 'manual_override_open') then raise exception 'MANUAL_STATE_NOT_EXPOSED'; end if;

  _cfg:=public.update_store_service_settings(
    _sid,
    (_cfg#>>'{store,accepts_delivery}')::boolean,
    (_cfg#>>'{store,accepts_pickup}')::boolean,
    (_cfg#>>'{settings,min_order_amount}')::numeric,
    greatest((_cfg#>>'{settings,default_prep_minutes}')::integer,1),
    (_cfg#>>'{settings,sound_alert_enabled}')::boolean,
    false,
    (_cfg#>>'{settings,updated_at}')::timestamptz
  );
  if (_cfg#>>'{settings,manual_override_open}')::boolean is distinct from false then raise exception 'MANUAL_MODE_DID_NOT_DEFAULT_CLOSED'; end if;

  _preview:=public.get_store_operational_preview(_sid);
  if (_preview->>'mode')<>'manual' or (_preview->>'is_open')::boolean is not false or _preview->>'reason'<>'fechamento_manual' then raise exception 'MANUAL_CLOSED_PREVIEW_INVALID: %',_preview; end if;
  _public:=public.storefront_store(_slug);
  if (_public->>'is_open')::boolean is not false then raise exception 'PUBLIC_STOREFRONT_IGNORED_MANUAL_CLOSE'; end if;

  _cfg:=public.set_my_store_manual_open(_sid,true,(_cfg#>>'{settings,updated_at}')::timestamptz);
  _preview:=public.get_store_operational_preview(_sid);
  if (_preview->>'mode')<>'manual' or (_preview->>'is_open')::boolean is not true or _preview->>'reason'<>'abertura_manual' then raise exception 'MANUAL_OPEN_PREVIEW_INVALID: %',_preview; end if;
  _public:=public.storefront_store(_slug);
  if (_public->>'is_open')::boolean is not true then raise exception 'PUBLIC_STOREFRONT_IGNORED_MANUAL_OPEN'; end if;

  _cfg:=public.update_store_service_settings(
    _sid,
    (_cfg#>>'{store,accepts_delivery}')::boolean,
    (_cfg#>>'{store,accepts_pickup}')::boolean,
    (_cfg#>>'{settings,min_order_amount}')::numeric,
    greatest((_cfg#>>'{settings,default_prep_minutes}')::integer,1),
    (_cfg#>>'{settings,sound_alert_enabled}')::boolean,
    true,
    (_cfg#>>'{settings,updated_at}')::timestamptz
  );
  if _cfg#>>'{settings,manual_override_open}' is not null then raise exception 'AUTO_MODE_DID_NOT_CLEAR_MANUAL_OVERRIDE'; end if;
  if (public.get_store_operational_preview(_sid)->>'mode')<>'schedule' then raise exception 'AUTO_MODE_PREVIEW_INVALID'; end if;

  begin
    perform public.set_my_store_manual_open(_sid,false,(_cfg#>>'{settings,updated_at}')::timestamptz);
  exception when others then
    if sqlstate='P0001' and sqlerrm='AUTO_OPEN_ENABLED' then _auto_blocked:=true; else raise; end if;
  end;
  if not _auto_blocked then raise exception 'MANUAL_OVERRIDE_ALLOWED_WHILE_AUTO_MODE_ENABLED'; end if;

  select s.id into _other from public.stores s where s.id<>_sid and not private.is_store_manager_user(_uid,s.id) order by s.created_at limit 1;
  if _other is not null then
    begin
      perform public.set_my_store_manual_open(_other,true,null);
    exception when others then
      if sqlstate='42501' or (sqlstate='P0001' and sqlerrm='FORBIDDEN') then _forbidden:=true; else raise; end if;
    end;
    if not _forbidden then raise exception 'CROSS_STORE_MANUAL_OPEN_ALLOWED'; end if;
  end if;
end $$;

select 'manual_store_open_control_contract_passed' as result;
rollback;
