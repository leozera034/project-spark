do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='comandiva-smart-delivery-worker' limit 1;
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;

  perform cron.schedule(
    'comandiva-smart-delivery-worker',
    '* * * * *',
    $cron$
      with readiness as (
        select coalesce(
          r.api_key_configured
          and r.billing_confirmed
          and (r.routes_api_enabled or r.geocoding_api_enabled)
          and not r.kill_switch_enabled,
          false
        ) as ready
        from private.maps_provider_runtime_readiness r
        where r.provider='openrouteservice' and r.environment='production'
      ), prepared as (
        select case when coalesce((select ready from readiness),false)
          then private.prepare_smart_delivery_jobs(100)
          else 0
        end as count
      )
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name='comandiva_project_url' limit 1) || '/functions/v1/comandiva-smart-delivery-worker',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-comandiva-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='comandiva_smart_delivery_worker_secret' limit 1)
        ),
        body := jsonb_build_object('source','cron','prepared',(select count from prepared)),
        timeout_milliseconds := 20000
      ) as request_id
      where coalesce((select ready from readiness),false)
        and (
          (select count from prepared) > 0
          or exists (
            select 1 from private.smart_delivery_jobs j
            where j.attempts < j.max_attempts
              and (
                (j.status in ('queued','retry') and j.available_at <= now())
                or (j.status='processing' and j.locked_until is not null and j.locked_until < now())
              )
          )
        );
    $cron$
  );
end $$;
