-- Comandiva WhatsApp: faster dispatch, richer order context and safer transient retries.

create or replace function private.kick_whatsapp_worker()
returns bigint
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','vault','net','pg_temp'
as $function$
declare
  _project_url text;
  _worker_secret text;
  _request_id bigint;
begin
  select nullif(btrim(s.decrypted_secret),'') into _project_url
  from vault.decrypted_secrets s where s.name='comandiva_project_url' limit 1;
  select nullif(btrim(s.decrypted_secret),'') into _worker_secret
  from vault.decrypted_secrets s where s.name='comandiva_whatsapp_worker_secret' limit 1;
  if _project_url is null or _worker_secret is null then return null; end if;

  select net.http_post(
    url := rtrim(_project_url,'/') || '/functions/v1/comandiva-whatsapp-worker',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-comandiva-worker-secret',_worker_secret
    ),
    body := jsonb_build_object('source','event','limit',10),
    timeout_milliseconds := 20000
  ) into _request_id;
  return _request_id;
exception when others then
  -- Cron remains the fallback; order writes must never fail because of a worker kick.
  return null;
end;
$function$;

revoke all on function private.kick_whatsapp_worker() from public,anon,authenticated;
grant execute on function private.kick_whatsapp_worker() to service_role;

create or replace function private.emit_store_automation_event(
  _store_id uuid,
  _event_code text,
  _payload jsonb default '{}'::jsonb,
  _dedupe_key text default null
)
returns integer
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _rule record;
  _count integer := 0;
  _job_dedupe text;
begin
  for _rule in
    select r.id,r.action_code,r.config
    from public.store_automation_rules r
    where r.store_id=_store_id and r.event_code=_event_code and r.is_enabled
  loop
    _job_dedupe := case when _dedupe_key is null then null else _dedupe_key || ':rule:' || _rule.id::text end;
    perform private.enqueue_automation_job(
      _store_id,_rule.id,_event_code,_rule.action_code,
      coalesce(_payload,'{}'::jsonb) || jsonb_build_object('rule_config',coalesce(_rule.config,'{}'::jsonb)),
      _job_dedupe,now(),5
    );
    _count := _count + 1;
  end loop;

  if _count > 0 then
    perform private.kick_whatsapp_worker();
  end if;
  return _count;
end;
$function$;

revoke all on function private.emit_store_automation_event(uuid,text,jsonb,text) from public,anon,authenticated;

create or replace function public.fail_whatsapp_automation_job(
  _job_id uuid,
  _message_id uuid default null,
  _error_code text default 'WORKER_ERROR',
  _error_message text default null,
  _retryable boolean default false
)
returns text
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _job private.automation_jobs%rowtype;
  _retry boolean;
  _delay_seconds integer;
  _safe_code text := left(coalesce(nullif(btrim(_error_code),''),'WORKER_ERROR'),120);
  _safe_message text := left(coalesce(_error_message,''),500);
