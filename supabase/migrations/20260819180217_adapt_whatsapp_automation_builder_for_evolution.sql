create or replace function public.get_store_automation_builder_catalog(_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $$
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
    'provider_language',t.provider_language,'parameter_count',private.whatsapp_template_parameter_count(t.body),
    'provider_status',t.provider_status
  ) order by t.name),'[]'::jsonb) into _templates
  from public.store_message_templates t
  where t.store_id=_store_id
    and t.channel='whatsapp'
    and t.is_active
    and (
      _provider='evolution_api'
      or (t.provider_status='approved' and t.provider_template_name is not null)
    );

  return jsonb_build_object('events',_events,'templates',_templates,'provider',_provider);
end;
$$;

create or replace function public.save_store_automation_rule(_store_id uuid, _id uuid, _event_code text, _name text, _enabled boolean, _config jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  result_id uuid; _access jsonb; _mode text; _action_code text; _template_id uuid;
  _template public.store_message_templates%rowtype; _provider text; _parameter_count integer; _binding_count integer := 0;
  _bindings jsonb; _allowed text[]; _code text; _i integer; _clean_config jsonb; _safe_name text := btrim(coalesce(_name,''));
begin
  if not private.is_store_manager(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if char_length(_safe_name) not between 2 and 120 then raise exception 'INVALID_AUTOMATION_NAME' using errcode='P0001'; end if;
  _access := public.get_store_billing_access(_store_id);
  if not coalesce((_access->>'can_use_growth')::boolean,true) then raise exception 'BILLING_RESTRICTED' using errcode='P0001',detail=jsonb_build_object('stage',_access->>'stage','capability','growth')::text; end if;
  if _event_code not in ('novo_cliente','pedido_criado','pedido_aceito','pedido_em_preparo','pedido_pronto','pedido_aguardando_entregador','pedido_saiu_para_entrega','pedido_aguardando_retirada','pedido_entregue','pedido_retirado','pedido_recusado','pedido_cancelado','pedido_concluido','cliente_inativo_30d','cliente_vip') then raise exception 'INVALID_AUTOMATION_EVENT' using errcode='P0001'; end if;
  _mode := coalesce(nullif(_config->>'mode',''),'assisted');
  if _mode not in ('assisted','automatic') then raise exception 'INVALID_AUTOMATION_MODE' using errcode='P0001'; end if;
  _action_code := case when _mode='automatic' then 'send_whatsapp_template' else 'sugerir_whatsapp' end;
  if _mode='automatic' then
    perform private.require_store_entitlement(_store_id,'whatsapp_automation');
    begin _template_id := (_config->>'template_id')::uuid; exception when others then _template_id := null; end;
    if _template_id is null then raise exception 'MESSAGE_TEMPLATE_REQUIRED' using errcode='P0001'; end if;
    select * into _template from public.store_message_templates t where t.id=_template_id and t.store_id=_store_id and t.channel='whatsapp' and t.is_active;
    if not found then raise exception 'MESSAGE_TEMPLATE_REQUIRED' using errcode='P0001'; end if;
    if _event_code in ('cliente_inativo_30d','cliente_vip') and _template.purpose <> 'marketing' then
      raise exception 'CRM_AUTOMATION_REQUIRES_MARKETING_TEMPLATE' using errcode='P0001';
    end if;
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
        if not (_code=any(_allowed)) then raise exception 'VARIABLE_BINDING_NOT_ALLOWED' using errcode='P0001',detail=_code; end if;
      end loop;
    end if;
    if coalesce(_enabled,true) then
      _provider := private.resolve_whatsapp_provider(_store_id);
      if _provider is null then raise exception 'WHATSAPP_PROVIDER_NOT_CONNECTED' using errcode='P0001'; end if;
      if _provider <> 'evolution_api' and (_template.provider_status<>'approved' or _template.provider_template_name is null) then
        raise exception 'MESSAGE_TEMPLATE_NOT_PROVIDER_APPROVED' using errcode='P0001';
      end if;
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
$$;
