-- Align usage limit preflight with the store-local month used by usage recording.
create or replace function private.is_store_usage_allowed(
  _store_id uuid,
  _provider text,
  _feature_code text,
  _metric_code text,
  _requested_quantity numeric default 1
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _limit private.integration_usage_limits%rowtype;
  _timezone text;
  _period_start date;
  _used numeric(18,6) := 0;
begin
  if _store_id is null or _requested_quantity is null or _requested_quantity < 0 then
    return false;
  end if;

  select coalesce(s.timezone,'America/Sao_Paulo')
  into _timezone
  from public.stores s
  where s.id = _store_id;

  if not found then
    return false;
  end if;

  _period_start := date_trunc('month', now() at time zone _timezone)::date;

  select l.* into _limit
  from private.integration_usage_limits l
  where l.store_id = _store_id
    and l.feature_code = _feature_code
    and l.metric_code = _metric_code
    and l.provider in (coalesce(_provider,''),'*')
  order by case when l.provider = _provider then 0 else 1 end
  limit 1;

  if not found or _limit.hard_limit_units is null or _limit.limit_action <> 'block' then
    return true;
  end if;

  select coalesce(sum(c.quantity),0) into _used
  from private.integration_usage_counters c
  where c.store_id = _store_id
    and c.feature_code = _feature_code
    and c.metric_code = _metric_code
    and c.period_start = _period_start
    and (_limit.provider = '*' or c.provider = _limit.provider);

  return (_used + _requested_quantity) <= _limit.hard_limit_units;
end;
$function$;

revoke all on function private.is_store_usage_allowed(uuid,text,text,text,numeric) from public, anon, authenticated;
grant execute on function private.is_store_usage_allowed(uuid,text,text,text,numeric) to service_role;
