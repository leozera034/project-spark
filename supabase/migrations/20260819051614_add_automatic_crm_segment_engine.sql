create table private.customer_growth_states (
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null,
  current_segment text not null check (current_segment in ('novos','recorrentes','vip','inativos')),
  completed_orders integer not null default 0 check (completed_orders >= 0),
  lifetime_value numeric(14,2) not null default 0 check (lifetime_value >= 0),
  last_completed_order_at timestamptz,
  vip_achieved_at timestamptz,
  inactive_since timestamptz,
  inactive_cycle integer not null default 0 check (inactive_cycle >= 0),
  state_changed_at timestamptz not null default now(),
  last_scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store_id, customer_id),
  constraint customer_growth_states_customer_store_fk
    foreign key (customer_id, store_id) references public.customers(id, store_id) on delete cascade
);

create index customer_growth_states_scan_idx
  on private.customer_growth_states(last_scanned_at, store_id, customer_id);
create index customer_growth_states_store_segment_idx
  on private.customer_growth_states(store_id, current_segment, last_completed_order_at);

create table private.customer_growth_transitions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null,
  from_segment text,
  to_segment text not null check (to_segment in ('novos','recorrentes','vip','inativos')),
  completed_orders integer not null default 0,
  lifetime_value numeric(14,2) not null default 0,
  last_completed_order_at timestamptz,
  inactive_cycle integer not null default 0,
  event_code text,
  event_emitted boolean not null default false,
  suppression_reason text,
  source text not null default 'scanner',
  created_at timestamptz not null default now(),
  constraint customer_growth_transitions_customer_store_fk
    foreign key (customer_id, store_id) references public.customers(id, store_id) on delete cascade
);

create index customer_growth_transitions_customer_idx
  on private.customer_growth_transitions(store_id, customer_id, created_at desc);
create index customer_growth_transitions_event_idx
  on private.customer_growth_transitions(store_id, event_code, created_at desc)
  where event_code is not null;

create table private.crm_segment_scan_runs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  status text not null default 'running' check (status in ('running','completed','failed','skipped')),
  as_of timestamptz not null default now(),
  batch_limit integer not null,
  scanned_customers integer not null default 0,
  transitions integer not null default 0,
  emitted_events integer not null default 0,
  suppressed_events integer not null default 0,
  errors integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index crm_segment_scan_runs_store_started_idx
  on private.crm_segment_scan_runs(store_id, started_at desc);

alter table private.customer_growth_states enable row level security;
alter table private.customer_growth_states force row level security;
alter table private.customer_growth_transitions enable row level security;
alter table private.customer_growth_transitions force row level security;
alter table private.crm_segment_scan_runs enable row level security;
alter table private.crm_segment_scan_runs force row level security;

revoke all on private.customer_growth_states from public, anon, authenticated;
revoke all on private.customer_growth_transitions from public, anon, authenticated;
revoke all on private.crm_segment_scan_runs from public, anon, authenticated;
grant all on private.customer_growth_states to service_role;
grant all on private.customer_growth_transitions to service_role;
grant all on private.crm_segment_scan_runs to service_role;

create or replace function private.customer_has_whatsapp_marketing_consent(_store_id uuid, _customer_id uuid)
returns boolean language sql stable security definer set search_path = public, private, pg_temp as $$
  select exists(select 1 from private.customer_channel_consents c
    where c.store_id=_store_id and c.customer_id=_customer_id and c.channel='whatsapp'
      and c.purpose='marketing' and c.opted_in and c.revoked_at is null);
$$;
revoke all on function private.customer_has_whatsapp_marketing_consent(uuid,uuid) from public, anon, authenticated;
grant execute on function private.customer_has_whatsapp_marketing_consent(uuid,uuid) to service_role;

create or replace function private.refresh_customer_growth_state(
  _store_id uuid,_customer_id uuid,_emit_events boolean default true,_source text default 'scanner',_as_of timestamptz default now()
) returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  _state private.customer_growth_states%rowtype; _completed_orders integer:=0; _lifetime_value numeric(14,2):=0;
  _last_completed_order_at timestamptz; _next_segment text; _old_segment text; _next_cycle integer:=0;
  _next_inactive_since timestamptz; _next_vip_achieved_at timestamptz; _event_code text; _event_count integer:=0;
  _event_emitted boolean:=false; _suppression_reason text; _dedupe_key text; _consented boolean:=false;
  _source_n text:=left(coalesce(nullif(btrim(_source),''),'scanner'),80);
