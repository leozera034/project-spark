create or replace function private.whatsapp_template_parameter_count(_body text)
returns integer
language plpgsql
immutable
set search_path to 'pg_catalog','pg_temp'
as $function$
declare
  _match text[];
  _index integer;
  _max integer := 0;
  _seen integer[] := array[]::integer[];
  _i integer;
begin
  if _body is null or _body = '' then return 0; end if;
  if regexp_replace(_body, '\{\{[0-9]+\}\}', '', 'g') ~ '\{\{|\}\}' then
    raise exception 'INVALID_TEMPLATE_VARIABLE_SYNTAX' using errcode='P0001';
  end if;
  for _match in select regexp_matches(_body, '\{\{([0-9]+)\}\}', 'g') loop
    _index := (_match[1])::integer;
    if _index < 1 or _index > 20 then raise exception 'INVALID_TEMPLATE_VARIABLE_INDEX' using errcode='P0001'; end if;
    _max := greatest(_max,_index);
    if not (_index = any(_seen)) then _seen := array_append(_seen,_index); end if;
  end loop;
  if _max = 0 then return 0; end if;
  for _i in 1.._max loop
    if not (_i = any(_seen)) then raise exception 'NON_SEQUENTIAL_TEMPLATE_VARIABLES' using errcode='P0001'; end if;
  end loop;
  return _max;
end;
$function$;

create or replace function private.automation_event_variable_codes(_event_code text)
returns text[]
language sql
immutable
set search_path to 'pg_catalog','pg_temp'
as $function$
  select case
    when _event_code like 'pedido_%' then array[
      'cliente.nome','cliente.telefone','loja.nome',
      'pedido.numero','pedido.valor_total','pedido.taxa_entrega','pedido.tempo_estimado','pedido.status','pedido.data',
      'cliente.total_pedidos','cliente.valor_total_compras','cliente.ultimo_pedido_em','cliente.dias_sem_pedir'
    ]::text[]
    when _event_code in ('novo_cliente','cliente_inativo_30d','cliente_vip') then array[
      'cliente.nome','cliente.telefone','loja.nome',
      'cliente.total_pedidos','cliente.valor_total_compras','cliente.ultimo_pedido_em','cliente.dias_sem_pedir'
    ]::text[]
    else array[]::text[]
  end
$function$;

