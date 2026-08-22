create table if not exists private.payment_exception_tasks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'stripe',
  provider_payment_id text not null,
  provider_charge_id text,
  kind text not null check (kind in ('late_terminal_payment')),
  status text not null default 'open' check (status in ('open','in_review','resolved')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'brl',
  detected_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(provider, kind, provider_payment_id)
);

create index if not exists payment_exception_tasks_status_detected_idx on private.payment_exception_tasks(status, detected_at desc);
create index if not exists payment_exception_tasks_store_idx on private.payment_exception_tasks(store_id, detected_at desc);
create index if not exists payment_exception_tasks_order_idx on private.payment_exception_tasks(order_id);
revoke all on private.payment_exception_tasks from public, anon, authenticated;

create or replace function private.sync_late_payment_exception_task()
returns trigger language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare is_late boolean := false;
begin
  begin is_late := coalesce((new.metadata->>'late_terminal_payment')::boolean, false); exception when others then is_late := false; end;
  if new.status='succeeded' and is_late then
    insert into private.payment_exception_tasks(store_id,order_id,provider,provider_payment_id,provider_charge_id,kind,status,amount_cents,currency,detected_at,metadata,updated_at)
    values(new.store_id,new.order_id,'stripe',new.stripe_payment_intent_id,new.stripe_charge_id,'late_terminal_payment','open',new.amount_cents,new.currency,coalesce(new.paid_at,now()),jsonb_build_object('charge_pattern',new.charge_pattern,'last_event_id',new.last_event_id,'order_status_at_payment',new.metadata->>'order_status_at_payment'),now())
    on conflict(provider,kind,provider_payment_id) do update set provider_charge_id=coalesce(excluded.provider_charge_id,private.payment_exception_tasks.provider_charge_id),amount_cents=excluded.amount_cents,currency=excluded.currency,metadata=private.payment_exception_tasks.metadata||excluded.metadata,updated_at=now();
  end if;
  if new.refunded_amount_cents >= new.amount_cents and new.amount_cents > 0 then
    update private.payment_exception_tasks set status='resolved',resolved_at=coalesce(resolved_at,now()),resolution_note=coalesce(resolution_note,'Reembolso integral confirmado automaticamente pelo webhook da Stripe.'),metadata=metadata||jsonb_build_object('refunded_amount_cents',new.refunded_amount_cents),updated_at=now()
    where provider='stripe' and kind='late_terminal_payment' and provider_payment_id=new.stripe_payment_intent_id and status<>'resolved';
  end if;
  return new;
end$$;

drop trigger if exists trg_sync_late_payment_exception_task on private.stripe_order_payment_intents;
create trigger trg_sync_late_payment_exception_task after insert or update of status,metadata,refunded_amount_cents,stripe_charge_id on private.stripe_order_payment_intents for each row execute function private.sync_late_payment_exception_task();

create or replace function public.admin_list_payment_exception_tasks(_status text default null,_limit integer default 100,_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','public','private' as $$
declare u uuid:=auth.uid(); items jsonb; total integer;
begin
  if not private.is_platform_admin_user(u) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if _status is not null and _status not in ('open','in_review','resolved') then raise exception 'INVALID_STATUS' using errcode='22023'; end if;
  select count(*) into total from private.payment_exception_tasks t where _status is null or t.status=_status;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'storeId',x.store_id,'storeName',x.store_name,'orderId',x.order_id,'orderNumber',x.order_number,'providerPaymentId',x.provider_payment_id,'providerChargeId',x.provider_charge_id,'kind',x.kind,'status',x.status,'amountCents',x.amount_cents,'currency',x.currency,'detectedAt',x.detected_at,'reviewedAt',x.reviewed_at,'resolvedAt',x.resolved_at,'resolutionNote',x.resolution_note,'metadata',x.metadata) order by x.detected_at desc),'[]'::jsonb) into items
  from (select t.*,s.name store_name,o.order_number from private.payment_exception_tasks t join public.stores s on s.id=t.store_id join public.orders o on o.id=t.order_id and o.store_id=t.store_id where _status is null or t.status=_status order by t.detected_at desc limit least(greatest(coalesce(_limit,100),1),200) offset greatest(coalesce(_offset,0),0)) x;
  return jsonb_build_object('total',total,'items',items);
end$$;

create or replace function public.admin_review_payment_exception_task(_task_id uuid,_note text default null)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare u uuid:=auth.uid(); t private.payment_exception_tasks%rowtype;
begin
  if not private.is_platform_admin_user(u) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select * into t from private.payment_exception_tasks where id=_task_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  if t.status='resolved' then return jsonb_build_object('ok',true,'id',t.id,'status',t.status,'resolvedAt',t.resolved_at); end if;
  update private.payment_exception_tasks set status='in_review',reviewed_at=coalesce(reviewed_at,now()),reviewed_by=u,resolution_note=case when nullif(btrim(coalesce(_note,'')),'') is null then resolution_note else left(btrim(_note),1000) end,updated_at=now() where id=_task_id returning * into t;
  insert into public.audit_logs(store_id,actor_user_id,actor_kind,action,entity,entity_id,context) values(t.store_id,u,'admin','payment_exception.review_started','payment_exception_tasks',t.id,jsonb_build_object('orderId',t.order_id,'providerPaymentId',t.provider_payment_id,'note',_note));
  return jsonb_build_object('ok',true,'id',t.id,'status',t.status,'reviewedAt',t.reviewed_at);
end$$;

revoke all on function public.admin_list_payment_exception_tasks(text,integer,integer) from public,anon;
revoke all on function public.admin_review_payment_exception_task(uuid,text) from public,anon;
grant execute on function public.admin_list_payment_exception_tasks(text,integer,integer) to authenticated,service_role;
grant execute on function public.admin_review_payment_exception_task(uuid,text) to authenticated,service_role;
