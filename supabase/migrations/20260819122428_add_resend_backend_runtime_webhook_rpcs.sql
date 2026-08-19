create or replace function public.backend_record_email_provider_runtime_health(
  _provider text,
  _environment text,
  _api_key_configured boolean,
  _sending_domain text,
  _domain_verified boolean,
  _webhook_secret_configured boolean,
  _webhook_secret_fingerprint text,
  _last_error text default null
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, private
as $$
  select private.record_email_provider_runtime_health(
    _provider,
    _environment,
    _api_key_configured,
    _sending_domain,
    _domain_verified,
    _webhook_secret_configured,
    _webhook_secret_fingerprint,
    _last_error
  );
$$;

create or replace function public.backend_process_resend_webhook_event(
  _provider_event_id text,
  _event_type text,
  _provider_email_id text,
  _recipient_email text,
  _occurred_at timestamptz,
  _reason text,
  _domain_name text,
  _domain_status text,
  _payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_event_id text := nullif(btrim(_provider_event_id), '');
  v_type text := lower(btrim(_event_type));
  v_provider_email_id text := nullif(btrim(_provider_email_id), '');
  v_domain_name text := nullif(lower(btrim(_domain_name)), '');
  v_domain_status text := nullif(lower(btrim(_domain_status)), '');
  v_existing private.email_webhook_events%rowtype;
  v_outbound private.outbound_emails%rowtype;
  v_readiness private.email_provider_runtime_readiness%rowtype;
  v_relevant boolean := false;
  v_status text := 'ignored';
  v_email_status text;
begin
  if v_event_id is null or char_length(v_event_id) > 200 then
    raise exception 'INVALID_PROVIDER_EVENT_ID' using errcode = '22023';
  end if;
  if v_type is null or char_length(v_type) > 160 then
    raise exception 'INVALID_EVENT_TYPE' using errcode = '22023';
  end if;

  select * into v_existing
  from private.email_webhook_events e
  where e.provider = 'resend' and e.provider_event_id = v_event_id;

  if found then
    return jsonb_build_object(
      'duplicate', true,
      'relevant', v_existing.processing_status = 'processed',
      'processing_status', v_existing.processing_status
    );
  end if;

  insert into private.email_webhook_events (
    provider,
    provider_event_id,
    event_type,
    provider_email_id,
    signature_valid,
    processing_status,
    payload,
    received_at
  ) values (
    'resend',
    v_event_id,
    v_type,
    v_provider_email_id,
    true,
    'received',
    coalesce(_payload, '{}'::jsonb),
    now()
  );

  if v_type = 'domain.updated' then
    select * into v_readiness
    from private.email_provider_runtime_readiness r
    where r.provider = 'resend'
      and r.environment = 'production'
      and r.sending_domain = v_domain_name
    for update;

    if found then
      v_relevant := true;
      update private.email_provider_runtime_readiness
      set domain_verified = (v_domain_status = 'verified'),
          last_health_at = now(),
          last_error = case
            when v_domain_status in ('failed','partially_failed') then 'domain_' || v_domain_status
            else null
          end,
          updated_at = now()
      where provider = 'resend' and environment = 'production';
    end if;
  elsif v_type like 'email.%' and v_provider_email_id is not null then
    select * into v_outbound
    from private.outbound_emails e
    where e.provider = 'resend'
      and e.provider_email_id = v_provider_email_id
    for update;

    if found then
      v_relevant := true;
      v_email_status := case v_type
        when 'email.sent' then 'sent'
        when 'email.delivered' then 'delivered'
        when 'email.bounced' then 'bounced'
        when 'email.complained' then 'complained'
        when 'email.failed' then 'failed'
        when 'email.suppressed' then 'suppressed'
        else null
      end;

      if v_email_status is not null then
        update private.outbound_emails
        set status = v_email_status,
            sent_at = case when v_type = 'email.sent' then coalesce(sent_at, coalesce(_occurred_at, now())) else sent_at end,
            delivered_at = case when v_type = 'email.delivered' then coalesce(delivered_at, coalesce(_occurred_at, now())) else delivered_at end,
            bounced_at = case when v_type = 'email.bounced' then coalesce(bounced_at, coalesce(_occurred_at, now())) else bounced_at end,
            complained_at = case when v_type = 'email.complained' then coalesce(complained_at, coalesce(_occurred_at, now())) else complained_at end,
            failed_at = case when v_type in ('email.failed','email.suppressed') then coalesce(failed_at, coalesce(_occurred_at, now())) else failed_at end,
            last_error_code = case when v_type in ('email.bounced','email.complained','email.failed','email.suppressed') then v_type else last_error_code end,
            last_error_detail = case when v_type in ('email.bounced','email.complained','email.failed','email.suppressed') then left(coalesce(_reason, ''), 500) else last_error_detail end,
            locked_at = null,
            updated_at = now()
        where id = v_outbound.id;
      end if;

      if v_type in ('email.bounced','email.complained','email.suppressed') then
        insert into private.email_suppressions (
          store_id,
          provider,
          email,
          reason,
          source,
          provider_event_id,
          active,
          updated_at
        ) values (
          v_outbound.store_id,
          'resend',
          v_outbound.recipient_email,
          case v_type
            when 'email.bounced' then 'bounce'
            when 'email.complained' then 'complaint'
            else 'suppressed'
          end,
          'provider_webhook',
          v_event_id,
          true,
          now()
        )
        on conflict (store_id, provider, email) do update
        set reason = excluded.reason,
            source = excluded.source,
            provider_event_id = excluded.provider_event_id,
            active = true,
            updated_at = now();
      end if;
    end if;
  end if;

  v_status := case when v_relevant then 'processed' else 'ignored' end;

  update private.email_webhook_events
  set processing_status = v_status,
      processed_at = now(),
      last_error = null
  where provider = 'resend' and provider_event_id = v_event_id;

  return jsonb_build_object(
    'duplicate', false,
    'relevant', v_relevant,
    'processing_status', v_status
  );
exception
  when others then
    update private.email_webhook_events
    set processing_status = 'failed',
        processed_at = now(),
        last_error = left(sqlerrm, 500)
    where provider = 'resend' and provider_event_id = v_event_id;
    raise;
end;
$$;

revoke all on function public.backend_record_email_provider_runtime_health(text,text,boolean,text,boolean,boolean,text,text) from public, anon, authenticated;
revoke all on function public.backend_process_resend_webhook_event(text,text,text,text,timestamptz,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.backend_record_email_provider_runtime_health(text,text,boolean,text,boolean,boolean,text,text) to service_role;
grant execute on function public.backend_process_resend_webhook_event(text,text,text,text,timestamptz,text,text,text,jsonb) to service_role;
