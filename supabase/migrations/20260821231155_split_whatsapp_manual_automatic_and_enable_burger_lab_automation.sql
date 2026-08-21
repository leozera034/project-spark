insert into public.addon_catalog(code,name,description,category,billing_model,availability_status,is_active,sort_order,metadata)
values(
  'whatsapp_manual',
  'WhatsApp Manual',
  'Conecte o WhatsApp da loja ao Comandiva e envie mensagens manualmente pelo painel.',
  'automation',
  'flat',
  'beta',
  true,
  41,
  jsonb_build_object('mode','manual','includes_automatic',false)
)
on conflict (code) do update set
  name=excluded.name,
  description=excluded.description,
  category=excluded.category,
  billing_model=excluded.billing_model,
  availability_status=excluded.availability_status,
  is_active=true,
  sort_order=excluded.sort_order,
  metadata=public.addon_catalog.metadata || excluded.metadata,
  updated_at=now();

update public.addon_catalog
set name='WhatsApp Automático',
    description='Inclui o modo manual e envia atualizações de pedido automaticamente pelo WhatsApp.',
    billing_model='flat',
    availability_status='beta',
    metadata=metadata || jsonb_build_object('mode','automatic','includes_manual',true),
    updated_at=now()
where code='whatsapp_automation';

insert into public.addon_entitlements(addon_id,feature_code,default_limit,config)
select a.id,'whatsapp_manual',null,'{}'::jsonb
from public.addon_catalog a where a.code='whatsapp_manual'
on conflict (addon_id,feature_code) do update set default_limit=excluded.default_limit,config=excluded.config;

insert into public.addon_entitlements(addon_id,feature_code,default_limit,config)
select a.id,'whatsapp_manual',null,jsonb_build_object('included_by','whatsapp_automation')
from public.addon_catalog a where a.code='whatsapp_automation'
on conflict (addon_id,feature_code) do update set default_limit=excluded.default_limit,config=excluded.config;

insert into public.addon_entitlements(addon_id,feature_code,default_limit,config)
select a.id,'whatsapp_automation',null,'{}'::jsonb
from public.addon_catalog a where a.code='whatsapp_automation'
on conflict (addon_id,feature_code) do update set default_limit=excluded.default_limit,config=excluded.config;

insert into public.addon_prices(addon_id,billing_interval,amount_cents,currency,trial_days,is_active)
select a.id,'monthly',1490,'BRL',0,true from public.addon_catalog a where a.code='whatsapp_manual'
on conflict (addon_id,billing_interval) do update set
  amount_cents=excluded.amount_cents,currency=excluded.currency,trial_days=excluded.trial_days,
  metering_metric_code=null,included_units=null,overage_unit_amount_micros=null,hard_limit_units=null,is_active=true,updated_at=now();

insert into public.addon_prices(addon_id,billing_interval,amount_cents,currency,trial_days,is_active)
select a.id,'monthly',3990,'BRL',0,true from public.addon_catalog a where a.code='whatsapp_automation'
on conflict (addon_id,billing_interval) do update set
  amount_cents=excluded.amount_cents,currency=excluded.currency,trial_days=excluded.trial_days,
  metering_metric_code=null,included_units=null,overage_unit_amount_micros=null,hard_limit_units=null,is_active=true,updated_at=now();