begin
  if _as_of is null then _as_of:=now(); end if;
  if not exists(select 1 from public.customers c where c.id=_customer_id and c.store_id=_store_id) then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('comandiva-customer-growth'),hashtext(_store_id::text||':'||_customer_id::text));
  select count(*)::integer,coalesce(sum(o.total_amount),0)::numeric(14,2),max(o.created_at)
    into _completed_orders,_lifetime_value,_last_completed_order_at
  from public.orders o where o.store_id=_store_id and o.customer_id=_customer_id
    and o.status in ('entregue'::public.order_status,'retirado'::public.order_status) and o.created_at<=_as_of;
  _next_segment:=case
    when _last_completed_order_at is not null and _last_completed_order_at<_as_of-interval '30 days' then 'inativos'
    when _completed_orders>=5 then 'vip' when _completed_orders>=2 then 'recorrentes' else 'novos' end;
  select * into _state from private.customer_growth_states s where s.store_id=_store_id and s.customer_id=_customer_id for update;
  if not found then
    insert into private.customer_growth_states(store_id,customer_id,current_segment,completed_orders,lifetime_value,last_completed_order_at,vip_achieved_at,inactive_since,inactive_cycle,state_changed_at,last_scanned_at)
    values(_store_id,_customer_id,_next_segment,_completed_orders,_lifetime_value,_last_completed_order_at,
      case when _completed_orders>=5 then _as_of end,
      case when _next_segment='inativos' then coalesce(_last_completed_order_at+interval '30 days',_as_of) end,
      case when _next_segment='inativos' then 1 else 0 end,_as_of,_as_of);
    update public.customers set orders_count=_completed_orders,last_order_at=_last_completed_order_at
      where id=_customer_id and store_id=_store_id and (orders_count is distinct from _completed_orders or last_order_at is distinct from _last_completed_order_at);
    return jsonb_build_object('baseline',true,'transitioned',false,'segment',_next_segment,'completed_orders',_completed_orders,'lifetime_value',_lifetime_value,'last_completed_order_at',_last_completed_order_at,'event_emitted',false);
  end if;
  _old_segment:=_state.current_segment; _next_cycle:=_state.inactive_cycle; _next_vip_achieved_at:=_state.vip_achieved_at; _next_inactive_since:=_state.inactive_since;
  if _completed_orders>=5 and _next_vip_achieved_at is null then _next_vip_achieved_at:=_as_of; end if;
  if _next_segment='inativos' and _old_segment<>'inativos' then
    _next_cycle:=_state.inactive_cycle+1; _next_inactive_since:=coalesce(_last_completed_order_at+interval '30 days',_as_of); _event_code:='cliente_inativo_30d';
  elsif _old_segment='inativos' and _next_segment<>'inativos' then _next_inactive_since:=null; end if;
  if _next_segment='vip' and _old_segment<>'vip' and _state.vip_achieved_at is null then _event_code:='cliente_vip'; end if;
  update private.customer_growth_states set current_segment=_next_segment,completed_orders=_completed_orders,lifetime_value=_lifetime_value,
    last_completed_order_at=_last_completed_order_at,vip_achieved_at=_next_vip_achieved_at,inactive_since=_next_inactive_since,
    inactive_cycle=_next_cycle,state_changed_at=case when _old_segment is distinct from _next_segment then _as_of else state_changed_at end,
    last_scanned_at=_as_of,updated_at=now() where store_id=_store_id and customer_id=_customer_id;
  update public.customers set orders_count=_completed_orders,last_order_at=_last_completed_order_at
    where id=_customer_id and store_id=_store_id and (orders_count is distinct from _completed_orders or last_order_at is distinct from _last_completed_order_at);
  if _event_code is not null then
    if not coalesce(_emit_events,false) then _suppression_reason:='events_disabled';
    else
      _consented:=private.customer_has_whatsapp_marketing_consent(_store_id,_customer_id);
      if not _consented then _suppression_reason:='marketing_opt_in_required';
      else
        _dedupe_key:=case _event_code when 'cliente_vip' then 'customer:'||_customer_id::text||':cliente_vip:first'
          when 'cliente_inativo_30d' then 'customer:'||_customer_id::text||':cliente_inativo_30d:cycle:'||_next_cycle::text end;
        _event_count:=private.emit_store_automation_event(_store_id,_event_code,
          jsonb_build_object('customer_id',_customer_id,'segment',_next_segment,'completed_orders',_completed_orders,'lifetime_value',_lifetime_value,'last_completed_order_at',_last_completed_order_at,'inactive_cycle',_next_cycle),_dedupe_key);
        _event_emitted:=_event_count>0; if not _event_emitted then _suppression_reason:='no_enabled_rule'; end if;
      end if;
    end if;
  end if;
  if _old_segment is distinct from _next_segment or _event_code is not null then
    insert into private.customer_growth_transitions(store_id,customer_id,from_segment,to_segment,completed_orders,lifetime_value,last_completed_order_at,inactive_cycle,event_code,event_emitted,suppression_reason,source)
    values(_store_id,_customer_id,_old_segment,_next_segment,_completed_orders,_lifetime_value,_last_completed_order_at,_next_cycle,_event_code,_event_emitted,_suppression_reason,_source_n);
  end if;
  return jsonb_build_object('baseline',false,'transitioned',_old_segment is distinct from _next_segment,'from_segment',_old_segment,'segment',_next_segment,
    'completed_orders',_completed_orders,'lifetime_value',_lifetime_value,'last_completed_order_at',_last_completed_order_at,'inactive_cycle',_next_cycle,
    'event_code',_event_code,'event_emitted',_event_emitted,'suppression_reason',_suppression_reason);