create or replace function private.resolve_whatsapp_automation_context(
  _store_id uuid,_event_code text,_payload jsonb,_config jsonb,_template_body text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _bindings jsonb := coalesce(_config->'variable_bindings','{}'::jsonb);
  _parameter_count integer;
  _binding_count integer := 0;
  _allowed text[];
  _order public.orders%rowtype;
  _customer public.customers%rowtype;
  _order_id uuid;
  _customer_id uuid;
  _store_name text;
  _orders_count integer := 0;
  _lifetime_value numeric := 0;
  _last_order_at timestamptz;
  _days_without_order integer := 0;
  _params jsonb := '[]'::jsonb;
  _i integer;
  _code text;
  _value text;
begin
  _parameter_count := private.whatsapp_template_parameter_count(_template_body);
  _allowed := private.automation_event_variable_codes(_event_code);
  if coalesce(array_length(_allowed,1),0) = 0 then raise exception 'AUTOMATION_EVENT_NOT_SUPPORTED' using errcode='P0001'; end if;
  if jsonb_typeof(_bindings) <> 'object' then raise exception 'INVALID_VARIABLE_BINDINGS' using errcode='P0001'; end if;
  select count(*)::integer into _binding_count from jsonb_object_keys(_bindings);
  if _binding_count <> _parameter_count then raise exception 'VARIABLE_BINDING_COUNT_MISMATCH' using errcode='P0001'; end if;

  if _event_code like 'pedido_%' then
    begin _order_id := nullif(_payload->>'order_id','')::uuid; exception when others then _order_id := null; end;
    if _order_id is null then raise exception 'ORDER_REQUIRED' using errcode='P0001'; end if;
    select * into _order from public.orders o where o.id=_order_id and o.store_id=_store_id;
    if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0001'; end if;
    _customer_id := _order.customer_id;
  else
    begin _customer_id := nullif(_payload->>'customer_id','')::uuid; exception when others then _customer_id := null; end;
  end if;

  if _customer_id is null then raise exception 'CUSTOMER_REQUIRED' using errcode='P0001'; end if;
  select * into _customer from public.customers c where c.id=_customer_id and c.store_id=_store_id;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0001'; end if;
  select s.name into _store_name from public.stores s where s.id=_store_id;
  if _store_name is null then raise exception 'STORE_NOT_FOUND' using errcode='P0001'; end if;

  select count(*)::integer,coalesce(sum(o.total_amount),0),max(o.created_at)
  into _orders_count,_lifetime_value,_last_order_at
  from public.orders o
  where o.store_id=_store_id and o.customer_id=_customer_id
    and o.status in ('entregue'::public.order_status,'retirado'::public.order_status);

  if _last_order_at is not null then
    _days_without_order := greatest(0,floor(extract(epoch from (now()-_last_order_at))/86400)::integer);
  end if;

  if _parameter_count = 0 then
    return jsonb_build_object('customer_id',_customer_id,'variables',jsonb_build_object('body_parameters','[]'::jsonb));
  end if;

  for _i in 1.._parameter_count loop
    _code := nullif(btrim(_bindings->>(_i::text)),'');
    if _code is null then raise exception 'VARIABLE_BINDING_REQUIRED' using errcode='P0001'; end if;
    if not (_code = any(_allowed)) then raise exception 'VARIABLE_BINDING_NOT_ALLOWED' using errcode='P0001',detail=_code; end if;

    _value := case _code
      when 'cliente.nome' then nullif(btrim(_customer.first_name),'')
      when 'cliente.telefone' then nullif(btrim(_customer.phone),'')
      when 'loja.nome' then nullif(btrim(_store_name),'')
      when 'cliente.total_pedidos' then _orders_count::text
      when 'cliente.valor_total_compras' then 'R$ ' || replace(to_char(coalesce(_lifetime_value,0),'FM999999999990.00'),'.',',')
      when 'cliente.ultimo_pedido_em' then coalesce(to_char(_last_order_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI'),'Sem pedido anterior')
      when 'cliente.dias_sem_pedir' then _days_without_order::text
      when 'pedido.numero' then case when _order.id is not null then _order.order_number::text else null end
      when 'pedido.valor_total' then case when _order.id is not null then 'R$ ' || replace(to_char(coalesce(_order.total_amount,0),'FM999999999990.00'),'.',',') else null end
      when 'pedido.taxa_entrega' then case when _order.id is not null then 'R$ ' || replace(to_char(coalesce(_order.delivery_fee,0),'FM999999999990.00'),'.',',') else null end
      when 'pedido.tempo_estimado' then case when _order.id is not null then coalesce(_order.eta_minutes::text || ' min','A confirmar') else null end
      when 'pedido.data' then case when _order.id is not null then to_char(_order.created_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') else null end
      when 'pedido.status' then case when _order.id is not null then
        case _order.status::text
          when 'aguardando_confirmacao' then 'Aguardando confirmação'
          when 'aceito' then 'Aceito'
          when 'em_preparo' then 'Em preparo'
          when 'pronto' then 'Pronto'
          when 'aguardando_entregador' then 'Aguardando entregador'
          when 'saiu_para_entrega' then 'Saiu para entrega'
          when 'entregue' then 'Entregue'
          when 'aguardando_retirada' then 'Aguardando retirada'
          when 'retirado' then 'Retirado'
          when 'recusado' then 'Recusado'
          when 'cancelado' then 'Cancelado'
          else replace(_order.status::text,'_',' ')
        end
      else null end
      else null
    end;
    if _value is null or btrim(_value)='' then raise exception 'AUTOMATION_VARIABLE_VALUE_MISSING' using errcode='P0001',detail=_code; end if;
    _params := _params || jsonb_build_array(_value);
  end loop;

  return jsonb_build_object('customer_id',_customer_id,'variables',jsonb_build_object('body_parameters',_params));
end;
$function$;

create or replace function public.get_store_automation_builder_catalog(_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare _events jsonb; _templates jsonb;
begin
  if not private.is_store_manager(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  with event_defs(position,code,label,description) as (
    values
      (1,'novo_cliente','Novo cliente','Quando um cliente é criado na loja.'),
      (2,'pedido_criado','Pedido criado','Assim que um novo pedido entra no Comandiva.'),
      (3,'pedido_aceito','Pedido aceito','Quando a loja aceita o pedido.'),
      (4,'pedido_em_preparo','Pedido em preparo','Quando o preparo é iniciado.'),
      (5,'pedido_pronto','Pedido pronto','Quando o pedido fica pronto.'),
      (6,'pedido_aguardando_entregador','Aguardando entregador','Quando o pedido aguarda um entregador.'),
      (7,'pedido_saiu_para_entrega','Saiu para entrega','Quando o pedido sai para entrega.'),
      (8,'pedido_entregue','Pedido entregue','Quando uma entrega é concluída.'),
      (9,'pedido_retirado','Pedido retirado','Quando uma retirada é concluída.'),
      (10,'pedido_recusado','Pedido recusado','Quando a loja recusa o pedido.'),
      (11,'pedido_cancelado','Pedido cancelado','Quando o pedido é cancelado.'),
      (12,'pedido_concluido','Pedido concluído','Evento geral para entrega ou retirada concluída.'),
      (13,'cliente_vip','Cliente VIP','Quando o motor de segmentos identificar um cliente VIP.'),
      (14,'cliente_inativo_30d','Cliente inativo há 30 dias','Quando o motor de segmentos identificar inatividade.')
  ), variable_defs(position,code,label) as (
    values
      (1,'cliente.nome','Nome do cliente'),(2,'cliente.telefone','Telefone do cliente'),(3,'loja.nome','Nome da loja'),
      (4,'pedido.numero','Número do pedido'),(5,'pedido.valor_total','Valor total do pedido'),(6,'pedido.taxa_entrega','Taxa de entrega'),
      (7,'pedido.tempo_estimado','Tempo estimado'),(8,'pedido.status','Status do pedido'),(9,'pedido.data','Data e hora do pedido'),
      (10,'cliente.total_pedidos','Total de pedidos concluídos'),(11,'cliente.valor_total_compras','Valor total em compras'),
      (12,'cliente.ultimo_pedido_em','Data do último pedido'),(13,'cliente.dias_sem_pedir','Dias sem pedir')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'code',e.code,'label',e.label,'description',e.description,
    'variables',coalesce((select jsonb_agg(jsonb_build_object('code',v.code,'label',v.label) order by v.position)
      from variable_defs v where v.code = any(private.automation_event_variable_codes(e.code))),'[]'::jsonb)
  ) order by e.position),'[]'::jsonb) into _events from event_defs e;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'name',t.name,'code',t.code,'purpose',t.purpose,'provider_template_name',t.provider_template_name,
    'provider_language',t.provider_language,'parameter_count',private.whatsapp_template_parameter_count(t.body)
  ) order by t.name),'[]'::jsonb) into _templates
  from public.store_message_templates t
  where t.store_id=_store_id and t.channel='whatsapp' and t.is_active and t.provider_status='approved' and t.provider_template_name is not null;

  return jsonb_build_object('events',_events,'templates',_templates);
end;
$function$;

create or replace function public.save_store_automation_rule(
  _store_id uuid,_id uuid,_event_code text,_name text,_enabled boolean,_config jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  result_id uuid; _access jsonb; _mode text; _action_code text; _template_id uuid;
  _template public.store_message_templates%rowtype; _provider text; _parameter_count integer; _binding_count integer := 0;
  _bindings jsonb; _allowed text[]; _code text; _i integer; _clean_config jsonb; _safe_name text := btrim(coalesce(_name,''));
begin
  if not private.is_store_manager(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if char_length(_safe_name) not between 2 and 120 then raise exception 'INVALID_AUTOMATION_NAME' using errcode='P0001'; end if;
  _access := public.get_store_billing_access(_store_id);
  if not coalesce((_access->>'can_use_growth')::boolean,true) then raise exception 'BILLING_RESTRICTED' using errcode='P0001',detail=jsonb_build_object('stage',_access->>'stage','capability','growth')::text; end if;
  if _event_code not in ('novo_cliente','pedido_criado','pedido_aceito','pedido_em_preparo','pedido_pronto','pedido_aguardando_entregador','pedido_saiu_para_entrega','pedido_entregue','pedido_retirado','pedido_recusado','pedido_cancelado','pedido_concluido','cliente_inativo_30d','cliente_vip') then raise exception 'INVALID_AUTOMATION_EVENT' using errcode='P0001'; end if;
  _mode := coalesce(nullif(_config->>'mode',''),'assisted');
  if _mode not in ('assisted','automatic') then raise exception 'INVALID_AUTOMATION_MODE' using errcode='P0001'; end if;
  _action_code := case when _mode='automatic' then 'send_whatsapp_template' else 'sugerir_whatsapp' end;

  if _mode='automatic' then
    perform private.require_store_entitlement(_store_id,'whatsapp_automation');
    begin _template_id := (_config->>'template_id')::uuid; exception when others then _template_id := null; end;
    if _template_id is null then raise exception 'MESSAGE_TEMPLATE_REQUIRED' using errcode='P0001'; end if;
    select * into _template from public.store_message_templates t where t.id=_template_id and t.store_id=_store_id and t.channel='whatsapp' and t.is_active;
    if not found then raise exception 'MESSAGE_TEMPLATE_REQUIRED' using errcode='P0001'; end if;
    _parameter_count := private.whatsapp_template_parameter_count(_template.body);
    _bindings := coalesce(_config->'variable_bindings','{}'::jsonb);
    if jsonb_typeof(_bindings) <> 'object' then raise exception 'INVALID_VARIABLE_BINDINGS' using errcode='P0001'; end if;
    select count(*)::integer into _binding_count from jsonb_object_keys(_bindings);
    if _binding_count <> _parameter_count then raise exception 'VARIABLE_BINDING_COUNT_MISMATCH' using errcode='P0001'; end if;
    _allowed := private.automation_event_variable_codes(_event_code);
    if _parameter_count > 0 then
      for _i in 1.._parameter_count loop
        _code := nullif(btrim(_bindings->>(_i::text)),'');
        if _code is null then raise exception 'VARIABLE_BINDING_REQUIRED' using errcode='P0001',detail=_i::text; end if;
        if not (_code = any(_allowed)) then raise exception 'VARIABLE_BINDING_NOT_ALLOWED' using errcode='P0001',detail=_code; end if;
      end loop;
    end if;
    if coalesce(_enabled,true) then
      if _template.provider_status <> 'approved' or _template.provider_template_name is null then raise exception 'MESSAGE_TEMPLATE_NOT_PROVIDER_APPROVED' using errcode='P0001'; end if;
      _provider := private.resolve_whatsapp_provider(_store_id);
      if _provider is null then raise exception 'WHATSAPP_PROVIDER_NOT_CONNECTED' using errcode='P0001'; end if;
    end if;
    _clean_config := jsonb_build_object('mode','automatic','template_id',_template_id,'variable_bindings',_bindings);
  else
    _clean_config := jsonb_build_object('mode','assisted');
  end if;

  if _id is null then
    insert into public.store_automation_rules(store_id,event_code,action_code,name,is_enabled,config)
    values(_store_id,_event_code,_action_code,_safe_name,coalesce(_enabled,true),_clean_config) returning id into result_id;
  else
    update public.store_automation_rules set event_code=_event_code,action_code=_action_code,name=_safe_name,is_enabled=coalesce(_enabled,true),config=_clean_config,updated_at=now()
    where id=_id and store_id=_store_id returning id into result_id;
    if result_id is null then raise exception 'RULE_NOT_FOUND' using errcode='P0001'; end if;
  end if;
  return result_id;
end;
$function$;

create or replace function public.prepare_whatsapp_automation_job(_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','vault','pg_temp'
as $function$
declare
  _job private.automation_jobs%rowtype; _template public.store_message_templates%rowtype; _customer_id uuid; _template_id uuid;
  _campaign_id uuid; _message_id uuid; _message private.outbound_messages%rowtype; _account private.integration_provider_accounts%rowtype;
  _context jsonb; _variables jsonb := '{}'::jsonb; _phone_number_id text; _waba_id text; _graph_version text;
begin
  select * into _job from private.automation_jobs j where j.id=_job_id for update;
  if not found then raise exception 'AUTOMATION_JOB_NOT_FOUND' using errcode='P0001'; end if;
  if _job.status <> 'processing' or _job.action_code <> 'send_whatsapp_template' then raise exception 'AUTOMATION_JOB_NOT_PROCESSING' using errcode='P0001'; end if;
  begin _template_id := (_job.payload->'rule_config'->>'template_id')::uuid; exception when others then _template_id := null; end;
  begin _campaign_id := nullif(_job.payload->>'campaign_id','')::uuid; exception when others then _campaign_id := null; end;
  if _template_id is null then raise exception 'MESSAGE_TEMPLATE_REQUIRED' using errcode='P0001'; end if;
  select * into _template from public.store_message_templates t where t.id=_template_id and t.store_id=_job.store_id and t.channel='whatsapp' and t.is_active;
  if not found then raise exception 'MESSAGE_TEMPLATE_NOT_FOUND' using errcode='P0001'; end if;

  _context := private.resolve_whatsapp_automation_context(_job.store_id,_job.event_code,coalesce(_job.payload,'{}'::jsonb),coalesce(_job.payload->'rule_config','{}'::jsonb),_template.body);
  begin _customer_id := (_context->>'customer_id')::uuid; exception when others then _customer_id := null; end;
  if _customer_id is null then raise exception 'CUSTOMER_REQUIRED' using errcode='P0001'; end if;
  _variables := coalesce(_context->'variables','{}'::jsonb);
  _message_id := private.queue_whatsapp_dispatch(_job.store_id,_customer_id,_template.purpose,_template.id,_campaign_id,_job.id,_variables,'automation-job:'||_job.id::text);
  select * into _message from private.outbound_messages m where m.id=_message_id for update;
  if not found then raise exception 'OUTBOUND_MESSAGE_NOT_FOUND' using errcode='P0001'; end if;
  if _message.provider <> 'meta_whatsapp' then raise exception 'WHATSAPP_PROVIDER_NOT_SUPPORTED_BY_META_WORKER' using errcode='P0001'; end if;
  select * into _account from private.integration_provider_accounts a where a.store_id=_job.store_id and a.provider='meta_whatsapp' and a.status='connected' order by a.connected_at desc nulls last,a.created_at desc limit 1;
  if not found then raise exception 'WHATSAPP_PROVIDER_NOT_CONNECTED' using errcode='P0001'; end if;
  if _account.credential_ref is null or btrim(_account.credential_ref)='' then raise exception 'WHATSAPP_PROVIDER_CREDENTIAL_MISSING' using errcode='P0001'; end if;
  _phone_number_id := nullif(btrim(_account.public_config->>'phone_number_id'),'');
  _waba_id := nullif(btrim(coalesce(_account.public_config->>'waba_id',_account.external_account_id)),'');
  _graph_version := nullif(btrim(_account.public_config->>'graph_api_version'),'');
  if _phone_number_id is null or _phone_number_id !~ '^[0-9]{5,30}$' then raise exception 'WHATSAPP_PHONE_NUMBER_ID_MISSING' using errcode='P0001'; end if;
  if _graph_version is null or _graph_version !~ '^v[0-9]{1,3}\.[0-9]{1,2}$' then raise exception 'WHATSAPP_GRAPH_VERSION_MISSING' using errcode='P0001'; end if;
  update private.outbound_messages set status='sending',error_code=null,error_message=null,updated_at=now() where id=_message.id and status in ('queued','sending');
  return jsonb_build_object('job_id',_job.id,'store_id',_job.store_id,'message_id',_message.id,'recipient_e164',_message.recipient_e164,'provider',_message.provider,'purpose',_message.purpose,'template_id',_template.id,'template_name',_template.provider_template_name,'template_language',_template.provider_language,'variables',coalesce(_message.variables,'{}'::jsonb),'credential_ref',_account.credential_ref,'phone_number_id',_phone_number_id,'waba_id',_waba_id,'graph_api_version',_graph_version,'attempt_count',_job.attempt_count,'max_attempts',_job.max_attempts);
end;
$function$;

create or replace function private.capture_order_created_automation()
returns trigger language plpgsql security definer set search_path to 'public','private','pg_temp'
as $function$
begin
  if new.customer_id is null then return new; end if;
  begin
    perform private.emit_store_automation_event(new.store_id,'pedido_criado',jsonb_build_object('order_id',new.id,'customer_id',new.customer_id,'status',new.status::text),'order:'||new.id::text||':pedido_criado');
  exception when others then
    begin insert into private.automation_event_failures(store_id,event_code,source_table,source_id,error_code,error_message,payload)
      values(new.store_id,'pedido_criado','orders',new.id,sqlstate,left(sqlerrm,500),jsonb_build_object('order_id',new.id,'customer_id',new.customer_id,'status',new.status::text)); exception when others then null; end;
  end;
  return new;
end;
$function$;

create or replace function private.capture_order_status_automation()
returns trigger language plpgsql security definer set search_path to 'public','private','pg_temp'
as $function$
declare _event_code text;
begin
  if old.status is not distinct from new.status or new.customer_id is null then return new; end if;
  _event_code := case new.status::text
    when 'aceito' then 'pedido_aceito' when 'em_preparo' then 'pedido_em_preparo' when 'pronto' then 'pedido_pronto'
    when 'aguardando_entregador' then 'pedido_aguardando_entregador' when 'saiu_para_entrega' then 'pedido_saiu_para_entrega'
    when 'entregue' then 'pedido_entregue' when 'retirado' then 'pedido_retirado' when 'recusado' then 'pedido_recusado'
    when 'cancelado' then 'pedido_cancelado' else null end;
  if _event_code is not null then
    begin perform private.emit_store_automation_event(new.store_id,_event_code,jsonb_build_object('order_id',new.id,'customer_id',new.customer_id,'status',new.status::text),'order:'||new.id::text||':'||_event_code);
    exception when others then begin insert into private.automation_event_failures(store_id,event_code,source_table,source_id,error_code,error_message,payload)
      values(new.store_id,_event_code,'orders',new.id,sqlstate,left(sqlerrm,500),jsonb_build_object('order_id',new.id,'customer_id',new.customer_id,'status',new.status::text)); exception when others then null; end; end;
  end if;
  if new.status in ('entregue'::public.order_status,'retirado'::public.order_status) and old.status not in ('entregue'::public.order_status,'retirado'::public.order_status) then
    begin perform private.emit_store_automation_event(new.store_id,'pedido_concluido',jsonb_build_object('order_id',new.id,'customer_id',new.customer_id,'status',new.status::text),'order:'||new.id::text||':pedido_concluido');
    exception when others then begin insert into private.automation_event_failures(store_id,event_code,source_table,source_id,error_code,error_message,payload)
      values(new.store_id,'pedido_concluido','orders',new.id,sqlstate,left(sqlerrm,500),jsonb_build_object('order_id',new.id,'customer_id',new.customer_id,'status',new.status::text)); exception when others then null; end; end;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_order_completed_automation on public.orders;
drop trigger if exists trg_order_created_automation on public.orders;
drop trigger if exists trg_order_status_automation on public.orders;
create trigger trg_order_created_automation after insert on public.orders for each row execute function private.capture_order_created_automation();
create trigger trg_order_status_automation after update of status on public.orders for each row execute function private.capture_order_status_automation();

revoke all on function private.whatsapp_template_parameter_count(text) from public,anon,authenticated;
revoke all on function private.automation_event_variable_codes(text) from public,anon,authenticated;
revoke all on function private.resolve_whatsapp_automation_context(uuid,text,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function private.capture_order_created_automation() from public,anon,authenticated;
revoke all on function private.capture_order_status_automation() from public,anon,authenticated;
revoke all on function public.get_store_automation_builder_catalog(uuid) from public,anon;
grant execute on function public.get_store_automation_builder_catalog(uuid) to authenticated;
revoke all on function public.save_store_automation_rule(uuid,uuid,text,text,boolean,jsonb) from public,anon;
grant execute on function public.save_store_automation_rule(uuid,uuid,text,text,boolean,jsonb) to authenticated;
revoke all on function public.prepare_whatsapp_automation_job(uuid) from public,anon,authenticated;
grant execute on function public.prepare_whatsapp_automation_job(uuid) to service_role;
