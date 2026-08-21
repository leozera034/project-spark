-- Keep one-minute WhatsApp responsiveness without paying the cost of an Edge
-- Function invocation when there is no queued work. Stale processing jobs still
-- wake the worker so its lease-recovery logic continues to run.

do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='comandiva-whatsapp-worker' limit 1;
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

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
      ) as request_id
      where exists (
        select 1
        from private.automation_jobs j
        where j.action_code='send_whatsapp_template'
          and (
            (
              j.status='queued'
              and j.available_at <= now()
              and j.attempt_count < j.max_attempts
            )
            or (
              j.status='processing'
              and j.locked_at < now() - interval '10 minutes'
            )
          )
      );
    $cron$
  );
end $$;
