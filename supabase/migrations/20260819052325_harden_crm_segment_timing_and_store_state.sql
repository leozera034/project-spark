create or replace function private.refresh_customer_growth_state(
  _store_id uuid,
  _customer_id uuid,
  _emit_events boolean default true,
  _source text default 'scanner',
  _as_of timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  _state private.customer_growth_states%rowtype;
  _completed_orders integer := 0;
  _lifetime_value numeric(14,2) := 0;
  _last_completed_order_at timestamptz;
  _next_segment text;
  _old_segment text;
  _next_cycle integer := 0;
  _next_inactive_since timestamptz;
  _next_vip_achieved_at timestamptz;
  _event_code text;
  _event_count integer := 0;
  _event_emitted boolean := false;
  _suppression_reason text;
  _dedupe_key text;
  _consented boolean := false;
  _store_active boolean := false;
  _source_n text := left(coalesce(nullif(btrim(_source),''),'scanner'),80);
begin
  if _as_of is null then _as_of := now(); end if;
  if not exists(select 1 from public.customers c where c.id=_customer_id and c.store_id=_store_id) then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('comandiva-customer-growth'),hashtext(_store_id::text||':'||_customer_id::text));
  select count(*)::integer,coalesce(sum(o.total_amount),0)::numeric(14,2),max(coalesce(o.finished_at,o.updated_at,o.created_at))
  into _completed_orders,_lifetime_value,_last_completed_order_at
  from public.orders o
  where o.store_id=_store_id and o.customer_id=_customer_id
    and o.status in ('entregue'::public.order_status,'retirado'::public.order_status)
    and coalesce(o.finished_at,o.updated_at,o.created_at)<=_as_of;
  _next_segment:=case
    when _last_completed_order_at is not null and _last_completed_order_at<_as_of-interval '30 days' then 'inativos'
    when _completed_orders>=5 then 'vip'
    when _completed_orders>=2 then 'recorrentes'
    else 'novos' end;
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
    last_completed_order_at=_last_completed_order_at,vip_achieved_at=_next_vip_achieved_at,inactive_since=_next_inactive_since,inactive_cycle=_next_cycle,
    state_changed_at=case when _old_segment is distinct from _next_segment then _as_of else state_changed_at end,last_scanned_at=_as_of,updated_at=now()
  where store_id=_store_id and customer_id=_customer_id;
  update public.customers set orders_count=_completed_orders,last_order_at=_last_completed_order_at
  where id=_customer_id and store_id=_store_id and (orders_count is distinct from _completed_orders or last_order_at is distinct from _last_completed_order_at);
  if _event_code is not null then
    if not coalesce(_emit_events,false) then _suppression_reason:='events_disabled';
    else
      select exists(select 1 from public.stores s where s.id=_store_id and s.status='ativa'::public.store_status) into _store_active;
      if not _store_active then _suppression_reason:='store_inactive';
      else
        _consented:=private.customer_has_whatsapp_marketing_consent(_store_id,_customer_id);
        if not _consented then _suppression_reason:='marketing_opt_in_required';
        else
          _dedupe_key:=case _event_code
            when 'cliente_vip' then 'customer:'||_customer_id::text||':cliente_vip:first'
            when 'cliente_inativo_30d' then 'customer:'||_customer_id::text||':cliente_inativo_30d:cycle:'||_next_cycle::text end;
          _event_count:=private.emit_store_automation_event(_store_id,_event_code,
            jsonb_build_object('customer_id',_customer_id,'segment',_next_segment,'completed_orders',_completed_orders,'lifetime_value',_lifetime_value,'last_completed_order_at',_last_completed_order_at,'inactive_cycle',_next_cycle),_dedupe_key);
          _event_emitted:=_event_count>0; if not _event_emitted then _suppression_reason:='no_enabled_rule'; end if;
        end if;
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
end;
$$;

