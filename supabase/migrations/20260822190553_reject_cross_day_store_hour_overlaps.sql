create or replace function public.replace_store_hours(
  _store_id uuid,
  _hours jsonb,
  _expected_updated_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _cur timestamptz;
  _wd int;
  _a int;
  _b int;
  _row record;
begin
  perform private.require_permission('store.manage_hours',_sid);
  select updated_at into _cur
  from public.store_settings
  where store_id=_sid
  for update;
  perform private.assert_version(_expected_updated_at,_cur);

  if _hours is null or jsonb_typeof(_hours)<>'array' then
    raise exception 'INVALID_HOURS' using errcode='P0001';
  end if;

  create temp table _incoming(
    weekday int,
    opens time,
    closes time,
    s int,
    e int
  ) on commit drop;

  for _row in select * from jsonb_array_elements(_hours) as x(v) loop
    if (_row.v->>'weekday') is null
       or (_row.v->>'opens_at') is null
       or (_row.v->>'closes_at') is null then
      raise exception 'INVALID_HOURS' using errcode='P0001';
    end if;

    _wd:=(_row.v->>'weekday')::int;
    if _wd<0 or _wd>6 then
      raise exception 'INVALID_HOURS' using errcode='P0001';
    end if;

    if (_row.v->>'opens_at')!~'^\d{2}:\d{2}$'
       or (_row.v->>'closes_at')!~'^\d{2}:\d{2}$' then
      raise exception 'INVALID_HOURS' using errcode='P0001';
    end if;

    _a:=split_part(_row.v->>'opens_at',':',1)::int*60
       + split_part(_row.v->>'opens_at',':',2)::int;
    _b:=split_part(_row.v->>'closes_at',':',1)::int*60
       + split_part(_row.v->>'closes_at',':',2)::int;

    if _a>1439 or _b>1439 then
      raise exception 'INVALID_HOURS' using errcode='P0001';
    end if;
    if _a=_b then
      raise exception 'EMPTY_SHIFT' using errcode='P0001';
    end if;
    if _b<_a then
      _b:=_b+1440;
    end if;

    insert into _incoming values(
      _wd,
      (_row.v->>'opens_at')::time,
      (_row.v->>'closes_at')::time,
      _a,
      _b
    );
  end loop;

  if exists(
    select 1
    from _incoming i
    join _incoming j
      on i.weekday=j.weekday
     and i.ctid<>j.ctid
    where i.s<j.e and j.s<i.e
  ) then
    raise exception 'OVERLAPPING_SHIFTS' using errcode='P0001';
  end if;

  if exists(
    select 1
    from _incoming i
    join _incoming j
      on j.weekday=((i.weekday+1)%7)
    where i.e>1440
      and j.s<(i.e-1440)
  ) then
    raise exception 'OVERLAPPING_SHIFTS' using errcode='P0001';
  end if;

  delete from public.store_hours where store_id=_sid;
  insert into public.store_hours(store_id,weekday,opens_at,closes_at,is_active)
  select _sid,weekday,opens,closes,true from _incoming;

  update public.store_settings
  set updated_at=now()
  where store_id=_sid;

  perform private.log_config_audit(
    _sid,
    'store.hours.updated',
    'store_hours',
    _sid,
    array['weekly_hours']
  );

  return public.get_my_store_configuration(_sid);
end;
$$;