end; $$;
revoke all on function private.refresh_customer_growth_state(uuid,uuid,boolean,text,timestamptz) from public, anon, authenticated;
grant execute on function private.refresh_customer_growth_state(uuid,uuid,boolean,text,timestamptz) to service_role;

create or replace function private.initialize_customer_growth_state() returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  begin perform private.refresh_customer_growth_state(new.store_id,new.id,false,'customer_insert',now());
  exception when others then begin
    insert into private.automation_event_failures(store_id,event_code,source_table,source_id,error_code,error_message,payload)
    values(new.store_id,'customer_growth_state_init','customers',new.id,sqlstate,left(sqlerrm,500),jsonb_build_object('customer_id',new.id));
  exception when others then null; end; end;
  return new;
end; $$;
create trigger trg_customer_growth_state_init after insert on public.customers for each row execute function private.initialize_customer_growth_state();

create or replace function private.sync_customer_growth_state_from_order() returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
declare _customer_id uuid; _store_id uuid;
begin
  _customer_id:=coalesce(new.customer_id,old.customer_id); _store_id:=coalesce(new.store_id,old.store_id);
  if _customer_id is null then return coalesce(new,old); end if;
  if tg_op='INSERT' then if new.status not in ('entregue'::public.order_status,'retirado'::public.order_status) then return new; end if;
  elsif tg_op='UPDATE' then
    if old.status not in ('entregue'::public.order_status,'retirado'::public.order_status) and new.status not in ('entregue'::public.order_status,'retirado'::public.order_status) then return new; end if;
    if old.status is not distinct from new.status and old.customer_id is not distinct from new.customer_id then return new; end if;
  end if;
  begin perform private.refresh_customer_growth_state(_store_id,_customer_id,true,'order_status',now());
  exception when others then begin
    insert into private.automation_event_failures(store_id,event_code,source_table,source_id,error_code,error_message,payload)
    values(_store_id,'customer_growth_state_sync','orders',coalesce(new.id,old.id),sqlstate,left(sqlerrm,500),jsonb_build_object('customer_id',_customer_id,'status',coalesce(new.status,old.status)::text));
  exception when others then null; end; end;
  return coalesce(new,old);
end; $$;
create trigger trg_order_customer_growth_state after insert or update of status, customer_id on public.orders for each row execute function private.sync_customer_growth_state_from_order();

create or replace function private.scan_customer_growth_segments(_store_id uuid default null,_batch_limit integer default 5000,_as_of timestamptz default now())
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare _run_id uuid; _row record; _result jsonb; _scanned integer:=0; _transitions integer:=0; _emitted integer:=0; _suppressed integer:=0; _errors integer:=0;
  _limit integer:=least(greatest(coalesce(_batch_limit,5000),1),20000);
