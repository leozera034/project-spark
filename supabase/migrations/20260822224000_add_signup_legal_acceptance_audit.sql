create table if not exists private.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  store_id uuid null references public.stores(id) on delete set null,
  terms_version text not null,
  privacy_version text not null,
  source text not null,
  ip_hash text null,
  user_agent_hash text null,
  accepted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint legal_acceptances_terms_version_len check (length(terms_version) between 1 and 80),
  constraint legal_acceptances_privacy_version_len check (length(privacy_version) between 1 and 80),
  constraint legal_acceptances_source_len check (length(source) between 1 and 80),
  constraint legal_acceptances_ip_hash_len check (ip_hash is null or length(ip_hash) between 16 and 128),
  constraint legal_acceptances_user_agent_hash_len check (user_agent_hash is null or length(user_agent_hash) between 16 and 128),
  unique(actor_user_id, store_id, terms_version, privacy_version, source)
);

create index if not exists legal_acceptances_store_accepted_idx
  on private.legal_acceptances(store_id, accepted_at desc);
create index if not exists legal_acceptances_actor_accepted_idx
  on private.legal_acceptances(actor_user_id, accepted_at desc);

create or replace function public.backend_record_signup_legal_acceptance(
  _actor_user_id uuid,
  _store_id uuid,
  _terms_version text,
  _privacy_version text,
  _ip_hash text default null,
  _user_agent_hash text default null,
  _metadata jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security definer
set search_path to 'private','public','pg_temp'
as $$
begin
  if _actor_user_id is null or _store_id is null then
    raise exception 'INVALID_LEGAL_ACCEPTANCE' using errcode='22023';
  end if;
  if not exists (select 1 from public.stores s where s.id=_store_id) then
    raise exception 'STORE_NOT_FOUND' using errcode='P0001';
  end if;
  if not exists (
    select 1 from public.user_roles r
    where r.user_id=_actor_user_id and r.store_id=_store_id and r.is_active
      and r.role in ('proprietario','gerente')
  ) then
    raise exception 'ACTOR_STORE_MISMATCH' using errcode='42501';
  end if;

  insert into private.legal_acceptances(
    actor_user_id, store_id, terms_version, privacy_version, source,
    ip_hash, user_agent_hash, metadata
  ) values (
    _actor_user_id, _store_id, btrim(_terms_version), btrim(_privacy_version), 'store_signup',
    nullif(btrim(coalesce(_ip_hash,'')),''),
    nullif(btrim(coalesce(_user_agent_hash,'')),''),
    coalesce(_metadata,'{}'::jsonb)
  )
  on conflict(actor_user_id, store_id, terms_version, privacy_version, source)
  do update set
    ip_hash=excluded.ip_hash,
    user_agent_hash=excluded.user_agent_hash,
    metadata=private.legal_acceptances.metadata || excluded.metadata;

  return true;
end;
$$;

revoke execute on function public.backend_record_signup_legal_acceptance(uuid,uuid,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.backend_record_signup_legal_acceptance(uuid,uuid,text,text,text,text,jsonb) to service_role;
