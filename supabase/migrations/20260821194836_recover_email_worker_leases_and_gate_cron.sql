create or replace function private.claim_next_transactional_email(
  _provider text default 'resend'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_row private.outbound_emails%rowtype;
begin
  if not private.is_email_provider_ready(_provider, 'production') then
    return null;
  end if;

  update private.outbound_emails e
  set status = case when e.attempt_count < e.max_attempts then 'failed' else 'cancelled' end,
      available_at = case when e.attempt_count < e.max_attempts then now() else e.available_at end,
      locked_at = null,
      failed_at = case when e.attempt_count >= e.max_attempts then coalesce(e.failed_at, now()) else e.failed_at end,
      last_error_code = 'worker_lease_expired',
      last_error_detail = 'Recovered after transactional email worker lease expired.',
      updated_at = now()
  where e.provider = lower(btrim(_provider))
    and e.purpose = 'transactional'
    and e.status = 'sending'
    and e.locked_at is not null
    and e.locked_at < now() - interval '10 minutes';

  select * into v_row
  from private.outbound_emails e
  where e.provider = lower(btrim(_provider))
    and e.purpose = 'transactional'
    and e.status in ('queued','failed')
    and e.attempt_count < e.max_attempts
    and e.available_at <= now()
  order by e.available_at, e.created_at
  for update skip locked
  limit 1;

  if not found then return null; end if;

  update private.outbound_emails
  set status = 'sending',
      attempt_count = attempt_count + 1,
      locked_at = now(),
      updated_at = now(),
      last_error_code = null,
      last_error_detail = null
  where id = v_row.id
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'store_id', v_row.store_id,
    'provider', v_row.provider,
    'template_code', v_row.template_code,
    'recipient_email', v_row.recipient_email,
    'recipient_name', v_row.recipient_name,
    'subject', v_row.subject,
    'variables', v_row.variables,
    'idempotency_key', v_row.idempotency_key,
    'attempt_count', v_row.attempt_count,
    'max_attempts', v_row.max_attempts,
    'metadata', v_row.metadata
  );
end;
$$;

do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='comandiva-email-worker' limit 1;
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;

  perform cron.schedule(
    'comandiva-email-worker',
    '* * * * *',
    $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name='comandiva_project_url' limit 1) || '/functions/v1/comandiva-email-worker',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-comandiva-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='comandiva_email_worker_secret' limit 1)
        ),
        body := jsonb_build_object('source','cron'),
        timeout_milliseconds := 20000
      ) as request_id
      where private.is_email_provider_ready('resend','production')
        and exists (
          select 1 from private.outbound_emails e
          where e.provider='resend'
            and e.purpose='transactional'
            and (
              (e.status in ('queued','failed') and e.attempt_count < e.max_attempts and e.available_at <= now())
              or (e.status='sending' and e.locked_at is not null and e.locked_at < now() - interval '10 minutes')
            )
        );
    $cron$
  );
end $$;
