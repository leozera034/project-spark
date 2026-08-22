create or replace function private.store_effective_open_at(_store_id uuid, _at timestamptz default now())
returns boolean
language plpgsql
stable
set search_path='pg_catalog','public','private'
as $$
declare
  _status public.store_status;
  _auto boolean;
  _manual boolean;
begin
  select s.status, coalesce(st.auto_open_by_hours,true), st.manual_override_open
    into _status,_auto,_manual
  from public.stores s
  left join public.store_settings st on st.store_id=s.id
  where s.id=_store_id;

  if not found or _status <> 'ativa' then return false; end if;
  if _auto then return private.store_open_by_hours_at(_store_id,_at); end if;
  return coalesce(_manual,false);
end;
$$;

revoke all on function private.store_effective_open_at(uuid,timestamptz) from public,anon,authenticated;

create or replace function public.get_my_store_configuration(_store_id uuid default null)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _sensitive boolean;
  _result jsonb;
begin
  perform private.require_permission('store.view_basic',_sid);
  _sensitive:=private.has_permission('store.update_profile',_sid);

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
      'location_source',s.location_source,
      'location_verified_at',s.location_verified_at,
      'location_accuracy_meters',s.location_accuracy_meters,
      'timezone',s.timezone,'accepts_delivery',s.accepts_delivery,'accepts_pickup',s.accepts_pickup,
      'updated_at',s.updated_at
    ),
    'settings',jsonb_build_object(
      'brand_primary',st.brand_primary,'brand_accent',st.brand_accent,'logo_path',st.logo_path,
      'cover_path',st.cover_path,'description',st.description,'welcome_message',st.welcome_message,
      'closed_message',st.closed_message,'min_order_amount',st.min_order_amount,
      'default_prep_minutes',st.default_prep_minutes,'sound_alert_enabled',st.sound_alert_enabled,
      'auto_open_by_hours',st.auto_open_by_hours,'manual_override_open',st.manual_override_open,
      'updated_at',st.updated_at
    ),
    'hours',coalesce((
      select jsonb_agg(jsonb_build_object('weekday',h.weekday,'opens_at',to_char(h.opens_at,'HH24:MI'),'closes_at',to_char(h.closes_at,'HH24:MI')) order by h.weekday,h.opens_at)
      from public.store_hours h where h.store_id=_sid and h.is_active
    ),'[]'::jsonb),
    'neighborhoods',coalesce((
      select jsonb_agg(jsonb_build_object('id',n.id,'name',n.name,'delivery_fee',n.delivery_fee,'min_order_amount',n.min_order_amount,'eta_minutes',n.eta_minutes,'notes',n.notes,'is_active',n.is_active,'is_archived',n.is_archived,'sort_order',n.sort_order,'updated_at',n.updated_at) order by n.sort_order,n.name)
      from public.neighborhoods n where n.store_id=_sid
    ),'[]'::jsonb),
    'payment_methods',coalesce((
      select jsonb_agg(jsonb_build_object('id',p.id,'kind',p.kind,'label',p.label,'instructions',p.instructions,'needs_change',p.needs_change,'is_active',p.is_active,'available_for_delivery',p.available_for_delivery,'available_for_pickup',p.available_for_pickup,'sort_order',p.sort_order,'updated_at',p.updated_at) order by p.sort_order,p.label)
      from public.payment_methods p where p.store_id=_sid
    ),'[]'::jsonb),
    'can',jsonb_build_object(
      'update_profile',private.has_permission('store.update_profile',_sid),
      'manage_settings',private.has_permission('store.manage_settings',_sid),
      'manage_hours',private.has_permission('store.manage_hours',_sid),
      'manage_neighborhoods',private.has_permission('store.manage_neighborhoods',_sid),
      'manage_payment_methods',private.has_permission('store.manage_payment_methods',_sid)
    )
  ) into _result
  from public.stores s
  left join public.store_settings st on st.store_id=s.id
  where s.id=_sid;

  if _result is null then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  return _result;
end;
$$;

