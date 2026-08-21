create or replace function public.backend_claim_due_payout_request()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  r private.store_payout_requests%rowtype;
  a private.stripe_connect_accounts%rowtype;
begin
  update private.store_payout_requests p
  set status='failed',
      claimed_at=null,
      last_error='worker_lease_expired',
      updated_at=now()
  where p.status='processing'
    and p.claimed_at is not null
    and p.claimed_at < now() - interval '10 minutes';

  select * into r
  from private.store_payout_requests
  where status in ('requested','failed')
    and target_release_at<=now()
  order by target_release_at,created_at
  for update skip locked
  limit 1;

  if not found then return null; end if;

  select * into a from private.stripe_connect_accounts where store_id=r.store_id;
  if not found or not a.payouts_enabled then
    update private.store_payout_requests
    set status='failed',last_error='stripe_connect_payouts_not_ready',updated_at=now()
    where id=r.id;
    return jsonb_build_object('id',r.id,'skip',true,'reason','stripe_connect_payouts_not_ready');
  end if;

  update private.store_payout_requests
  set status='processing',claimed_at=now(),last_error=null,updated_at=now()
  where id=r.id
  returning * into r;

  return to_jsonb(r)||jsonb_build_object(
    'stripe_account_id',a.stripe_account_id,
    'items',(
      select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at,i.id),'[]'::jsonb)
      from private.store_payout_transfer_items i
      where i.payout_request_id=r.id and i.status in ('pending','failed')
    )
  );
end;
$$;

do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='comandiva-stripe-payout-worker' limit 1;
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;

  perform cron.schedule(
    'comandiva-stripe-payout-worker',
    '*/5 * * * *',
    $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name='comandiva_project_url' limit 1) || '/functions/v1/comandiva-stripe-payout-worker',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-comandiva-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='comandiva_stripe_payout_worker_secret' limit 1)
        ),
        body := jsonb_build_object('source','cron'),
        timeout_milliseconds := 20000
      ) as request_id
      where exists (
        select 1 from private.store_payout_requests p
        where (p.status in ('requested','failed') and p.target_release_at <= now())
           or (p.status='processing' and p.claimed_at is not null and p.claimed_at < now() - interval '10 minutes')
      );
    $cron$
  );
end $$;
