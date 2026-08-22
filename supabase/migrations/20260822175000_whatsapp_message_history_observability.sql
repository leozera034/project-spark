create or replace function private.render_whatsapp_body_snapshot(_body text,_variables jsonb)
returns text
language plpgsql
immutable
set search_path to 'pg_catalog','pg_temp'
as $function$
declare
  _rendered text := coalesce(_body,'');
  _params jsonb := coalesce(_variables->'body_parameters','[]'::jsonb);
  _i integer;
  _value text;
begin
  if jsonb_typeof(_params) <> 'array' then return left(_rendered,1200); end if;
  if jsonb_array_length(_params)=0 then return left(_rendered,1200); end if;
  for _i in 0..jsonb_array_length(_params)-1 loop
    _value := coalesce(_params->>_i,'');
    _rendered := replace(_rendered,'{{'||(_i+1)::text||'}}',_value);
  end loop;
  return left(_rendered,1200);
end;
$function$;

revoke all on function private.render_whatsapp_body_snapshot(text,jsonb) from public,anon,authenticated;

create or replace function public.list_store_whatsapp_message_history_v2(_store_id uuid,_limit integer default 50)
returns table(
  id uuid,
  customer_id uuid,
  customer_name text,
  recipient_e164 text,
  purpose text,
  provider text,
  status text,
  event_code text,
  body_preview text,
  queued_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  latency_seconds integer,
  error_code text,
  error_message text
)
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
begin
  perform private.require_growth_access(_store_id);
  return query
  select
    m.id,m.customer_id,c.first_name,m.recipient_e164,m.purpose,m.provider,m.status,
    j.event_code,
    private.render_whatsapp_body_snapshot(m.body_snapshot,m.variables),
    m.queued_at,m.sent_at,m.delivered_at,m.read_at,m.failed_at,
    case when m.sent_at is null then null else greatest(0,round(extract(epoch from (m.sent_at-m.queued_at)))::integer) end,
    m.error_code,m.error_message
  from private.outbound_messages m
  left join public.customers c on c.id=m.customer_id and c.store_id=m.store_id
  left join private.automation_jobs j on j.id=m.automation_job_id and j.store_id=m.store_id
  where m.store_id=_store_id and m.channel='whatsapp'
  order by m.created_at desc
  limit greatest(1,least(coalesce(_limit,50),200));
end;
$function$;

revoke all on function public.list_store_whatsapp_message_history_v2(uuid,integer) from public,anon;
grant execute on function public.list_store_whatsapp_message_history_v2(uuid,integer) to authenticated,service_role;