begin
  select * into _job from private.automation_jobs j where j.id=_job_id for update;
  if not found then raise exception 'AUTOMATION_JOB_NOT_FOUND' using errcode='P0001'; end if;

  -- A 401 is a definite rejection before message acceptance, so retry is safe.
  -- Ambiguous 5xx responses remain non-retryable to avoid duplicate customer messages.
  _retry := (
    coalesce(_retryable,false)
    or _safe_code in ('EVOLUTION_HTTP_401','EVOLUTION_401')
  ) and _job.attempt_count < _job.max_attempts;
  _delay_seconds := least(3600,30 * (2 ^ greatest(_job.attempt_count-1,0))::integer);

  if _message_id is not null then
    if _retry then
      update private.outbound_messages m
      set status='queued',error_code=_safe_code,error_message=_safe_message,updated_at=now()
      where m.id=_message_id and m.automation_job_id=_job_id and m.provider_message_id is null;
    else
      update private.outbound_messages m
      set status=case when m.provider_message_id is null then 'failed' else m.status end,
          failed_at=case when m.provider_message_id is null then coalesce(m.failed_at,now()) else m.failed_at end,
          error_code=_safe_code,error_message=_safe_message,updated_at=now()
      where m.id=_message_id and m.automation_job_id=_job_id;
    end if;
  end if;

  if _retry then
    update private.automation_jobs
    set status='queued',available_at=now()+make_interval(secs=>_delay_seconds),
        locked_at=null,locked_by=null,
        last_error=_safe_code||case when _safe_message<>'' then ': '||_safe_message else '' end,
        updated_at=now()
    where id=_job_id;
    return 'queued';
  end if;

  update private.automation_jobs
  set status='failed',locked_at=null,locked_by=null,
      last_error=_safe_code||case when _safe_message<>'' then ': '||_safe_message else '' end,
      updated_at=now()
  where id=_job_id;
  return 'failed';
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
      'cliente.nome','cliente.telefone','loja.nome','loja.endereco',
      'pedido.numero','pedido.itens','pedido.subtotal','pedido.valor_total','pedido.taxa_entrega',
      'pedido.forma_pagamento','pedido.modalidade','pedido.endereco','pedido.bairro','pedido.troco',
      'pedido.tempo_estimado','pedido.status','pedido.data','pedido.observacao','pedido.motivo','pedido.proxima_etapa',
      'cliente.total_pedidos','cliente.valor_total_compras','cliente.ultimo_pedido_em','cliente.dias_sem_pedir'
    ]::text[]
    when _event_code in ('novo_cliente','cliente_inativo_30d','cliente_vip') then array[
      'cliente.nome','cliente.telefone','loja.nome','loja.endereco',
      'cliente.total_pedidos','cliente.valor_total_compras','cliente.ultimo_pedido_em','cliente.dias_sem_pedir'
    ]::text[]
    else array[]::text[]
  end
$function$;

