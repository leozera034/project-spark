do $$
begin
  if not exists(select 1 from vault.decrypted_secrets where name='comandiva_whatsapp_worker_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32),'hex'),
      'comandiva_whatsapp_worker_secret',
      'Internal Comandiva WhatsApp automation worker credential.'
    );
  end if;
end $$;

create or replace function public.backend_verify_whatsapp_worker_secret(_candidate text)
returns boolean
language sql
stable
security definer
set search_path='pg_catalog','vault'
as $$
  select coalesce(
    nullif(btrim(_candidate),'') is not null
    and exists(
      select 1
      from vault.decrypted_secrets s
      where s.name='comandiva_whatsapp_worker_secret'
        and s.decrypted_secret=_candidate
    ),false
  );
$$;

create or replace function public.backend_whatsapp_worker_secret_ready()
returns boolean
language sql
stable
security definer
set search_path='pg_catalog','vault'
as $$
  select exists(
    select 1 from vault.decrypted_secrets s
    where s.name='comandiva_whatsapp_worker_secret'
      and nullif(btrim(s.decrypted_secret),'') is not null
  );
$$;

revoke all on function public.backend_verify_whatsapp_worker_secret(text) from public,anon,authenticated;
revoke all on function public.backend_whatsapp_worker_secret_ready() from public,anon,authenticated;
grant execute on function public.backend_verify_whatsapp_worker_secret(text) to service_role;
grant execute on function public.backend_whatsapp_worker_secret_ready() to service_role;

do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='comandiva-whatsapp-worker' limit 1;
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;

  perform cron.schedule(
    'comandiva-whatsapp-worker',
    '* * * * *',
    $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name='comandiva_project_url' limit 1) || '/functions/v1/comandiva-whatsapp-worker',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-comandiva-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='comandiva_whatsapp_worker_secret' limit 1)
        ),
        body := jsonb_build_object('source','cron','limit',10),
        timeout_milliseconds := 20000
      ) as request_id;
    $cron$
  );
end $$;
