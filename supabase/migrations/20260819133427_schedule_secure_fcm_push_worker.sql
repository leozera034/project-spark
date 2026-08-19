create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name='comandiva_push_worker_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
      'comandiva_push_worker_secret',
      'Internal secret used only by Postgres Cron to authenticate the Comandiva FCM push worker.',
      null
    );
  end if;

  if not exists (select 1 from vault.decrypted_secrets where name='comandiva_project_url') then
    perform vault.create_secret(
      'https://ypgteuxzgqmkkkpvibhi.supabase.co',
      'comandiva_project_url',
      'Supabase project URL used by internal scheduled Edge Function invocations.',
      null
    );
  end if;
end $$;

create or replace function public.backend_verify_push_worker_secret(_candidate text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, vault
as $$
  select coalesce(
    nullif(btrim(_candidate),'') is not null
    and exists(
      select 1
      from vault.decrypted_secrets s
      where s.name='comandiva_push_worker_secret'
        and s.decrypted_secret=_candidate
    ),
    false
  );
$$;

revoke all on function public.backend_verify_push_worker_secret(text) from public,anon,authenticated;
grant execute on function public.backend_verify_push_worker_secret(text) to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname='comandiva-push-worker';

select cron.schedule(
  'comandiva-push-worker',
  '* * * * *',
  $cron$
    select case
      when private.is_push_provider_ready('fcm','production') then
        net.http_post(
          url := (
            select decrypted_secret
            from vault.decrypted_secrets
            where name='comandiva_project_url'
            limit 1
          ) || '/functions/v1/comandiva-push-worker',
          headers := jsonb_build_object(
            'Content-Type','application/json',
            'x-comandiva-worker-secret',(
              select decrypted_secret
              from vault.decrypted_secrets
              where name='comandiva_push_worker_secret'
              limit 1
            )
          ),
          body := jsonb_build_object('source','cron'),
          timeout_milliseconds := 10000
        )
      else null::bigint
    end as request_id;
  $cron$
);