create or replace function public.update_store_service_settings(
  _store_id uuid,
  _accepts_delivery boolean,
  _accepts_pickup boolean,
  _min_order_amount numeric,
  _default_prep_minutes integer,
  _sound_alert_enabled boolean,
  _auto_open_by_hours boolean,
  _expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare _sid uuid:=private.resolve_store(_store_id); _cur timestamptz;
begin
  perform private.require_permission('store.manage_settings',_sid);
  select updated_at into _cur from public.store_settings where store_id=_sid for update;
  if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  perform private.assert_version(_expected_updated_at,_cur);
  if _min_order_amount is null or _min_order_amount<0 or _min_order_amount>100000 then raise exception 'INVALID_MIN_ORDER' using errcode='P0001'; end if;
  if _default_prep_minutes is null or _default_prep_minutes<0 or _default_prep_minutes>600 then raise exception 'INVALID_PREP_MINUTES' using errcode='P0001'; end if;
  if (coalesce(_accepts_delivery,false) or coalesce(_accepts_pickup,false)) and _default_prep_minutes=0 then raise exception 'INVALID_PREP_MINUTES' using errcode='P0001'; end if;
  update public.stores
     set accepts_delivery=coalesce(_accepts_delivery,false),accepts_pickup=coalesce(_accepts_pickup,false),updated_at=now()
   where id=_sid;
  update public.store_settings
     set min_order_amount=round(_min_order_amount,2),
         default_prep_minutes=_default_prep_minutes,
         sound_alert_enabled=coalesce(_sound_alert_enabled,true),
         auto_open_by_hours=coalesce(_auto_open_by_hours,true),
         manual_override_open=case when coalesce(_auto_open_by_hours,true) then null else coalesce(manual_override_open,false) end,
         updated_at=now()
   where store_id=_sid;
  perform private.log_config_audit(_sid,'store.service_settings.updated','store_settings',_sid,ARRAY['accepts_delivery','accepts_pickup','min_order_amount','default_prep_minutes','sound_alert_enabled','auto_open_by_hours','manual_override_open']);
  return public.get_my_store_configuration(_sid);
end;
$$;

create or replace function public.set_my_store_manual_open(
  _store_id uuid,
  _open boolean,
  _expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _cur timestamptz;
  _auto boolean;
begin
  perform private.require_permission('store.manage_settings',_sid);
  select updated_at,coalesce(auto_open_by_hours,true) into _cur,_auto
  from public.store_settings where store_id=_sid for update;
  if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  perform private.assert_version(_expected_updated_at,_cur);
  if _auto then raise exception 'AUTO_OPEN_ENABLED' using errcode='P0001'; end if;
  update public.store_settings
     set manual_override_open=coalesce(_open,false),updated_at=now()
   where store_id=_sid;
  perform private.log_config_audit(_sid,'store.manual_open.updated','store_settings',_sid,ARRAY['manual_override_open']);
  return public.get_my_store_configuration(_sid);
end;
$$;
revoke all on function public.set_my_store_manual_open(uuid,boolean,timestamptz) from public,anon;
grant execute on function public.set_my_store_manual_open(uuid,boolean,timestamptz) to authenticated,service_role;

create or replace function public.get_store_operational_preview(_store_id uuid default null)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _tz text;
  _status public.store_status;
  _del boolean;
  _pick boolean;
  _auto boolean;
  _manual boolean;
  _settings_updated timestamptz;
  _local timestamp;
  _wd int;
  _mins int;
  _open boolean:=false;
  _closes text:=null;
  _next_day int;
  _next_open text:=null;
  _next_label text:=null;
  _i int;
  _r record;
begin
  perform private.require_permission('store.view_basic',_sid);
  select s.timezone,s.status,s.accepts_delivery,s.accepts_pickup,
         coalesce(st.auto_open_by_hours,true),st.manual_override_open,st.updated_at
    into _tz,_status,_del,_pick,_auto,_manual,_settings_updated
  from public.stores s
  left join public.store_settings st on st.store_id=s.id
  where s.id=_sid;
  if _tz is null then raise exception 'NOT_FOUND' using errcode='P0001'; end if;

  _local:=now() at time zone _tz;
  _wd:=extract(dow from _local)::int;
  _mins:=extract(hour from _local)::int*60+extract(minute from _local)::int;
  _open:=private.store_effective_open_at(_sid,now());

  if _auto then
    if _open then
      for _r in
        select closes_at,extract(hour from opens_at)::int*60+extract(minute from opens_at)::int as s,
               case when closes_at<=opens_at then extract(hour from closes_at)::int*60+extract(minute from closes_at)::int+1440 else extract(hour from closes_at)::int*60+extract(minute from closes_at)::int end as e
        from public.store_hours where store_id=_sid and is_active and weekday=_wd
      loop
        if _mins>=_r.s and _mins<_r.e then _closes:=to_char(_r.closes_at,'HH24:MI'); end if;
      end loop;
      if _closes is null then
        for _r in
          select closes_at,extract(hour from opens_at)::int*60+extract(minute from opens_at)::int as s,
                 extract(hour from closes_at)::int*60+extract(minute from closes_at)::int as e
          from public.store_hours where store_id=_sid and is_active and weekday=(_wd+6)%7
        loop
          if _r.e<=_r.s and _mins<_r.e then _closes:=to_char(_r.closes_at,'HH24:MI'); end if;
        end loop;
      end if;
    else
      for _i in 0..7 loop
        _next_day:=(_wd+_i)%7;
        select to_char(opens_at,'HH24:MI') into _next_open
        from public.store_hours
        where store_id=_sid and is_active and weekday=_next_day
          and (_i>0 or (extract(hour from opens_at)::int*60+extract(minute from opens_at)::int)>_mins)
        order by opens_at limit 1;
        if _next_open is not null then
          _next_label:=case _i when 0 then 'hoje' when 1 then 'amanha' else (array['domingo','segunda','terca','quarta','quinta','sexta','sabado'])[_next_day+1] end;
          exit;
        end if;
      end loop;
    end if;
  end if;

  if _status<>'ativa' then
    _open:=false;
    _closes:=null;
    _next_open:=null;
    _next_label:=null;
  end if;

  return jsonb_build_object(
    'timezone',_tz,
    'local_time',to_char(_local,'HH24:MI'),
    'is_open',_open,
    'closes_at',_closes,
    'next_open_at',_next_open,
    'next_open_day',_next_label,
    'delivery_enabled',coalesce(_del,false),
    'pickup_enabled',coalesce(_pick,false),
    'mode',case when _auto then 'schedule' else 'manual' end,
    'manual_override_open',_manual,
    'settings_updated_at',_settings_updated,
    'reason',case
      when _status<>'ativa' then 'loja_indisponivel'
      when not _auto and coalesce(_manual,false) then 'abertura_manual'
      when not _auto then 'fechamento_manual'
      when _open then null
      when _next_open is null then 'sem_horarios'
      else 'fora_do_horario'
    end
  );
end;
$$;

create or replace function public.storefront_store(_slug text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_slug text := public.storefront_normalize_slug(_slug);
  s record;
  v_now timestamptz := now();
  v_by_hours boolean;
  v_open boolean;
begin
  if v_slug is null then return null; end if;

  select st.id, st.slug, st.name, st.segment, st.city, st.state, st.timezone, st.phone, st.whatsapp,
         st.address_line, st.accepts_delivery, st.accepts_pickup
    into s
  from public.stores st
  where st.slug = v_slug and st.status = 'ativa'
  limit 1;
  if not found then return null; end if;

  v_by_hours := private.store_open_by_hours_at(s.id,v_now);
  v_open := private.store_effective_open_at(s.id,v_now);

  return jsonb_build_object(
    'store', jsonb_build_object(
      'id', s.id,'slug', s.slug,'name', s.name,'segment', s.segment,'city', s.city,'state', s.state,'timezone', s.timezone,
      'phone', s.phone,'whatsapp', s.whatsapp,'address_line', s.address_line,'accepts_delivery', s.accepts_delivery,'accepts_pickup', s.accepts_pickup
    ),
    'settings', (
      select jsonb_build_object(
        'logo_path', cfg.logo_path,
        'cover_path', cfg.cover_path,
        'logo_url', cfg.logo_url,
        'cover_url', cfg.cover_url,
        'brand_primary', cfg.brand_primary,
        'brand_accent', cfg.brand_accent,
        'description', cfg.description,
        'welcome_message', cfg.welcome_message,
        'closed_message', cfg.closed_message,
        'min_order_amount', cfg.min_order_amount,
        'default_prep_minutes', cfg.default_prep_minutes,
        'theme_tokens', cfg.theme_tokens
      )
      from public.store_settings cfg
      where cfg.store_id = s.id
    ),
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object('weekday', h.weekday,'opens_at', h.opens_at,'closes_at', h.closes_at) order by h.weekday, h.opens_at)
      from public.store_hours h
      where h.store_id = s.id and h.is_active
    ), '[]'::jsonb),
    'is_open', coalesce(v_open, false),
    'open_by_hours', coalesce(v_by_hours, false),
    'server_time', v_now
  );
end;
$$;