create or replace function public.get_store_evolution_whatsapp_connection(_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_account private.integration_provider_accounts%rowtype;
  v_request private.whatsapp_provisioning_requests%rowtype;
  v_manual_subscription boolean := false;
  v_automatic_subscription boolean := false;
  v_manual_entitled boolean := false;
  v_automatic_entitled boolean := false;
begin
  perform private.require_growth_access(_store_id);

  select exists(
    select 1 from public.store_addon_subscriptions s
    join public.addon_catalog a on a.id=s.addon_id
    where s.store_id=_store_id
      and a.code='whatsapp_manual'
      and s.status in ('active','trial','grace_period','complimentary')
  ) into v_manual_subscription;

  select exists(
    select 1 from public.store_addon_subscriptions s
    join public.addon_catalog a on a.id=s.addon_id
    where s.store_id=_store_id
      and a.code='whatsapp_automation'
      and s.status in ('active','trial','grace_period','complimentary')
  ) into v_automatic_subscription;

  v_manual_entitled := private.store_has_entitlement(_store_id,'whatsapp_manual');
  v_automatic_entitled := private.store_has_entitlement(_store_id,'whatsapp_automation');

  select * into v_account
  from private.integration_provider_accounts a
  where a.store_id=_store_id
    and a.provider='evolution_api'
    and a.connection_key='whatsapp_primary'
  order by a.updated_at desc
  limit 1;

  select * into v_request
  from private.whatsapp_provisioning_requests r
  where r.store_id=_store_id
  order by r.created_at desc
  limit 1;

  return jsonb_strip_nulls(jsonb_build_object(
    'configured', v_account.id is not null,
    'connected', coalesce(v_account.status='connected',false),
    'status', coalesce(v_account.status,'disconnected'),
    'instance_name', coalesce(v_account.public_config->>'instance_name',v_account.external_account_id),
    'display_phone_number', v_account.public_config->>'display_phone_number',
    'connected_at', v_account.connected_at,
    'last_health_at', v_account.last_health_at,
    'last_error', v_account.last_error,
    'provisioning_request_id', v_request.id,
    'provisioning_status', coalesce(v_request.status,'not_requested'),
    'manual_subscription', v_manual_subscription,
    'automatic_subscription', v_automatic_subscription,
    'manual_entitled', v_manual_entitled,
    'automatic_entitled', v_automatic_entitled,
    'paid_subscription', v_manual_subscription or v_automatic_subscription,
    'can_provision', (v_manual_subscription and v_manual_entitled) or (v_automatic_subscription and v_automatic_entitled)
  ));
end;
$$;

create or replace function public.prepare_evolution_manual_send(_store_id uuid,_phone text,_body text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_phone text;
  v_body text := btrim(coalesce(_body,''));
  v_account private.integration_provider_accounts%rowtype;
begin
  perform private.require_growth_access(_store_id);
  if not (
    private.store_has_entitlement(_store_id,'whatsapp_manual')
    or private.store_has_entitlement(_store_id,'whatsapp_automation')
  ) then
    raise exception 'ADDON_REQUIRED' using errcode='P0001',detail=jsonb_build_object('feature_code','whatsapp_manual')::text;
  end if;

  if length(v_body) < 1 or length(v_body) > 4096 then
    raise exception 'INVALID_MESSAGE_BODY' using errcode='22023';
  end if;

  v_phone := private.normalize_whatsapp_e164(_phone);
  if v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'INVALID_WHATSAPP_PHONE' using errcode='22023';
  end if;

  select * into v_account
  from private.integration_provider_accounts a
  where a.store_id=_store_id
    and a.provider='evolution_api'
    and a.connection_key='whatsapp_primary'
    and a.status='connected'
  order by a.connected_at desc nulls last,a.updated_at desc
  limit 1;

  if not found then raise exception 'EVOLUTION_WHATSAPP_NOT_CONNECTED' using errcode='P0001'; end if;

  return jsonb_build_object(
    'recipient_e164',v_phone,
    'body',v_body,
    'instance_name',coalesce(v_account.public_config->>'instance_name',v_account.external_account_id)
  );
end;
$$;

create or replace function public.backend_record_evolution_manual_send(
  _store_id uuid,_recipient_e164 text,_body text,_provider_message_id text,_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_id uuid;
  v_customer_id uuid;
begin
  if _provider_message_id is null or length(btrim(_provider_message_id)) < 6 then
    raise exception 'INVALID_PROVIDER_MESSAGE_ID' using errcode='22023';
  end if;

  select c.id into v_customer_id
  from public.customers c
  where c.store_id=_store_id
    and private.normalize_whatsapp_e164(c.phone)=_recipient_e164
  order by c.updated_at desc
  limit 1;

  select m.id into v_id
  from private.outbound_messages m
  where m.store_id=_store_id and m.provider='evolution_api' and m.provider_message_id=_provider_message_id
  limit 1;

  if v_id is null then
    insert into private.outbound_messages(
      store_id,customer_id,channel,purpose,recipient_e164,provider,provider_message_id,
      status,body_snapshot,sent_at,metadata
    ) values(
      _store_id,v_customer_id,'whatsapp','transactional',_recipient_e164,'evolution_api',
      left(btrim(_provider_message_id),512),'sent',left(_body,4096),now(),
      jsonb_build_object('source','manual','actor_user_id',_actor_user_id)
    ) returning id into v_id;
  end if;

  perform private.record_integration_usage(
    _store_id,'evolution_api','whatsapp_manual','messages',1,0,0,
    'whatsapp:manual:' || left(btrim(_provider_message_id),120),now(),
    jsonb_build_object('source','manual','outbound_message_id',v_id,'provider_message_id',left(btrim(_provider_message_id),512))
  );
  return v_id;
end;
$$;

with target_store as (
  select id from public.stores where slug='comandiva-burger-lab' limit 1
), template_map as (
  select t.store_id,t.id as template_id,t.code
  from public.store_message_templates t
  join target_store s on s.id=t.store_id
  where t.channel='whatsapp' and t.is_active and t.code in (
    'pedido_criado','pedido_aceito','pedido_em_preparo','pedido_pronto','pedido_aguardando_entregador',
    'pedido_saiu_para_entrega','pedido_aguardando_retirada','pedido_entregue','pedido_retirado','pedido_recusado','pedido_cancelado'
  )
), configs as (
  select store_id,template_id,code,
    case code
      when 'pedido_criado' then jsonb_build_object('1','cliente.nome','2','pedido.numero','3','loja.nome','4','pedido.valor_total')
      when 'pedido_aceito' then jsonb_build_object('1','pedido.numero','2','pedido.tempo_estimado')
      when 'pedido_aguardando_retirada' then jsonb_build_object('1','pedido.numero','2','loja.nome')
      when 'pedido_entregue' then jsonb_build_object('1','pedido.numero','2','loja.nome')
      when 'pedido_retirado' then jsonb_build_object('1','pedido.numero','2','loja.nome')
      when 'pedido_recusado' then jsonb_build_object('1','pedido.numero','2','loja.nome')
      when 'pedido_cancelado' then jsonb_build_object('1','pedido.numero','2','loja.nome')
      else jsonb_build_object('1','pedido.numero')
    end as bindings
  from template_map
)
insert into public.store_automation_rules(store_id,event_code,action_code,name,is_enabled,config)
select store_id,code,'send_whatsapp_template','WhatsApp automático · ' || code,true,
       jsonb_build_object('mode','automatic','template_id',template_id,'variable_bindings',bindings)
from configs
on conflict (store_id,event_code,name) do update set
  action_code=excluded.action_code,
  is_enabled=true,
  config=excluded.config,
  updated_at=now();