begin
  if not pg_try_advisory_xact_lock(hashtext('comandiva-crm-segment-scan')) then
    insert into private.crm_segment_scan_runs(store_id,status,as_of,batch_limit,completed_at,error_message)
    values(_store_id,'skipped',coalesce(_as_of,now()),_limit,now(),'scan_already_running') returning id into _run_id;
    return jsonb_build_object('run_id',_run_id,'status','skipped','reason','scan_already_running');
  end if;
  insert into private.crm_segment_scan_runs(store_id,status,as_of,batch_limit) values(_store_id,'running',coalesce(_as_of,now()),_limit) returning id into _run_id;
  for _row in select c.store_id,c.id from public.customers c join public.stores st on st.id=c.store_id and st.status='ativa'::public.store_status
    left join private.customer_growth_states gs on gs.store_id=c.store_id and gs.customer_id=c.id
    where (_store_id is null or c.store_id=_store_id) order by gs.last_scanned_at nulls first,c.created_at,c.id limit _limit
  loop
    begin
      _result:=private.refresh_customer_growth_state(_row.store_id,_row.id,true,'scanner',coalesce(_as_of,now())); _scanned:=_scanned+1;
      if coalesce((_result->>'transitioned')::boolean,false) then _transitions:=_transitions+1; end if;
      if coalesce((_result->>'event_emitted')::boolean,false) then _emitted:=_emitted+1;
      elsif _result->>'event_code' is not null then _suppressed:=_suppressed+1; end if;
    exception when others then
      _errors:=_errors+1;
      begin insert into private.automation_event_failures(store_id,event_code,source_table,source_id,error_code,error_message,payload)
      values(_row.store_id,'crm_segment_scan','customers',_row.id,sqlstate,left(sqlerrm,500),jsonb_build_object('run_id',_run_id)); exception when others then null; end;
    end;
  end loop;
  update private.crm_segment_scan_runs set status=case when _errors>0 then 'failed' else 'completed' end,scanned_customers=_scanned,transitions=_transitions,
    emitted_events=_emitted,suppressed_events=_suppressed,errors=_errors,completed_at=now(),error_message=case when _errors>0 then 'one_or_more_customer_refreshes_failed' end where id=_run_id;
  return jsonb_build_object('run_id',_run_id,'status',case when _errors>0 then 'failed' else 'completed' end,'scanned_customers',_scanned,'transitions',_transitions,'emitted_events',_emitted,'suppressed_events',_suppressed,'errors',_errors);
exception when others then
  if _run_id is not null then update private.crm_segment_scan_runs set status='failed',errors=greatest(errors,1),error_message=left(sqlerrm,500),completed_at=now() where id=_run_id; end if;
  raise;
end; $$;
revoke all on function private.scan_customer_growth_segments(uuid,integer,timestamptz) from public, anon, authenticated;
grant execute on function private.scan_customer_growth_segments(uuid,integer,timestamptz) to service_role;

create or replace function public.get_store_crm_segment_summary(_store_id uuid) returns jsonb language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare _result jsonb;
begin
  perform private.require_growth_access(_store_id);
  select jsonb_build_object('customers',count(*),'newCustomers',count(*) filter(where gs.current_segment='novos'),
    'repeatCustomers',count(*) filter(where gs.current_segment='recorrentes'),'vipCustomers',count(*) filter(where gs.current_segment='vip'),
    'inactiveCustomers',count(*) filter(where gs.current_segment='inativos'),
    'marketingOptIns',count(*) filter(where private.customer_has_whatsapp_marketing_consent(gs.store_id,gs.customer_id)),
    'lastScannedAt',max(gs.last_scanned_at),'lastTransitionAt',(select max(t.created_at) from private.customer_growth_transitions t where t.store_id=_store_id)) into _result
  from private.customer_growth_states gs where gs.store_id=_store_id;
  return coalesce(_result,jsonb_build_object('customers',0,'newCustomers',0,'repeatCustomers',0,'vipCustomers',0,'inactiveCustomers',0,'marketingOptIns',0));
end; $$;
revoke all on function public.get_store_crm_segment_summary(uuid) from public, anon;
grant execute on function public.get_store_crm_segment_summary(uuid) to authenticated, service_role;

