-- Separate payments handled by the store from payments processed online by Stripe.
-- The store may use both models at the same time. Online payments are opt-in and
-- only become public after Stripe Connect is operational.

alter table public.store_settings
  add column if not exists online_payments_enabled boolean not null default false,
  add column if not exists manual_pix_key text,
  add column if not exists manual_pix_key_type text,
  add column if not exists online_payment_terms_accepted_at timestamptz;

alter table public.store_settings
  drop constraint if exists store_settings_manual_pix_key_type_check;
alter table public.store_settings
  add constraint store_settings_manual_pix_key_type_check
  check (manual_pix_key_type is null or manual_pix_key_type in ('aleatoria','cpf_cnpj','email','telefone','outro'));

update public.payment_methods
set label='Cartão de crédito na maquininha',
    instructions='Pagamento presencial na entrega ou retirada. A confirmação do recebimento é responsabilidade da loja.',
    updated_at=now()
where kind='cartao_credito'::public.payment_method_kind
  and label='Cartão de crédito'
  and instructions is null;

update public.payment_methods
set label='Cartão de débito na maquininha',
    instructions='Pagamento presencial na entrega ou retirada. A confirmação do recebimento é responsabilidade da loja.',
    updated_at=now()
where kind='cartao_debito'::public.payment_method_kind
  and label='Cartão de débito'
  and instructions is null;

update public.payment_methods
set label='Dinheiro direto para a loja',
    instructions='Pagamento presencial na entrega ou retirada. A confirmação do recebimento é responsabilidade da loja.',
    updated_at=now()
where kind='dinheiro'::public.payment_method_kind
  and label='Dinheiro'
  and instructions is null;

create or replace function public.get_my_store_configuration(_store_id uuid default null::uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _sensitive boolean;
  _result jsonb;
begin
  perform private.require_permission('store.view_basic',_sid);
  _sensitive:=private.has_permission('store.update_profile',_sid);

  select jsonb_build_object(
    'store',jsonb_build_object(
      'id',s.id,'slug',s.slug,'name',s.name,'status',s.status,
      'legal_name',case when _sensitive then s.legal_name end,
      'document',case when _sensitive then s.document end,
      'segment',s.segment,'phone',s.phone,'whatsapp',s.whatsapp,'email',s.email,
      'postal_code',s.postal_code,'street',s.street,'address_number',s.address_number,
      'address_complement',s.address_complement,'neighborhood',s.neighborhood,
      'address_line',s.address_line,'city',s.city,'state',s.state,
      'latitude',s.latitude,'longitude',s.longitude,
      'location_source',s.location_source,'location_verified_at',s.location_verified_at,
      'location_accuracy_meters',s.location_accuracy_meters,
      'timezone',s.timezone,'accepts_delivery',s.accepts_delivery,'accepts_pickup',s.accepts_pickup,
      'updated_at',s.updated_at
    ),
    'settings',jsonb_build_object(
      'brand_primary',st.brand_primary,'brand_accent',st.brand_accent,'logo_path',st.logo_path,
      'cover_path',st.cover_path,'description',st.description,'welcome_message',st.welcome_message,
      'closed_message',st.closed_message,'min_order_amount',st.min_order_amount,
      'default_prep_minutes',st.default_prep_minutes,'sound_alert_enabled',st.sound_alert_enabled,
      'auto_open_by_hours',st.auto_open_by_hours,'manual_override_open',st.manual_override_open,
      'online_payments_enabled',coalesce(st.online_payments_enabled,false),
      'manual_pix_key',st.manual_pix_key,'manual_pix_key_type',st.manual_pix_key_type,
      'online_payment_terms_accepted_at',st.online_payment_terms_accepted_at,
      'updated_at',st.updated_at
    ),
    'payment_setup',jsonb_build_object(
      'online_enabled',coalesce(st.online_payments_enabled,false),
      'online_ready',coalesce(sc.details_submitted,false) and coalesce(sc.charges_enabled,false) and coalesce(sc.payouts_enabled,false) and coalesce(sc.transfers_enabled,false),
      'stripe_connected',sc.store_id is not null,
      'details_submitted',coalesce(sc.details_submitted,false),
      'charges_enabled',coalesce(sc.charges_enabled,false),
      'payouts_enabled',coalesce(sc.payouts_enabled,false),
      'transfers_enabled',coalesce(sc.transfers_enabled,false),
      'requirements_currently_due',coalesce(to_jsonb(sc.requirements_currently_due),'[]'::jsonb),
      'application_fee_bps',coalesce(sc.application_fee_bps_override,sc.application_fee_bps),
      'manual_pix_configured',nullif(btrim(coalesce(st.manual_pix_key,'')),'') is not null,
      'online_terms_accepted_at',st.online_payment_terms_accepted_at
    ),
    'hours',coalesce((
      select jsonb_agg(jsonb_build_object('weekday',h.weekday,'opens_at',to_char(h.opens_at,'HH24:MI'),'closes_at',to_char(h.closes_at,'HH24:MI')) order by h.weekday,h.opens_at)
      from public.store_hours h where h.store_id=_sid and h.is_active
    ),'[]'::jsonb),
    'neighborhoods',coalesce((
      select jsonb_agg(jsonb_build_object('id',n.id,'name',n.name,'delivery_fee',n.delivery_fee,'min_order_amount',n.min_order_amount,'eta_minutes',n.eta_minutes,'notes',n.notes,'is_active',n.is_active,'is_archived',n.is_archived,'sort_order',n.sort_order,'updated_at',n.updated_at) order by n.sort_order,n.name)
      from public.neighborhoods n where n.store_id=_sid
    ),'[]'::jsonb),
    'payment_methods',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'kind',p.kind,'label',p.label,'instructions',p.instructions,'needs_change',p.needs_change,
        'is_active',p.is_active,'available_for_delivery',p.available_for_delivery,'available_for_pickup',p.available_for_pickup,
        'processing_mode',case when p.kind='stripe_online'::public.payment_method_kind then 'online' else 'manual' end,
        'sort_order',p.sort_order,'updated_at',p.updated_at
      ) order by p.sort_order,p.label)
      from public.payment_methods p where p.store_id=_sid
    ),'[]'::jsonb),
    'can',jsonb_build_object(
      'update_profile',private.has_permission('store.update_profile',_sid),
      'manage_settings',private.has_permission('store.manage_settings',_sid),
      'manage_hours',private.has_permission('store.manage_hours',_sid),
      'manage_neighborhoods',private.has_permission('store.manage_neighborhoods',_sid),
      'manage_payment_methods',private.has_permission('store.manage_payment_methods',_sid)
    )
  ) into _result
  from public.stores s
  left join public.store_settings st on st.store_id=s.id
  left join private.stripe_connect_accounts sc on sc.store_id=s.id
  where s.id=_sid;

  if _result is null then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  return _result;
