create table if not exists private.store_slug_redirects (
  old_slug text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists store_slug_redirects_store_id_idx on private.store_slug_redirects(store_id);

create or replace function private.capture_store_slug_redirect()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.slug is distinct from old.slug and old.slug is not null and btrim(old.slug) <> '' then
    delete from private.store_slug_redirects where old_slug = new.slug and store_id = new.id;
    insert into private.store_slug_redirects(old_slug, store_id)
    values (old.slug, new.id)
    on conflict (old_slug) do update
      set store_id = excluded.store_id,
          created_at = now()
      where private.store_slug_redirects.store_id = excluded.store_id;
  end if;
  return new;
end;
$$;

drop trigger if exists capture_store_slug_redirect on public.stores;
create trigger capture_store_slug_redirect
before update of slug on public.stores
for each row
when (old.slug is distinct from new.slug)
execute function private.capture_store_slug_redirect();

create or replace function public.storefront_normalize_slug(_slug text)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_normalized text;
  v_current text;
begin
  v_normalized := nullif(substring(lower(regexp_replace(coalesce(_slug, ''), '[^a-zA-Z0-9-]', '', 'g')) from 1 for 63), '');
  if v_normalized is null then return null; end if;

  select s.slug
    into v_current
  from private.store_slug_redirects r
  join public.stores s on s.id = r.store_id
  where r.old_slug = v_normalized
    and s.status = 'ativa'
  limit 1;

  return coalesce(v_current, v_normalized);
end;
$$;

create or replace function public.check_public_store_slug(_slug text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'private', 'pg_temp'
as $$
declare _n text:=public.normalize_store_slug(coalesce(_slug,''));
begin
  if length(_n)<3 or length(_n)>60 then return jsonb_build_object('slug',_n,'available',false,'reason','formato'); end if;
  if _n=any(private.reserved_slugs()) then return jsonb_build_object('slug',_n,'available',false,'reason','reservado'); end if;
  if exists(select 1 from public.stores s where s.slug=_n)
     or exists(select 1 from private.store_slug_redirects r where r.old_slug=_n) then
    return jsonb_build_object('slug',_n,'available',false,'reason','em_uso');
  end if;
  return jsonb_build_object('slug',_n,'available',true,'reason',null);
end;
$$;

create or replace function public.check_store_slug_availability(_store_id uuid, _slug text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'private', 'pg_temp'
as $$
declare _sid uuid:=private.resolve_store(_store_id); _n text:=public.normalize_store_slug(_slug);
begin
  perform private.require_permission('store.update_profile',_sid);
  if length(_n)<3 or length(_n)>60 then return jsonb_build_object('slug',_n,'available',false,'reason','formato'); end if;
  if _n=any(private.reserved_slugs()) then return jsonb_build_object('slug',_n,'available',false,'reason','reservado'); end if;
  if exists(select 1 from public.stores s where s.slug=_n and s.id<>_sid)
     or exists(select 1 from private.store_slug_redirects r where r.old_slug=_n and r.store_id<>_sid) then
    return jsonb_build_object('slug',_n,'available',false,'reason','em_uso');
  end if;
  return jsonb_build_object('slug',_n,'available',true,'reason',null);
end;
$$;