create or replace function public.get_store_growth_summary(_store_id uuid) returns jsonb language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare result jsonb;
begin
  perform private.require_growth_access(_store_id);
  select jsonb_build_object('customers',count(*),'newCustomers30d',count(*) filter(where c.created_at>=now()-interval '30 days'),
    'repeatCustomers',count(*) filter(where coalesce(gs.current_segment,case when c.orders_count>=2 then 'recorrentes' else 'novos' end) in ('recorrentes','vip')),
    'vipCustomers',count(*) filter(where coalesce(gs.current_segment,case when c.orders_count>=5 then 'vip' else 'novos' end)='vip'),
    'inactiveCustomers',count(*) filter(where coalesce(gs.current_segment,case when c.last_order_at<now()-interval '30 days' then 'inativos' else 'novos' end)='inativos'),
    'orders30d',coalesce((select count(*) from public.orders o where o.store_id=_store_id and o.created_at>=now()-interval '30 days' and o.status not in ('cancelado','recusado')),0),
    'revenue30d',coalesce((select sum(o.total_amount) from public.orders o where o.store_id=_store_id and o.created_at>=now()-interval '30 days' and o.status in ('entregue','retirado')),0),
    'avgTicket30d',coalesce((select avg(o.total_amount) from public.orders o where o.store_id=_store_id and o.created_at>=now()-interval '30 days' and o.status in ('entregue','retirado')),0)) into result
  from public.customers c left join private.customer_growth_states gs on gs.store_id=c.store_id and gs.customer_id=c.id where c.store_id=_store_id;
  return coalesce(result,'{}'::jsonb);
end; $$;

create or replace function public.list_store_customer_insights(_store_id uuid,_search text default null,_segment text default null,_limit integer default 100,_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare result jsonb;
begin
  perform private.require_growth_access(_store_id);
  with ranked as (
    select c.id,c.first_name,c.phone,coalesce(gs.completed_orders,c.orders_count) as orders_count,coalesce(gs.last_completed_order_at,c.last_order_at) as last_order_at,c.created_at,
      coalesce(gs.lifetime_value,0)::numeric(12,2) as lifetime_value,
      coalesce(gs.current_segment,case when c.last_order_at is not null and c.last_order_at<now()-interval '30 days' then 'inativos' when c.orders_count>=5 then 'vip' when c.orders_count>=2 then 'recorrentes' else 'novos' end) as segment
    from public.customers c left join private.customer_growth_states gs on gs.store_id=c.store_id and gs.customer_id=c.id where c.store_id=_store_id
  ), filtered as (
    select * from ranked where (_search is null or trim(_search)='' or first_name ilike '%'||trim(_search)||'%' or phone ilike '%'||trim(_search)||'%')
      and (_segment is null or trim(_segment)='' or segment=_segment)
  )
  select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce((select jsonb_agg(to_jsonb(x) order by x.lifetime_value desc,x.last_order_at desc nulls last)
    from (select * from filtered limit least(greatest(_limit,1),200) offset greatest(_offset,0)) x),'[]'::jsonb)) into result;
  return result;
end; $$;