create or replace function private.resolve_whatsapp_automation_context(
  _store_id uuid,
  _event_code text,
  _payload jsonb,
  _config jsonb,
  _template_body text
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
  _store public.stores%rowtype;
  _order_id uuid;
  _customer_id uuid;
  _orders_count integer := 0;
  _lifetime_value numeric := 0;
  _last_order_at timestamptz;
  _days_without_order integer := 0;
  _params jsonb := '[]'::jsonb;
  _i integer;
  _code text;
  _value text;
  _order_items text;
  _delivery_address text;
  _store_address text;
begin
  _parameter_count := private.whatsapp_template_parameter_count(_template_body);
  _allowed := private.automation_event_variable_codes(_event_code);
  if coalesce(array_length(_allowed,1),0)=0 then raise exception 'AUTOMATION_EVENT_NOT_SUPPORTED' using errcode='P0001'; end if;
  if jsonb_typeof(_bindings)<>'object' then raise exception 'INVALID_VARIABLE_BINDINGS' using errcode='P0001'; end if;
  select count(*)::integer into _binding_count from jsonb_object_keys(_bindings);
  if _binding_count<>_parameter_count then raise exception 'VARIABLE_BINDING_COUNT_MISMATCH' using errcode='P0001'; end if;

  if _event_code like 'pedido_%' then
    begin _order_id:=nullif(_payload->>'order_id','')::uuid; exception when others then _order_id:=null; end;
    if _order_id is null then raise exception 'ORDER_REQUIRED' using errcode='P0001'; end if;
    select * into _order from public.orders o where o.id=_order_id and o.store_id=_store_id;
    if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0001'; end if;
    _customer_id:=_order.customer_id;
  else
    begin _customer_id:=nullif(_payload->>'customer_id','')::uuid; exception when others then _customer_id:=null; end;
  end if;

  if _customer_id is null then raise exception 'CUSTOMER_REQUIRED' using errcode='P0001'; end if;
  select * into _customer from public.customers c where c.id=_customer_id and c.store_id=_store_id;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0001'; end if;
  select * into _store from public.stores s where s.id=_store_id;
  if not found then raise exception 'STORE_NOT_FOUND' using errcode='P0001'; end if;

  select count(*)::integer,coalesce(sum(o.total_amount),0),max(coalesce(o.finished_at,o.updated_at,o.created_at))
  into _orders_count,_lifetime_value,_last_order_at
  from public.orders o
  where o.store_id=_store_id and o.customer_id=_customer_id
    and o.status in ('entregue'::public.order_status,'retirado'::public.order_status);
  if _last_order_at is not null then
    _days_without_order:=greatest(0,floor(extract(epoch from (now()-_last_order_at))/86400)::integer);
  end if;

  if _order.id is not null then
    select left(coalesce(string_agg(
      '• ' ||
      case when oi.quantity=trunc(oi.quantity) then trunc(oi.quantity)::text else replace(to_char(oi.quantity,'FM999999990.###'),'.',',') end ||
      'x ' || oi.product_name ||
      case when nullif(btrim(coalesce(oi.variant_name,'')),'') is not null then ' · '||btrim(oi.variant_name) else '' end ||
      ' — R$ '||replace(to_char(coalesce(oi.line_total,0),'FM999999999990.00'),'.',',') ||
      coalesce((
        select E'\n  ↳ ' || string_agg(
          case when oo.quantity>1 then oo.quantity::text||'x ' else '' end || oo.option_name,
          E'\n  ↳ ' order by oo.created_at,oo.id
        )
        from public.order_item_options oo where oo.order_item_id=oi.id
      ),'') ||
      case when nullif(btrim(coalesce(oi.notes,'')),'') is not null then E'\n  📝 '||left(btrim(oi.notes),180) else '' end,
      E'\n' order by oi.sort_order,oi.id
    ),'Itens registrados no pedido'),900)
    into _order_items
    from public.order_items oi
    where oi.order_id=_order.id and oi.store_id=_store_id;

    _delivery_address := coalesce(
      nullif(btrim(concat_ws(', ',
        nullif(btrim(_order.address_snapshot->>'street'),''),
        case
          when coalesce((_order.address_snapshot->>'hasNoNumber')::boolean,false) then 's/n'
          else nullif(btrim(_order.address_snapshot->>'number'),'')
        end
      )) ||
      case when nullif(btrim(coalesce(_order.address_snapshot->>'complement','')),'') is not null then ' · '||btrim(_order.address_snapshot->>'complement') else '' end ||
      case when nullif(btrim(coalesce(_order.neighborhood_snapshot,_order.address_snapshot->>'neighborhoodName','')),'') is not null then ' · '||btrim(coalesce(_order.neighborhood_snapshot,_order.address_snapshot->>'neighborhoodName')) else '' end,''),
      'Endereço informado no pedido'
    );
  end if;

  _store_address := coalesce(
    nullif(btrim(_store.address_line),''),
    nullif(btrim(concat_ws(', ',nullif(btrim(_store.street),''),nullif(btrim(_store.address_number),''))),'') ||
      case when nullif(btrim(_store.neighborhood),'') is not null then ' · '||btrim(_store.neighborhood) else '' end,
    nullif(btrim(concat_ws('/',nullif(btrim(_store.city),''),nullif(btrim(_store.state),''))),'') ,
    'Endereço da loja'
  );

  if _parameter_count=0 then
    return jsonb_build_object('customer_id',_customer_id,'variables',jsonb_build_object('body_parameters','[]'::jsonb));
  end if;

  for _i in 1.._parameter_count loop
    _code:=nullif(btrim(_bindings->>(_i::text)),'');
    if _code is null then raise exception 'VARIABLE_BINDING_REQUIRED' using errcode='P0001'; end if;
    if not (_code=any(_allowed)) then raise exception 'VARIABLE_BINDING_NOT_ALLOWED' using errcode='P0001',detail=_code; end if;

    _value:=case _code
      when 'cliente.nome' then coalesce(nullif(btrim(_customer.first_name),''),'Cliente')
      when 'cliente.telefone' then coalesce(nullif(btrim(_customer.phone),''),'Não informado')
      when 'loja.nome' then coalesce(nullif(btrim(_store.name),''),'Loja')
      when 'loja.endereco' then _store_address
      when 'cliente.total_pedidos' then _orders_count::text
      when 'cliente.valor_total_compras' then 'R$ '||replace(to_char(coalesce(_lifetime_value,0),'FM999999999990.00'),'.',',')
      when 'cliente.ultimo_pedido_em' then coalesce(to_char(_last_order_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI'),'Sem pedido anterior')
      when 'cliente.dias_sem_pedir' then _days_without_order::text
      when 'pedido.numero' then _order.order_number::text
      when 'pedido.itens' then coalesce(_order_items,'Itens registrados no pedido')
      when 'pedido.subtotal' then 'R$ '||replace(to_char(coalesce(_order.items_subtotal,0),'FM999999999990.00'),'.',',')
      when 'pedido.valor_total' then 'R$ '||replace(to_char(coalesce(_order.total_amount,0),'FM999999999990.00'),'.',',')
      when 'pedido.taxa_entrega' then 'R$ '||replace(to_char(coalesce(_order.delivery_fee,0),'FM999999999990.00'),'.',',')
      when 'pedido.forma_pagamento' then coalesce(nullif(btrim(_order.payment_method_label),''),nullif(btrim(_order.payment_method_kind),''),'A confirmar')
      when 'pedido.modalidade' then case when _order.fulfillment::text='entrega' then 'Entrega' else 'Retirada na loja' end
      when 'pedido.endereco' then case when _order.fulfillment::text='entrega' then _delivery_address else _store_address end
      when 'pedido.bairro' then coalesce(nullif(btrim(_order.neighborhood_snapshot),''),nullif(btrim(_order.address_snapshot->>'neighborhoodName'),''),'Não informado')
      when 'pedido.troco' then case when _order.change_for is null then 'Sem troco' else 'Troco para R$ '||replace(to_char(_order.change_for,'FM999999999990.00'),'.',',') end
      when 'pedido.tempo_estimado' then coalesce(_order.eta_minutes::text||' min','A confirmar')
      when 'pedido.data' then to_char(_order.created_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')
      when 'pedido.observacao' then coalesce(nullif(btrim(_order.customer_notes),''),'Sem observações')
      when 'pedido.motivo' then coalesce(nullif(btrim(_order.rejection_reason),''),nullif(btrim(_order.cancellation_reason),''),nullif(btrim(_order.customer_visible_message),''),'Consulte a loja para mais detalhes')
      when 'pedido.proxima_etapa' then case when _order.fulfillment::text='entrega' then 'aguardar o entregador' else 'retirada na loja' end
      when 'pedido.status' then case _order.status::text
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
      else null
    end;
    if _value is null or btrim(_value)='' then raise exception 'AUTOMATION_VARIABLE_VALUE_MISSING' using errcode='P0001',detail=_code; end if;
    _params:=_params||jsonb_build_array(left(_value,1024));
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
declare
  _events jsonb;
  _templates jsonb;
  _provider text;
begin
  if not private.is_store_manager(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  _provider := private.resolve_whatsapp_provider(_store_id);

  with event_defs(position,code,label,description) as (
    values
      (1,'novo_cliente','Novo cliente','Quando um cliente é criado na loja.'),
      (2,'pedido_criado','Pedido criado','Assim que um novo pedido entra no Comandiva.'),
      (3,'pedido_aceito','Pedido aceito','Quando a loja aceita o pedido.'),
      (4,'pedido_em_preparo','Pedido em preparo','Quando o preparo é iniciado.'),
      (5,'pedido_pronto','Pedido pronto','Quando o pedido fica pronto.'),
      (6,'pedido_aguardando_entregador','Aguardando entregador','Quando o pedido aguarda um entregador.'),
      (7,'pedido_saiu_para_entrega','Saiu para entrega','Quando o pedido sai para entrega.'),
      (8,'pedido_aguardando_retirada','Aguardando retirada','Quando o pedido está pronto e aguardando retirada do cliente.'),
      (9,'pedido_entregue','Pedido entregue','Quando uma entrega é concluída.'),
      (10,'pedido_retirado','Pedido retirado','Quando uma retirada é concluída.'),
      (11,'pedido_recusado','Pedido recusado','Quando a loja recusa o pedido.'),
      (12,'pedido_cancelado','Pedido cancelado','Quando o pedido é cancelado.'),
      (13,'pedido_concluido','Pedido concluído','Evento geral para entrega ou retirada concluída.'),
      (14,'cliente_vip','Cliente VIP','Quando o motor de segmentos identificar um cliente VIP.'),
      (15,'cliente_inativo_30d','Cliente inativo há 30 dias','Quando o motor de segmentos identificar inatividade.')
  ), variable_defs(position,code,label) as (
    values
      (1,'cliente.nome','Nome do cliente'),(2,'cliente.telefone','Telefone do cliente'),
      (3,'loja.nome','Nome da loja'),(4,'loja.endereco','Endereço da loja'),
      (5,'pedido.numero','Número do pedido'),(6,'pedido.itens','Itens do pedido'),
      (7,'pedido.subtotal','Subtotal'),(8,'pedido.valor_total','Valor total'),(9,'pedido.taxa_entrega','Taxa de entrega'),
      (10,'pedido.forma_pagamento','Forma de pagamento'),(11,'pedido.modalidade','Entrega ou retirada'),
      (12,'pedido.endereco','Endereço de entrega/retirada'),(13,'pedido.bairro','Bairro'),(14,'pedido.troco','Troco'),
      (15,'pedido.tempo_estimado','Tempo estimado'),(16,'pedido.status','Status do pedido'),(17,'pedido.data','Data e hora'),
      (18,'pedido.observacao','Observação do cliente'),(19,'pedido.motivo','Motivo de recusa/cancelamento'),
      (20,'pedido.proxima_etapa','Próxima etapa'),
      (21,'cliente.total_pedidos','Total de pedidos concluídos'),(22,'cliente.valor_total_compras','Valor total em compras'),
      (23,'cliente.ultimo_pedido_em','Data do último pedido'),(24,'cliente.dias_sem_pedir','Dias sem pedir')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'code',e.code,'label',e.label,'description',e.description,
    'variables',coalesce((select jsonb_agg(jsonb_build_object('code',v.code,'label',v.label) order by v.position)
      from variable_defs v where v.code = any(private.automation_event_variable_codes(e.code))),'[]'::jsonb)
  ) order by e.position),'[]'::jsonb) into _events from event_defs e;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'name',t.name,'code',t.code,'purpose',t.purpose,'provider_template_name',t.provider_template_name,
    'provider_language',t.provider_language,'parameter_count',private.whatsapp_template_parameter_count(t.body),
    'provider_status',t.provider_status
  ) order by t.name),'[]'::jsonb) into _templates
  from public.store_message_templates t
  where t.store_id=_store_id and t.channel='whatsapp' and t.is_active
    and (_provider='evolution_api' or (t.provider_status='approved' and t.provider_template_name is not null));

  return jsonb_build_object('events',_events,'templates',_templates,'provider',_provider);
