begin;

do $$
declare
  _sid uuid;
  _r1 boolean;
  _r2 boolean;
  _r3 boolean;
  _r4 boolean;
begin
  select id into _sid
  from public.stores
  where status='ativa'
  order by created_at
  limit 1;

  if _sid is null then
    raise exception 'NO_ACTIVE_STORE';
  end if;

  update public.stores
  set timezone='America/Sao_Paulo'
  where id=_sid;

  delete from public.store_hours
  where store_id=_sid;

  insert into public.store_hours(store_id,weekday,opens_at,closes_at,is_active)
  values (_sid,1,'18:00','02:00',true);

  _r1 := private.store_open_by_hours_at(_sid,'2026-08-24 19:00:00-03'::timestamptz);
  _r2 := private.store_open_by_hours_at(_sid,'2026-08-25 01:00:00-03'::timestamptz);
  _r3 := private.store_open_by_hours_at(_sid,'2026-08-24 01:00:00-03'::timestamptz);
  _r4 := private.store_open_by_hours_at(_sid,'2026-08-25 03:00:00-03'::timestamptz);

  if _r1 is not true then raise exception 'START_DAY_EVENING_FAILED'; end if;
  if _r2 is not true then raise exception 'NEXT_DAY_OVERNIGHT_FAILED'; end if;
  if _r3 is not false then raise exception 'WRONG_PREVIOUS_DAY_OPEN'; end if;
  if _r4 is not false then raise exception 'AFTER_CLOSE_FAILED'; end if;
end $$;

select 'store_overnight_contract_passed' as result;

rollback;
