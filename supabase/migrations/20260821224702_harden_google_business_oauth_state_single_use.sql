create or replace function public.claim_google_business_onboarding_session(_session_id uuid, _state_hash text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _session private.google_business_onboarding_sessions%rowtype;
begin
  select * into _session
  from private.google_business_onboarding_sessions s
  where s.id=_session_id and s.state_hash=_state_hash
  for update;

  if not found then
    raise exception 'GOOGLE_BUSINESS_ONBOARDING_NOT_FOUND' using errcode='P0001';
  end if;
  if _session.expires_at <= now() then
    update private.google_business_onboarding_sessions
    set status='expired', updated_at=now()
    where id=_session.id and status='created';
    raise exception 'GOOGLE_BUSINESS_ONBOARDING_EXPIRED' using errcode='P0001';
  end if;
  if _session.status <> 'created' then
    raise exception 'GOOGLE_BUSINESS_ONBOARDING_INVALID' using errcode='P0001';
  end if;

  update private.google_business_onboarding_sessions
  set status='exchanging', updated_at=now()
  where id=_session.id and status='created';

  if not found then
    raise exception 'GOOGLE_BUSINESS_ONBOARDING_INVALID' using errcode='P0001';
  end if;

  return jsonb_build_object(
    'session_id', _session.id,
    'store_id', _session.store_id,
    'actor_user_id', _session.actor_user_id
  );
end;
$function$;

revoke all on function public.claim_google_business_onboarding_session(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_google_business_onboarding_session(uuid,text) to service_role;