end;
$function$;

create or replace function public.set_my_store_online_payments(
  _store_id uuid,
  _enabled boolean,
  _acknowledge_fees boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _stripe private.stripe_connect_accounts%rowtype;
  _method_id uuid;
  _sort integer;
begin
  perform private.require_permission('store.manage_payment_methods',_sid);
  if coalesce(_enabled,false) then
    if not coalesce(_acknowledge_fees,false) then
      raise exception 'ONLINE_PAYMENT_TERMS_REQUIRED' using errcode='P0001';
    end if;
    select * into _stripe from private.stripe_connect_accounts where store_id=_sid;
    if not found
       or not coalesce(_stripe.details_submitted,false)
       or not coalesce(_stripe.charges_enabled,false)
       or not coalesce(_stripe.payouts_enabled,false)
       or not coalesce(_stripe.transfers_enabled,false) then
      raise exception 'STRIPE_CONNECT_NOT_READY' using errcode='P0001';
    end if;
  end if;

  update public.store_settings
     set online_payments_enabled=coalesce(_enabled,false),
         online_payment_terms_accepted_at=case when coalesce(_enabled,false) then coalesce(online_payment_terms_accepted_at,now()) else online_payment_terms_accepted_at end,
         updated_at=now()
   where store_id=_sid;

  select id into _method_id from public.payment_methods
  where store_id=_sid and kind='stripe_online'::public.payment_method_kind
  order by created_at,id limit 1;

  if _method_id is null then
    select coalesce(max(sort_order),-1)+1 into _sort from public.payment_methods where store_id=_sid;
    insert into public.payment_methods(store_id,kind,label,instructions,needs_change,is_active,sort_order,available_for_delivery,available_for_pickup)
    values(_sid,'stripe_online'::public.payment_method_kind,'Pagamento online','Pix ou cartão no ambiente seguro da Stripe. A confirmação do pagamento é automática.',false,coalesce(_enabled,false),_sort,true,true)
    returning id into _method_id;
  else
    update public.payment_methods
       set label='Pagamento online',instructions='Pix ou cartão no ambiente seguro da Stripe. A confirmação do pagamento é automática.',needs_change=false,
           is_active=coalesce(_enabled,false),available_for_delivery=true,available_for_pickup=true,updated_at=now()
     where id=_method_id and store_id=_sid;
  end if;

  update public.payment_methods set is_active=false,updated_at=now()
   where store_id=_sid and kind='stripe_online'::public.payment_method_kind and id<>_method_id;

  perform private.log_config_audit(_sid,case when coalesce(_enabled,false) then 'store.online_payments.enabled' else 'store.online_payments.disabled' end,'store_settings',_sid,array['online_payments_enabled','online_payment_terms_accepted_at']);
  return public.get_my_store_configuration(_sid);
end;
$function$;

create or replace function public.set_my_store_manual_pix(
  _store_id uuid,
  _enabled boolean,
  _pix_key text default null,
  _pix_key_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _key text;
  _type text;
  _existing_key text;
  _existing_type text;
  _method_id uuid;
  _sort integer;
  _instructions text;
begin
  perform private.require_permission('store.manage_payment_methods',_sid);
  select manual_pix_key,manual_pix_key_type into _existing_key,_existing_type from public.store_settings where store_id=_sid;
  _key:=nullif(btrim(coalesce(_pix_key,_existing_key,'')),'');
  _type:=lower(nullif(btrim(coalesce(_pix_key_type,_existing_type,'')),''));

  if _type is not null and _type not in ('aleatoria','cpf_cnpj','email','telefone','outro') then raise exception 'INVALID_PIX_KEY_TYPE' using errcode='P0001'; end if;
  if _key is not null and (length(_key)<3 or length(_key)>180) then raise exception 'INVALID_PIX_KEY' using errcode='P0001'; end if;
  if coalesce(_enabled,false) and _key is null then raise exception 'PIX_KEY_REQUIRED' using errcode='P0001'; end if;

  update public.store_settings set manual_pix_key=_key,manual_pix_key_type=_type,updated_at=now() where store_id=_sid;
  _instructions:=case when _key is null then null else
    'Chave Pix'||case _type when 'aleatoria' then ' aleatória' when 'cpf_cnpj' then ' CPF/CNPJ' when 'email' then ' e-mail' when 'telefone' then ' telefone' else '' end||': '||_key||E'\nA confirmação deste Pix é feita manualmente pela loja. Guarde o comprovante até a confirmação do pedido.'
  end;

  select id into _method_id from public.payment_methods
  where store_id=_sid and kind='pix'::public.payment_method_kind order by created_at,id limit 1;
  if _method_id is null then
    select coalesce(max(sort_order),-1)+1 into _sort from public.payment_methods where store_id=_sid;
    insert into public.payment_methods(store_id,kind,label,instructions,needs_change,is_active,sort_order,available_for_delivery,available_for_pickup)
    values(_sid,'pix'::public.payment_method_kind,'Pix direto para a loja',_instructions,false,coalesce(_enabled,false),_sort,true,true)
    returning id into _method_id;
  else
    update public.payment_methods
       set label='Pix direto para a loja',instructions=_instructions,needs_change=false,is_active=coalesce(_enabled,false),
           available_for_delivery=true,available_for_pickup=true,updated_at=now()
     where id=_method_id and store_id=_sid;
  end if;

  perform private.log_config_audit(_sid,case when coalesce(_enabled,false) then 'store.manual_pix.enabled' else 'store.manual_pix.disabled' end,'store_settings',_sid,array['manual_pix_key','manual_pix_key_type']);
  return public.get_my_store_configuration(_sid);
end;
$function$;

create or replace function public.update_store_payment_method(
  _store_id uuid,_id uuid,_label text,_instructions text,_needs_change boolean,_is_active boolean,
  _available_for_delivery boolean,_available_for_pickup boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _l text:=btrim(coalesce(_label,''));
  _pid uuid;
  _kind public.payment_method_kind;
begin
  perform private.require_permission('store.manage_payment_methods',_sid);
  select kind into _kind from public.payment_methods where id=_id and store_id=_sid;
  if _kind is null then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  if _kind in ('stripe_online'::public.payment_method_kind,'pix'::public.payment_method_kind) then raise exception 'MANAGED_PAYMENT_METHOD' using errcode='P0001'; end if;
  if length(_l)<2 or length(_l)>60 then raise exception 'INVALID_NAME' using errcode='P0001'; end if;
  if length(coalesce(_instructions,''))>400 then raise exception 'INVALID_INSTRUCTIONS' using errcode='P0001'; end if;
  if coalesce(_is_active,false) and not(coalesce(_available_for_delivery,false) or coalesce(_available_for_pickup,false)) then raise exception 'INVALID_AVAILABILITY' using errcode='P0001'; end if;
  update public.payment_methods
     set label=_l,instructions=nullif(btrim(coalesce(_instructions,'')),''),needs_change=coalesce(_needs_change,false),
         is_active=coalesce(_is_active,false),available_for_delivery=coalesce(_available_for_delivery,false),
         available_for_pickup=coalesce(_available_for_pickup,false),updated_at=now()
   where id=_id and store_id=_sid returning id into _pid;
  perform private.log_config_audit(_sid,'store.payment_method.updated','payment_methods',_pid,array['label','instructions','needs_change','is_active','available_for_delivery','available_for_pickup']);
  return public.get_my_store_configuration(_sid);
end;
$function$;

create or replace function public.storefront_payment_methods(_slug text, _fulfillment_type text default null::text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_slug text:=public.storefront_normalize_slug(_slug);
  v_store uuid;
  v_type text:=lower(coalesce(_fulfillment_type,''));
  v_methods jsonb;
begin
  if v_slug is null then return null; end if;
  select st.id into v_store from public.stores st where st.slug=v_slug and st.status='ativa' limit 1;
  if v_store is null then return null; end if;

  select coalesce(jsonb_agg(m order by (m->>'sortOrder')::int,m->>'displayName'),'[]'::jsonb) into v_methods
  from (
    select jsonb_build_object(
      'id',pm.id,'kind',pm.kind,'displayName',pm.label,
      'publicInstructions',case
        when pm.kind='pix'::public.payment_method_kind then 'Pix direto para a loja. A chave aparece após enviar o pedido. A confirmação do recebimento é feita manualmente pela loja.'
        when pm.kind='stripe_online'::public.payment_method_kind then 'Pague online com os meios liberados pela Stripe para esta conta, como Pix e cartão. A confirmação é automática.'
        else pm.instructions end,
      'requiresChange',pm.needs_change,'availableForDelivery',pm.available_for_delivery,'availableForPickup',pm.available_for_pickup,
      'processingMode',case when pm.kind='stripe_online'::public.payment_method_kind then 'online' else 'manual' end,
      'provider',case when pm.kind='stripe_online'::public.payment_method_kind then 'stripe' else 'store' end,
      'confirmationMode',case when pm.kind='stripe_online'::public.payment_method_kind then 'automatic' else 'manual' end,
      'sortOrder',pm.sort_order
    ) as m
    from public.payment_methods pm
    left join public.store_settings ss on ss.store_id=pm.store_id
    left join private.stripe_connect_accounts sc on sc.store_id=pm.store_id
    where pm.store_id=v_store and pm.is_active
      and (v_type='' or (v_type='entrega' and pm.available_for_delivery) or (v_type='retirada' and pm.available_for_pickup))
      and (pm.kind<>'stripe_online'::public.payment_method_kind or (
        coalesce(ss.online_payments_enabled,false) and coalesce(sc.details_submitted,false) and coalesce(sc.charges_enabled,false)
        and coalesce(sc.payouts_enabled,false) and coalesce(sc.transfers_enabled,false)
      ))
  ) s;
  return jsonb_build_object('methods',v_methods);
end;
$function$;

create or replace function public.backend_get_order_stripe_payment_context(_order_id uuid, _tracking_token text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog','public','private','extensions'
as $function$
declare
  o public.orders%rowtype;
  a private.stripe_connect_accounts%rowtype;
  p private.financial_fee_policy%rowtype;
  s public.store_settings%rowtype;
  token_hash text;
  amount_cents bigint;
  fee_bps integer;
  fee_cents bigint;
begin
  if _tracking_token is null or length(_tracking_token)<16 then return null; end if;
  token_hash:=encode(sha256(convert_to(_tracking_token,'UTF8')),'hex');
  select * into o from public.orders where id=_order_id and tracking_token_hash=token_hash;
  if not found then return null; end if;
  if o.payment_method_kind is distinct from 'stripe_online' then return jsonb_build_object('ready',false,'reason','order_not_stripe_payment','store_id',o.store_id,'order_id',o.id); end if;
  select * into s from public.store_settings where store_id=o.store_id;
  if not found or not coalesce(s.online_payments_enabled,false) then return jsonb_build_object('ready',false,'reason','online_payments_disabled','store_id',o.store_id,'order_id',o.id); end if;
  if o.status is distinct from 'aguardando_confirmacao'::public.order_status then return jsonb_build_object('ready',false,'reason','order_not_payable','store_id',o.store_id,'order_id',o.id,'status',o.status::text); end if;
  if o.payment_status='paid' then return jsonb_build_object('ready',false,'reason','order_already_paid','store_id',o.store_id,'order_id',o.id,'payment_status',o.payment_status); end if;
  if o.payment_status not in ('pending','processing','failed') then return jsonb_build_object('ready',false,'reason','payment_not_retryable','store_id',o.store_id,'order_id',o.id,'payment_status',o.payment_status); end if;
  select * into a from private.stripe_connect_accounts where store_id=o.store_id;
  if not found or not coalesce(a.details_submitted,false) or not coalesce(a.charges_enabled,false) or not coalesce(a.payouts_enabled,false) or not coalesce(a.transfers_enabled,false) then
    return jsonb_build_object('ready',false,'reason','stripe_connect_payouts_not_ready','store_id',o.store_id,'order_id',o.id);
  end if;
  select * into p from private.financial_fee_policy where policy_key='default';
  if not found then raise exception 'FINANCIAL_FEE_POLICY_MISSING'; end if;
  amount_cents:=round(o.total_amount*100)::bigint;
  if amount_cents<=0 or amount_cents>2147483647 then raise exception 'ORDER_AMOUNT_INVALID'; end if;
  fee_bps:=coalesce(a.application_fee_bps_override,p.order_application_fee_bps);
  fee_cents:=(amount_cents*fee_bps)/10000;
  return jsonb_build_object('ready',true,'charge_pattern','separate','order_id',o.id,'store_id',o.store_id,'order_number',o.order_number,
    'amount_cents',amount_cents::integer,'currency','brl','stripe_account_id',a.stripe_account_id,
    'platform_fee_bps',fee_bps,'platform_fee_cents',greatest(fee_cents,0)::integer,'application_fee_bps',fee_bps,
    'application_fee_amount',greatest(fee_cents,0)::integer,'fee_policy_key',p.policy_key);
end;
$function$;

create or replace function public.get_my_store_stripe_connect_status(_store_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog','public','private'
as $function$
declare
  v private.stripe_connect_accounts%rowtype;
  enabled boolean:=false;
begin
  perform private.require_permission('store.manage_settings'::public.app_permission,_store_id);
  select online_payments_enabled into enabled from public.store_settings where store_id=_store_id;
  select * into v from private.stripe_connect_accounts where store_id=_store_id;
  if not found then return jsonb_build_object('connected',false,'charges_enabled',false,'payouts_enabled',false,'transfers_enabled',false,'online_payments_enabled',coalesce(enabled,false)); end if;
  return jsonb_build_object(
    'connected',true,'stripe_account_id',v.stripe_account_id,'details_submitted',v.details_submitted,
    'charges_enabled',v.charges_enabled,'payouts_enabled',v.payouts_enabled,'transfers_enabled',v.transfers_enabled,
    'country',v.country,'business_type',v.business_type,'requirements_currently_due',v.requirements_currently_due,
    'application_fee_bps',coalesce(v.application_fee_bps_override,v.application_fee_bps),
    'online_payments_enabled',coalesce(enabled,false),'updated_at',v.updated_at
  );
end;
$function$;

revoke all on function public.set_my_store_online_payments(uuid,boolean,boolean) from public,anon;
revoke all on function public.set_my_store_manual_pix(uuid,boolean,text,text) from public,anon;
grant execute on function public.set_my_store_online_payments(uuid,boolean,boolean) to authenticated,service_role;
grant execute on function public.set_my_store_manual_pix(uuid,boolean,text,text) to authenticated,service_role;
