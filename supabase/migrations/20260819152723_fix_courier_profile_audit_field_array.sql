create or replace function public.update_store_courier_profile(
  _store_id uuid,_courier_id uuid,_expected_version integer,_full_name text,_phone text,
  _vehicle text,_can_accept_deliveries boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare _store uuid; _c public.couriers; _u public.couriers; _name text; _phone_digits text; _vehicle_norm text; _fields text[]:='{}';
begin
  _store:=private.resolve_store(_store_id);
  perform private.require_permission('couriers.update',_store);
  select * into _c from public.couriers c where c.id=_courier_id and c.store_id=_store;
  if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  if _expected_version is null or _expected_version<>_c.version then raise exception 'VERSION_CONFLICT' using errcode='P0001'; end if;
  _name:=nullif(btrim(coalesce(_full_name,'')),'');
  if _name is null or length(_name)<3 or length(_name)>80 then raise exception 'INVALID_NAME' using errcode='P0001'; end if;
  _phone_digits:=regexp_replace(coalesce(_phone,''),'\D','','g');
  if length(_phone_digits)<10 or length(_phone_digits)>13 then raise exception 'INVALID_PHONE' using errcode='P0001'; end if;
  _vehicle_norm:=lower(btrim(coalesce(_vehicle,'')));
  if _vehicle_norm not in ('moto','carro') then raise exception 'INVALID_VEHICLE' using errcode='P0001'; end if;
  if _name<>_c.full_name then _fields:=array_append(_fields,'full_name'); end if;
  if _phone_digits<>_c.phone then _fields:=array_append(_fields,'phone'); end if;
  if _vehicle_norm<>_c.vehicle then _fields:=array_append(_fields,'vehicle'); end if;
  if coalesce(_can_accept_deliveries,_c.can_accept_deliveries)<>_c.can_accept_deliveries then _fields:=array_append(_fields,'can_accept_deliveries'); end if;
  update public.couriers c
  set full_name=_name,phone=_phone_digits,vehicle=_vehicle_norm,
      can_accept_deliveries=coalesce(_can_accept_deliveries,c.can_accept_deliveries),
      version=c.version+1,updated_at=now()
  where c.id=_courier_id and c.store_id=_store and c.version=_expected_version returning * into _u;
  if not found then raise exception 'VERSION_CONFLICT' using errcode='P0001'; end if;
  perform private.log_config_audit(_store,'courier.updated','couriers',_courier_id,_fields);
  perform private.emit_store_event(_store,'courier',_courier_id,'courier.updated',_u.version);
  return public.get_my_store_courier_detail(_store,_courier_id);
exception when unique_violation then raise exception 'PHONE_ALREADY_USED' using errcode='P0001';
end;
$$;
revoke all on function public.update_store_courier_profile(uuid,uuid,integer,text,text,text,boolean) from public, anon;
grant execute on function public.update_store_courier_profile(uuid,uuid,integer,text,text,text,boolean) to authenticated, service_role;
