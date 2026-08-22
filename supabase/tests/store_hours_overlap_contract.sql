begin;

do $$
declare
  _uid uuid;
  _sid uuid;
  _blocked boolean:=false;
begin
  select r.user_id,r.store_id into _uid,_sid
  from public.user_roles r
  join public.user_profiles p on p.id=r.user_id and p.is_active
  where r.is_active
    and r.store_id is not null
    and r.role in ('proprietario','gerente')
  order by r.created_at
  limit 1;

  if _uid is null then
    raise exception 'NO_STORE_MANAGER';
  end if;

  perform set_config('request.jwt.claim.sub',_uid::text,true);

  begin
    perform public.replace_store_hours(
      _sid,
      '[{"weekday":1,"opens_at":"18:00","closes_at":"02:00"},{"weekday":2,"opens_at":"01:00","closes_at":"05:00"}]'::jsonb,
      null
    );
  exception when sqlstate 'P0001' then
    if sqlerrm='OVERLAPPING_SHIFTS' then
      _blocked:=true;
    else
      raise;
    end if;
  end;

  if not _blocked then
    raise exception 'CROSS_DAY_OVERLAP_NOT_BLOCKED';
  end if;

  perform public.replace_store_hours(
    _sid,
    '[{"weekday":1,"opens_at":"18:00","closes_at":"02:00"},{"weekday":2,"opens_at":"02:00","closes_at":"05:00"}]'::jsonb,
    null
  );
end $$;

select 'store_hours_cross_day_overlap_contract_passed' as result;

rollback;