create or replace function public.save_store_automation_rule(_store_id uuid,_id uuid,_event_code text,_name text,_enabled boolean,_config jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public,private,pg_temp as $$
declare result_id uuid; _access jsonb; _mode text; _action_code text; _template_id uuid; _template public.store_message_templates%rowtype; _provider text;
  _parameter_count integer; _binding_count integer:=0; _bindings jsonb; _allowed text[]; _code text; _i integer; _clean_config jsonb; _safe_name text:=btrim(coalesce(_name,''));
begin
  if not private.is_store_manager(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if char_length(_safe_name) not between 2 and 120 then raise exception 'INVALID_AUTOMATION_NAME' using errcode='P0001'; end if;
  _access:=public.get_store_billing_access(_store_id); if not coalesce((_access->>'can_use_growth')::boolean,true) then raise exception 'BILLING_RESTRICTED' using errcode='P0001',detail=jsonb_build_object('stage',_access->>'stage','capability','growth')::text; end if;
  if _event_code not in ('novo_cliente','pedido_criado','pedido_aceito','pedido_em_preparo','pedido_pronto','pedido_aguardando_entregador','pedido_saiu_para_entrega','pedido_aguardando_retirada','pedido_entregue','pedido_retirado','pedido_recusado','pedido_cancelado','pedido_concluido','cliente_inativo_30d','cliente_vip') then raise exception 'INVALID_AUTOMATION_EVENT' using errcode='P0001'; end if;
  _mode:=coalesce(nullif(_config->>'mode',''),'assisted'); if _mode not in ('assisted','automatic') then raise exception 'INVALID_AUTOMATION_MODE' using errcode='P0001'; end if;
  _action_code:=case when _mode='automatic' then 'send_whatsapp_template' else 'sugerir_whatsapp' end;
  if _mode='automatic' then
    perform private.require_store_entitlement(_store_id,'whatsapp_automation'); begin _template_id:=(_config->>'template_id')::uuid; exception when others then _template_id:=null; end;
    if _template_id is null then raise exception 'MESSAGE_TEMPLATE_REQUIRED' using errcode='P0001'; end if;
    select * into _template from public.store_message_templates t where t.id=_template_id and t.store_id=_store_id and t.channel='whatsapp' and t.is_active;
    if not found then raise exception 'MESSAGE_TEMPLATE_REQUIRED' using errcode='P0001'; end if;
    if _event_code in ('cliente_inativo_30d','cliente_vip') and _template.purpose<>'marketing' then raise exception 'CRM_AUTOMATION_REQUIRES_MARKETING_TEMPLATE' using errcode='P0001'; end if;
    _parameter_count:=private.whatsapp_template_parameter_count(_template.body); _bindings:=coalesce(_config->'variable_bindings','{}'::jsonb);
    if jsonb_typeof(_bindings)<>'object' then raise exception 'INVALID_VARIABLE_BINDINGS' using errcode='P0001'; end if;
    select count(*)::integer into _binding_count from jsonb_object_keys(_bindings); if _binding_count<>_parameter_count then raise exception 'VARIABLE_BINDING_COUNT_MISMATCH' using errcode='P0001'; end if;
    _allowed:=private.automation_event_variable_codes(_event_code);
    if _parameter_count>0 then for _i in 1.._parameter_count loop _code:=nullif(btrim(_bindings->>(_i::text)),'');
      if _code is null then raise exception 'VARIABLE_BINDING_REQUIRED' using errcode='P0001',detail=_i::text; end if;
      if not (_code=any(_allowed)) then raise exception 'VARIABLE_BINDING_NOT_ALLOWED' using errcode='P0001',detail=_code; end if; end loop; end if;
    if coalesce(_enabled,true) then if _template.provider_status<>'approved' or _template.provider_template_name is null then raise exception 'MESSAGE_TEMPLATE_NOT_PROVIDER_APPROVED' using errcode='P0001'; end if;
      _provider:=private.resolve_whatsapp_provider(_store_id); if _provider is null then raise exception 'WHATSAPP_PROVIDER_NOT_CONNECTED' using errcode='P0001'; end if; end if;
    _clean_config:=jsonb_build_object('mode','automatic','template_id',_template_id,'variable_bindings',_bindings);
  else _clean_config:=jsonb_build_object('mode','assisted'); end if;
  if _id is null then insert into public.store_automation_rules(store_id,event_code,action_code,name,is_enabled,config)
    values(_store_id,_event_code,_action_code,_safe_name,coalesce(_enabled,true),_clean_config) returning id into result_id;
  else update public.store_automation_rules set event_code=_event_code,action_code=_action_code,name=_safe_name,is_enabled=coalesce(_enabled,true),config=_clean_config,updated_at=now()
    where id=_id and store_id=_store_id returning id into result_id; if result_id is null then raise exception 'RULE_NOT_FOUND' using errcode='P0001'; end if; end if;
  return result_id;
end; $$;

insert into private.customer_growth_states(store_id,customer_id,current_segment,completed_orders,lifetime_value,last_completed_order_at,vip_achieved_at,inactive_since,inactive_cycle,state_changed_at,last_scanned_at)
select c.store_id,c.id,
  case when m.last_completed_order_at is not null and m.last_completed_order_at<now()-interval '30 days' then 'inativos' when m.completed_orders>=5 then 'vip' when m.completed_orders>=2 then 'recorrentes' else 'novos' end,
  m.completed_orders,m.lifetime_value,m.last_completed_order_at,case when m.completed_orders>=5 then now() end,
  case when m.last_completed_order_at is not null and m.last_completed_order_at<now()-interval '30 days' then m.last_completed_order_at+interval '30 days' end,
  case when m.last_completed_order_at is not null and m.last_completed_order_at<now()-interval '30 days' then 1 else 0 end,now(),now()
from public.customers c cross join lateral (
  select count(*)::integer as completed_orders,coalesce(sum(o.total_amount),0)::numeric(14,2) as lifetime_value,max(o.created_at) as last_completed_order_at
  from public.orders o where o.store_id=c.store_id and o.customer_id=c.id and o.status in ('entregue'::public.order_status,'retirado'::public.order_status)
) m on conflict(store_id,customer_id) do nothing;

update public.customers c set orders_count=gs.completed_orders,last_order_at=gs.last_completed_order_at
from private.customer_growth_states gs where gs.store_id=c.store_id and gs.customer_id=c.id
and (c.orders_count is distinct from gs.completed_orders or c.last_order_at is distinct from gs.last_completed_order_at);