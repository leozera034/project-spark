alter table public.stores
  add column if not exists postal_code text,
  add column if not exists street text,
  add column if not exists neighborhood text,
  add column if not exists address_number text,
  add column if not exists address_complement text;

alter table public.stores
  drop constraint if exists stores_postal_code_format,
  add constraint stores_postal_code_format
    check (postal_code is null or postal_code ~ '^[0-9]{8}$');

create or replace function public.update_store_address(
  _store_id uuid,
  _postal_code text,
  _street text,
  _address_number text,
  _address_complement text,
  _neighborhood text,
  _city text,
  _state text,
  _expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  _sid uuid := private.resolve_store(_store_id);
  _cur public.stores%rowtype;
  _postal text;
  _street_n text;
  _number_n text;
  _complement_n text;
  _neighborhood_n text;
  _city_n text;
  _state_n text;
  _formatted text;
begin
  perform private.require_permission('store.update_profile', _sid);

  select * into _cur
  from public.stores
  where id = _sid
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode='P0001';
  end if;

  perform private.assert_version(_expected_updated_at, _cur.updated_at);

  _postal := nullif(regexp_replace(coalesce(_postal_code, ''), '[^0-9]', '', 'g'), '');
  _street_n := nullif(btrim(coalesce(_street, '')), '');
  _number_n := nullif(btrim(coalesce(_address_number, '')), '');
  _complement_n := nullif(btrim(coalesce(_address_complement, '')), '');
  _neighborhood_n := nullif(btrim(coalesce(_neighborhood, '')), '');
  _city_n := nullif(btrim(coalesce(_city, '')), '');
  _state_n := upper(nullif(btrim(coalesce(_state, '')), ''));

  if _postal is null or length(_postal) <> 8 then
    raise exception 'INVALID_POSTAL_CODE' using errcode='P0001';
  end if;
  if _street_n is null or length(_street_n) < 2 or length(_street_n) > 180 then
    raise exception 'INVALID_STREET' using errcode='P0001';
  end if;
  if _city_n is null or length(_city_n) < 2 or length(_city_n) > 120 then
    raise exception 'INVALID_CITY' using errcode='P0001';
  end if;
  if _state_n is null or _state_n !~ '^[A-Z]{2}$' then
    raise exception 'INVALID_STATE' using errcode='P0001';
  end if;
  if _number_n is not null and length(_number_n) > 40 then
    raise exception 'INVALID_ADDRESS_NUMBER' using errcode='P0001';
  end if;
  if _complement_n is not null and length(_complement_n) > 120 then
    raise exception 'INVALID_ADDRESS_COMPLEMENT' using errcode='P0001';
  end if;
  if _neighborhood_n is not null and length(_neighborhood_n) > 120 then
    raise exception 'INVALID_NEIGHBORHOOD' using errcode='P0001';
  end if;

  _formatted := concat_ws(', ',
    _street_n,
    _number_n,
    _neighborhood_n,
    concat_ws(' - ', _city_n, _state_n),
    _postal
  );

  update public.stores
  set postal_code = _postal,
      street = _street_n,
      address_number = _number_n,
      address_complement = _complement_n,
      neighborhood = _neighborhood_n,
      city = _city_n,
      state = _state_n,
      address_line = _formatted,
      updated_at = now()
  where id = _sid;

  perform private.log_config_audit(
    _sid,
    'store.address.updated',
    'stores',
    _sid,
    array['postal_code','street','address_number','address_complement','neighborhood','city','state','address_line']
  );

  return public.get_my_store_configuration(_sid);
end;
$function$;

revoke all on function public.update_store_address(uuid,text,text,text,text,text,text,text,timestamptz) from public, anon;
grant execute on function public.update_store_address(uuid,text,text,text,text,text,text,text,timestamptz) to authenticated, service_role;

create or replace function public.get_my_store_configuration(_store_id uuid default null::uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare _sid uuid:=private.resolve_store(_store_id); _sensitive boolean; _result jsonb;
begin
 perform private.require_permission('store.view_basic',_sid); _sensitive:=private.has_permission('store.update_profile',_sid);
 select jsonb_build_object(
   'store',jsonb_build_object(
     'id',s.id,'slug',s.slug,'name',s.name,'status',s.status,
     'legal_name',case when _sensitive then s.legal_name end,
     'document',case when _sensitive then s.document end,
     'segment',s.segment,'phone',s.phone,'whatsapp',s.whatsapp,'email',s.email,
     'postal_code',s.postal_code,'street',s.street,'address_number',s.address_number,
     'address_complement',s.address_complement,'neighborhood',s.neighborhood,
     'address_line',s.address_line,'city',s.city,'state',s.state,
     'latitude',s.latitude,'longitude',s.longitude,
     'timezone',s.timezone,'accepts_delivery',s.accepts_delivery,'accepts_pickup',s.accepts_pickup,
     'updated_at',s.updated_at
   ),
   'settings',jsonb_build_object('brand_primary',st.brand_primary,'brand_accent',st.brand_accent,'logo_path',st.logo_path,'cover_path',st.cover_path,'description',st.description,'welcome_message',st.welcome_message,'closed_message',st.closed_message,'min_order_amount',st.min_order_amount,'default_prep_minutes',st.default_prep_minutes,'sound_alert_enabled',st.sound_alert_enabled,'auto_open_by_hours',st.auto_open_by_hours,'updated_at',st.updated_at),
   'hours',coalesce((select jsonb_agg(jsonb_build_object('weekday',h.weekday,'opens_at',to_char(h.opens_at,'HH24:MI'),'closes_at',to_char(h.closes_at,'HH24:MI')) order by h.weekday,h.opens_at) from public.store_hours h where h.store_id=_sid and h.is_active),'[]'::jsonb),
   'neighborhoods',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'name',n.name,'delivery_fee',n.delivery_fee,'min_order_amount',n.min_order_amount,'eta_minutes',n.eta_minutes,'notes',n.notes,'is_active',n.is_active,'is_archived',n.is_archived,'sort_order',n.sort_order,'updated_at',n.updated_at) order by n.sort_order,n.name) from public.neighborhoods n where n.store_id=_sid),'[]'::jsonb),
   'payment_methods',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'kind',p.kind,'label',p.label,'instructions',p.instructions,'needs_change',p.needs_change,'is_active',p.is_active,'available_for_delivery',p.available_for_delivery,'available_for_pickup',p.available_for_pickup,'sort_order',p.sort_order,'updated_at',p.updated_at) order by p.sort_order,p.label) from public.payment_methods p where p.store_id=_sid),'[]'::jsonb),
   'can',jsonb_build_object('update_profile',private.has_permission('store.update_profile',_sid),'manage_settings',private.has_permission('store.manage_settings',_sid),'manage_hours',private.has_permission('store.manage_hours',_sid),'manage_neighborhoods',private.has_permission('store.manage_neighborhoods',_sid),'manage_payment_methods',private.has_permission('store.manage_payment_methods',_sid))
 ) into _result
 from public.stores s left join public.store_settings st on st.store_id=s.id where s.id=_sid;
 if _result is null then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
 return _result;
end;
$function$;