create or replace function public.get_store_growth_summary(_store_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare result jsonb;
begin
  perform private.require_growth_access(_store_id);
  select jsonb_build_object(
    'customers',count(*),
    'newCustomers30d',count(*) filter(where c.created_at>=now()-interval '30 days'),
    'repeatCustomers',count(*) filter(where coalesce(gs.completed_orders,c.orders_count)>=2),
    'vipCustomers',count(*) filter(where coalesce(gs.current_segment,case when c.orders_count>=5 then 'vip' else 'novos' end)='vip'),
    'inactiveCustomers',count(*) filter(where coalesce(gs.current_segment,case when c.last_order_at<now()-interval '30 days' then 'inativos' else 'novos' end)='inativos'),
    'orders30d',coalesce((select count(*) from public.orders o where o.store_id=_store_id and o.created_at>=now()-interval '30 days' and o.status not in ('cancelado','recusado')),0),
    'revenue30d',coalesce((select sum(o.total_amount) from public.orders o where o.store_id=_store_id and o.created_at>=now()-interval '30 days' and o.status in ('entregue','retirado')),0),
    'avgTicket30d',coalesce((select avg(o.total_amount) from public.orders o where o.store_id=_store_id and o.created_at>=now()-interval '30 days' and o.status in ('entregue','retirado')),0)
  ) into result from public.customers c
  left join private.customer_growth_states gs on gs.store_id=c.store_id and gs.customer_id=c.id
  where c.store_id=_store_id;
  return coalesce(result,'{}'::jsonb);
end;
$$;

create or replace function private.resolve_whatsapp_automation_context(_store_id uuid,_event_code text,_payload jsonb,_config jsonb,_template_body text)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  _bindings jsonb:=coalesce(_config->'variable_bindings','{}'::jsonb); _parameter_count integer; _binding_count integer:=0; _allowed text[];
  _order public.orders%rowtype; _customer public.customers%rowtype; _order_id uuid; _customer_id uuid; _store_name text; _orders_count integer:=0;
  _lifetime_value numeric:=0; _last_order_at timestamptz; _days_without_order integer:=0; _params jsonb:='[]'::jsonb; _i integer; _code text; _value text;
begin
  _parameter_count:=private.whatsapp_template_parameter_count(_template_body); _allowed:=private.automation_event_variable_codes(_event_code);
  if coalesce(array_length(_allowed,1),0)=0 then raise exception 'AUTOMATION_EVENT_NOT_SUPPORTED' using errcode='P0001'; end if;
  if jsonb_typeof(_bindings)<>'object' then raise exception 'INVALID_VARIABLE_BINDINGS' using errcode='P0001'; end if;
  select count(*)::integer into _binding_count from jsonb_object_keys(_bindings); if _binding_count<>_parameter_count then raise exception 'VARIABLE_BINDING_COUNT_MISMATCH' using errcode='P0001'; end if;
  if _event_code like 'pedido_%' then
    begin _order_id:=nullif(_payload->>'order_id','')::uuid; exception when others then _order_id:=null; end;
    if _order_id is null then raise exception 'ORDER_REQUIRED' using errcode='P0001'; end if;
    select * into _order from public.orders o where o.id=_order_id and o.store_id=_store_id; if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0001'; end if;
    _customer_id:=_order.customer_id;
  else begin _customer_id:=nullif(_payload->>'customer_id','')::uuid; exception when others then _customer_id:=null; end; end if;
  if _customer_id is null then raise exception 'CUSTOMER_REQUIRED' using errcode='P0001'; end if;
  select * into _customer from public.customers c where c.id=_customer_id and c.store_id=_store_id; if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0001'; end if;
  select s.name into _store_name from public.stores s where s.id=_store_id; if _store_name is null then raise exception 'STORE_NOT_FOUND' using errcode='P0001'; end if;
  select count(*)::integer,coalesce(sum(o.total_amount),0),max(coalesce(o.finished_at,o.updated_at,o.created_at)) into _orders_count,_lifetime_value,_last_order_at
  from public.orders o where o.store_id=_store_id and o.customer_id=_customer_id and o.status in ('entregue'::public.order_status,'retirado'::public.order_status);
  if _last_order_at is not null then _days_without_order:=greatest(0,floor(extract(epoch from (now()-_last_order_at))/86400)::integer); end if;
  if _parameter_count=0 then return jsonb_build_object('customer_id',_customer_id,'variables',jsonb_build_object('body_parameters','[]'::jsonb)); end if;
  for _i in 1.._parameter_count loop
    _code:=nullif(btrim(_bindings->>(_i::text)),''); if _code is null then raise exception 'VARIABLE_BINDING_REQUIRED' using errcode='P0001'; end if;
    if not (_code=any(_allowed)) then raise exception 'VARIABLE_BINDING_NOT_ALLOWED' using errcode='P0001',detail=_code; end if;
    _value:=case _code
      when 'cliente.nome' then nullif(btrim(_customer.first_name),'') when 'cliente.telefone' then nullif(btrim(_customer.phone),'') when 'loja.nome' then nullif(btrim(_store_name),'')
      when 'cliente.total_pedidos' then _orders_count::text when 'cliente.valor_total_compras' then 'R$ '||replace(to_char(coalesce(_lifetime_value,0),'FM999999999990.00'),'.',',')
      when 'cliente.ultimo_pedido_em' then coalesce(to_char(_last_order_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI'),'Sem pedido anterior') when 'cliente.dias_sem_pedir' then _days_without_order::text
      when 'pedido.numero' then case when _order.id is not null then _order.order_number::text else null end
      when 'pedido.valor_total' then case when _order.id is not null then 'R$ '||replace(to_char(coalesce(_order.total_amount,0),'FM999999999990.00'),'.',',') else null end
      when 'pedido.taxa_entrega' then case when _order.id is not null then 'R$ '||replace(to_char(coalesce(_order.delivery_fee,0),'FM999999999990.00'),'.',',') else null end
      when 'pedido.tempo_estimado' then case when _order.id is not null then coalesce(_order.eta_minutes::text||' min','A confirmar') else null end
      when 'pedido.data' then case when _order.id is not null then to_char(_order.created_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') else null end
      when 'pedido.status' then case when _order.id is not null then case _order.status::text
        when 'aguardando_confirmacao' then 'Aguardando confirmação' when 'aceito' then 'Aceito' when 'em_preparo' then 'Em preparo' when 'pronto' then 'Pronto'
        when 'aguardando_entregador' then 'Aguardando entregador' when 'saiu_para_entrega' then 'Saiu para entrega' when 'entregue' then 'Entregue'
        when 'aguardando_retirada' then 'Aguardando retirada' when 'retirado' then 'Retirado' when 'recusado' then 'Recusado' when 'cancelado' then 'Cancelado'
        else replace(_order.status::text,'_',' ') end else null end else null end;
    if _value is null or btrim(_value)='' then raise exception 'AUTOMATION_VARIABLE_VALUE_MISSING' using errcode='P0001',detail=_code; end if;
    _params:=_params||jsonb_build_array(_value);
  end loop;
  return jsonb_build_object('customer_id',_customer_id,'variables',jsonb_build_object('body_parameters',_params));
end;
$$;
