create or replace function private.store_open_by_hours_at(
  _store_id uuid,
  _at timestamptz default now()
) returns boolean
language plpgsql
stable
set search_path to 'pg_catalog','public','private'
as $$
declare
  _tz text;
  _local timestamp;
  _weekday smallint;
  _time time;
  _previous_weekday smallint;
begin
  select coalesce(s.timezone,'America/Sao_Paulo')
    into _tz
  from public.stores s
  where s.id=_store_id;

  if _tz is null then
    return false;
  end if;

  _local := _at at time zone _tz;
  _weekday := extract(dow from _local)::smallint;
  _previous_weekday := ((_weekday + 6) % 7)::smallint;
  _time := _local::time;

  return exists (
    select 1
    from public.store_hours h
    where h.store_id=_store_id
      and h.is_active
      and (
        (
          h.weekday=_weekday
          and h.closes_at>h.opens_at
          and _time>=h.opens_at
          and _time<h.closes_at
        )
        or (
          h.weekday=_weekday
          and h.closes_at<h.opens_at
          and _time>=h.opens_at
        )
        or (
          h.weekday=_previous_weekday
          and h.closes_at<h.opens_at
          and _time<h.closes_at
        )
      )
  );
end;
$$;

revoke all on function private.store_open_by_hours_at(uuid,timestamptz) from public, anon, authenticated;

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

  select case
    when cfg.manual_override_open is not null then cfg.manual_override_open
    when cfg.auto_open_by_hours then v_by_hours
    else false
  end into v_open
  from public.store_settings cfg
  where cfg.store_id = s.id;
  v_open := coalesce(v_open, v_by_hours);

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