end;
$function$;

create or replace function private.seed_default_order_whatsapp_templates(_store_id uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $function$
begin
  insert into public.store_message_templates(
    store_id,code,name,channel,purpose,body,provider_language,provider_status,is_active
  )
  select _store_id,v.code,v.name,'whatsapp','transactional',v.body,'pt_BR','draft',true
  from (values
    ('pedido_criado','Pedido recebido',E'🧾 *Pedido #{{2}} recebido!*\n\nOlá, {{1}}! A {{3}} recebeu seu pedido.\n\n🍔 *Itens*\n{{4}}\n\n🚚 *Modalidade:* {{5}}\n💳 *Pagamento:* {{6}}\n💰 *Total:* {{7}}\n\nAssim que a loja confirmar, avisamos por aqui.'),
    ('pedido_aceito','Pedido confirmado',E'✅ *Pedido #{{1}} confirmado!*\n\n⏱ *Previsão:* {{2}}\n🚚 *Modalidade:* {{3}}\n💳 *Pagamento:* {{4}}\n💰 *Total:* {{5}}\n\nJá estamos cuidando de tudo por aqui.'),
    ('pedido_em_preparo','Pedido em preparo',E'👨‍🍳 *Pedido #{{1}} em preparo!*\n\nSua comida já está sendo preparada.\n⏱ *Previsão:* {{2}}\n\nAvisamos assim que avançar para a próxima etapa.'),
    ('pedido_pronto','Pedido pronto',E'✅ *Pedido #{{1}} pronto!*\n\n📦 Próxima etapa: {{2}}.\n\nContinuaremos avisando por aqui.'),
    ('pedido_aguardando_entregador','Aguardando entregador',E'🛵 *Pedido #{{1}} pronto!*\n\nEstamos aguardando um entregador.\n📍 *Destino:* {{2}}\n\nAssim que sair para entrega, avisamos.'),
    ('pedido_saiu_para_entrega','Saiu para entrega',E'🛵💨 *Pedido #{{1}} saiu para entrega!*\n\n📍 *Destino:* {{2}}\n💰 *Total:* {{3}}\n\nFique de olho no celular. Seu pedido está a caminho!'),
    ('pedido_aguardando_retirada','Pronto para retirada',E'📦 *Pedido #{{1}} pronto para retirada!*\n\nVocê já pode buscar na {{2}}.\n📍 {{3}}\n\nAté já 😊'),
    ('pedido_entregue','Pedido entregue',E'✅ *Pedido #{{1}} entregue!*\n\nObrigado por escolher a {{2}} 💜\nEsperamos que aproveite seu pedido!'),
    ('pedido_retirado','Pedido retirado',E'✅ *Pedido #{{1}} retirado!*\n\nObrigado por escolher a {{2}} 💜\nEsperamos que aproveite seu pedido!'),
    ('pedido_recusado','Pedido não aceito',E'⚠️ *Pedido #{{1}} não aceito*\n\nMotivo: {{2}}\n\nSe precisar, fale com a {{3}}.'),
    ('pedido_cancelado','Pedido cancelado',E'⚠️ *Pedido #{{1}} cancelado*\n\nMotivo: {{2}}\n\nSe precisar, fale com a {{3}}.'),
    ('pedido_concluido','Pedido concluído',E'💜 *Pedido #{{1}} concluído!*\n\nObrigado pela preferência e por escolher a {{2}}. Até o próximo pedido!')
  ) as v(code,name,body)
  on conflict (store_id,code) do nothing;
end;
$function$;

-- Upgrade only untouched system defaults. Merchant-customized templates are preserved.
update public.store_message_templates set body=E'🧾 *Pedido #{{2}} recebido!*\n\nOlá, {{1}}! A {{3}} recebeu seu pedido.\n\n🍔 *Itens*\n{{4}}\n\n🚚 *Modalidade:* {{5}}\n💳 *Pagamento:* {{6}}\n💰 *Total:* {{7}}\n\nAssim que a loja confirmar, avisamos por aqui.',updated_at=now()
where code='pedido_criado' and body='Olá {{1}}! Recebemos seu pedido #{{2}} na {{3}}. Total: {{4}}. Assim que a loja confirmar, avisamos por aqui.';
update public.store_message_templates set body=E'✅ *Pedido #{{1}} confirmado!*\n\n⏱ *Previsão:* {{2}}\n🚚 *Modalidade:* {{3}}\n💳 *Pagamento:* {{4}}\n💰 *Total:* {{5}}\n\nJá estamos cuidando de tudo por aqui.',updated_at=now()
where code='pedido_aceito' and body='Pedido #{{1}} confirmado ✅ Previsão: {{2}}. Estamos cuidando de tudo por aqui.';
update public.store_message_templates set body=E'👨‍🍳 *Pedido #{{1}} em preparo!*\n\nSua comida já está sendo preparada.\n⏱ *Previsão:* {{2}}\n\nAvisamos assim que avançar para a próxima etapa.',updated_at=now()
where code='pedido_em_preparo' and body='Seu pedido #{{1}} entrou em preparo 🍳. Avisamos quando estiver pronto.';
update public.store_message_templates set body=E'✅ *Pedido #{{1}} pronto!*\n\n📦 Próxima etapa: {{2}}.\n\nContinuaremos avisando por aqui.',updated_at=now()
where code='pedido_pronto' and body='Seu pedido #{{1}} está pronto ✅. Estamos organizando a próxima etapa.';
update public.store_message_templates set body=E'🛵 *Pedido #{{1}} pronto!*\n\nEstamos aguardando um entregador.\n📍 *Destino:* {{2}}\n\nAssim que sair para entrega, avisamos.',updated_at=now()
where code='pedido_aguardando_entregador' and body='Seu pedido #{{1}} está pronto e aguardando um entregador. Assim que sair, avisamos por aqui.';
update public.store_message_templates set body=E'🛵💨 *Pedido #{{1}} saiu para entrega!*\n\n📍 *Destino:* {{2}}\n💰 *Total:* {{3}}\n\nFique de olho no celular. Seu pedido está a caminho!',updated_at=now()
where code='pedido_saiu_para_entrega' and body='Seu pedido #{{1}} saiu para entrega 🛵. Fique de olho no celular e aguarde o entregador.';
update public.store_message_templates set body=E'📦 *Pedido #{{1}} pronto para retirada!*\n\nVocê já pode buscar na {{2}}.\n📍 {{3}}\n\nAté já 😊',updated_at=now()
where code='pedido_aguardando_retirada' and body='Seu pedido #{{1}} está pronto para retirada na {{2}}. Pode vir buscar 😊';
update public.store_message_templates set body=E'✅ *Pedido #{{1}} entregue!*\n\nObrigado por escolher a {{2}} 💜\nEsperamos que aproveite seu pedido!',updated_at=now()
where code='pedido_entregue' and body='Pedido #{{1}} entregue ✅ Obrigado por escolher a {{2}}!';
update public.store_message_templates set body=E'✅ *Pedido #{{1}} retirado!*\n\nObrigado por escolher a {{2}} 💜\nEsperamos que aproveite seu pedido!',updated_at=now()
where code='pedido_retirado' and body='Pedido #{{1}} retirado ✅ Obrigado por escolher a {{2}}!';
update public.store_message_templates set body=E'⚠️ *Pedido #{{1}} não aceito*\n\nMotivo: {{2}}\n\nSe precisar, fale com a {{3}}.',updated_at=now()
where code='pedido_recusado' and body='Não conseguimos aceitar o pedido #{{1}} desta vez. Se precisar, fale com a {{2}}.';
update public.store_message_templates set body=E'⚠️ *Pedido #{{1}} cancelado*\n\nMotivo: {{2}}\n\nSe precisar, fale com a {{3}}.',updated_at=now()
where code='pedido_cancelado' and body='O pedido #{{1}} foi cancelado. Se precisar de ajuda, fale com a {{2}}.';
update public.store_message_templates set body=E'💜 *Pedido #{{1}} concluído!*\n\nObrigado pela preferência e por escolher a {{2}}. Até o próximo pedido!',updated_at=now()
where code='pedido_concluido' and body='Pedido #{{1}} concluído ✅ Obrigado pela preferência e por escolher a {{2}}!';

-- Align automatic rules only when they reference the upgraded system template.
with defs(code,body,bindings) as (values
  ('pedido_criado',E'🧾 *Pedido #{{2}} recebido!*\n\nOlá, {{1}}! A {{3}} recebeu seu pedido.\n\n🍔 *Itens*\n{{4}}\n\n🚚 *Modalidade:* {{5}}\n💳 *Pagamento:* {{6}}\n💰 *Total:* {{7}}\n\nAssim que a loja confirmar, avisamos por aqui.','{"1":"cliente.nome","2":"pedido.numero","3":"loja.nome","4":"pedido.itens","5":"pedido.modalidade","6":"pedido.forma_pagamento","7":"pedido.valor_total"}'::jsonb),
  ('pedido_aceito',E'✅ *Pedido #{{1}} confirmado!*\n\n⏱ *Previsão:* {{2}}\n🚚 *Modalidade:* {{3}}\n💳 *Pagamento:* {{4}}\n💰 *Total:* {{5}}\n\nJá estamos cuidando de tudo por aqui.','{"1":"pedido.numero","2":"pedido.tempo_estimado","3":"pedido.modalidade","4":"pedido.forma_pagamento","5":"pedido.valor_total"}'::jsonb),
  ('pedido_em_preparo',E'👨‍🍳 *Pedido #{{1}} em preparo!*\n\nSua comida já está sendo preparada.\n⏱ *Previsão:* {{2}}\n\nAvisamos assim que avançar para a próxima etapa.','{"1":"pedido.numero","2":"pedido.tempo_estimado"}'::jsonb),
  ('pedido_pronto',E'✅ *Pedido #{{1}} pronto!*\n\n📦 Próxima etapa: {{2}}.\n\nContinuaremos avisando por aqui.','{"1":"pedido.numero","2":"pedido.proxima_etapa"}'::jsonb),
  ('pedido_aguardando_entregador',E'🛵 *Pedido #{{1}} pronto!*\n\nEstamos aguardando um entregador.\n📍 *Destino:* {{2}}\n\nAssim que sair para entrega, avisamos.','{"1":"pedido.numero","2":"pedido.endereco"}'::jsonb),
  ('pedido_saiu_para_entrega',E'🛵💨 *Pedido #{{1}} saiu para entrega!*\n\n📍 *Destino:* {{2}}\n💰 *Total:* {{3}}\n\nFique de olho no celular. Seu pedido está a caminho!','{"1":"pedido.numero","2":"pedido.endereco","3":"pedido.valor_total"}'::jsonb),
  ('pedido_aguardando_retirada',E'📦 *Pedido #{{1}} pronto para retirada!*\n\nVocê já pode buscar na {{2}}.\n📍 {{3}}\n\nAté já 😊','{"1":"pedido.numero","2":"loja.nome","3":"loja.endereco"}'::jsonb),
  ('pedido_entregue',E'✅ *Pedido #{{1}} entregue!*\n\nObrigado por escolher a {{2}} 💜\nEsperamos que aproveite seu pedido!','{"1":"pedido.numero","2":"loja.nome"}'::jsonb),
  ('pedido_retirado',E'✅ *Pedido #{{1}} retirado!*\n\nObrigado por escolher a {{2}} 💜\nEsperamos que aproveite seu pedido!','{"1":"pedido.numero","2":"loja.nome"}'::jsonb),
  ('pedido_recusado',E'⚠️ *Pedido #{{1}} não aceito*\n\nMotivo: {{2}}\n\nSe precisar, fale com a {{3}}.','{"1":"pedido.numero","2":"pedido.motivo","3":"loja.nome"}'::jsonb),
  ('pedido_cancelado',E'⚠️ *Pedido #{{1}} cancelado*\n\nMotivo: {{2}}\n\nSe precisar, fale com a {{3}}.','{"1":"pedido.numero","2":"pedido.motivo","3":"loja.nome"}'::jsonb),
  ('pedido_concluido',E'💜 *Pedido #{{1}} concluído!*\n\nObrigado pela preferência e por escolher a {{2}}. Até o próximo pedido!','{"1":"pedido.numero","2":"loja.nome"}'::jsonb)
)
update public.store_automation_rules r
set config=jsonb_set(coalesce(r.config,'{}'::jsonb),'{variable_bindings}',d.bindings,true),updated_at=now()
from public.store_message_templates t,defs d
where r.action_code='send_whatsapp_template'
  and nullif(r.config->>'template_id','')::uuid=t.id
  and t.code=d.code and t.body=d.body;
