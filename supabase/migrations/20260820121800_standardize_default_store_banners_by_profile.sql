alter table public.category_profiles add column if not exists default_banner_url text;

update public.category_profiles set default_banner_url = case code
  when 'pizzaria' then 'https://raw.githubusercontent.com/leozera034/project-spark/main/74434214-DD0F-4E72-A03F-433A5A4E35B8.png'
  when 'hamburgueria' then 'https://raw.githubusercontent.com/leozera034/project-spark/main/54B3B572-B919-4C10-BB02-89EF17EF1F67.png'
  when 'acai' then 'https://raw.githubusercontent.com/leozera034/project-spark/main/0D5AB711-DCF9-436C-AAC7-63211108D603.png'
  when 'sorveteria' then 'https://raw.githubusercontent.com/leozera034/project-spark/main/AC5D7505-E062-461F-9501-B25E37347869.png'
  when 'restaurante' then 'https://raw.githubusercontent.com/leozera034/project-spark/main/2E23EFDB-A01A-4D45-AB41-4E6C56F8E7C3.png'
  when 'lanchonete' then 'https://raw.githubusercontent.com/leozera034/project-spark/main/BE76F350-A473-4585-9ED7-E39A512C6A4F.png'
  when 'pastelaria' then 'https://raw.githubusercontent.com/leozera034/project-spark/main/5A28457F-09F0-4079-A5D7-9FA44C798D8E.png'
  when 'adega' then 'https://raw.githubusercontent.com/leozera034/project-spark/main/D0AE951B-EB0D-4F14-8017-24D11683D8F8.png'
  when 'mercado' then 'https://raw.githubusercontent.com/leozera034/project-spark/main/0DA1D163-99E0-4750-A567-49F7D7C94436.png'
  else default_banner_url end
where code in ('pizzaria','hamburgueria','acai','sorveteria','restaurante','lanchonete','pastelaria','adega','mercado');

create or replace function private.apply_default_store_banner_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_url text;
begin
  if new.category_profile_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.category_profile_id is not distinct from old.category_profile_id then return new; end if;

  select cp.default_banner_url into v_url
  from public.category_profiles cp
  where cp.id = new.category_profile_id and cp.is_active;

  if nullif(v_url, '') is null then return new; end if;

  insert into public.store_settings(store_id, cover_url)
  values(new.id, v_url)
  on conflict (store_id) do update
    set cover_url = excluded.cover_url,
        updated_at = now()
  where public.store_settings.cover_path is null
    and (
      public.store_settings.cover_url is null
      or public.store_settings.cover_url like 'https://raw.githubusercontent.com/leozera034/project-spark/%'
    );

  return new;
end;
$$;

drop trigger if exists trg_apply_default_store_banner_for_profile on public.stores;
create trigger trg_apply_default_store_banner_for_profile
after insert or update of category_profile_id on public.stores
for each row execute function private.apply_default_store_banner_for_profile();

insert into public.store_settings(store_id, cover_url)
select s.id, cp.default_banner_url
from public.stores s
join public.category_profiles cp on cp.id = s.category_profile_id
left join public.store_settings ss on ss.store_id = s.id
where cp.default_banner_url is not null
  and (ss.store_id is null or (ss.cover_path is null and ss.cover_url is null))
on conflict (store_id) do update
  set cover_url = excluded.cover_url,
      updated_at = now()
where public.store_settings.cover_path is null and public.store_settings.cover_url is null;

create or replace function public.storefront_store(_slug text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_slug text := public.storefront_normalize_slug(_slug);
  s record;
  v_now timestamptz := now();
  v_local timestamp;
  v_dow smallint;
  v_time time;
  v_by_hours boolean;
  v_open boolean;
begin
  if v_slug is null then return null; end if;
  select st.id, st.slug, st.name, st.segment, st.city, st.state, st.timezone, st.phone, st.whatsapp, st.address_line, st.accepts_delivery, st.accepts_pickup
    into s
  from public.stores st
  where st.slug = v_slug and st.status = 'ativa'
  limit 1;
  if not found then return null; end if;

  v_local := v_now at time zone coalesce(s.timezone, 'America/Sao_Paulo');
  v_dow := extract(dow from v_local)::smallint;
  v_time := v_local::time;

  select exists (
    select 1 from public.store_hours h
    where h.store_id = s.id and h.is_active and h.weekday = v_dow
      and ((h.closes_at > h.opens_at and v_time >= h.opens_at and v_time < h.closes_at)
        or (h.closes_at <= h.opens_at and (v_time >= h.opens_at or v_time < h.closes_at)))
  ) into v_by_hours;

  select case
    when cfg.manual_override_open is not null then cfg.manual_override_open
    when cfg.auto_open_by_hours then v_by_hours
    else false
  end into v_open
  from public.store_settings cfg where cfg.store_id = s.id;
  v_open := coalesce(v_open, v_by_hours);

  return jsonb_build_object(
    'store', jsonb_build_object(
      'id', s.id,'slug', s.slug,'name', s.name,'segment', s.segment,'city', s.city,'state', s.state,'timezone', s.timezone,
      'phone', s.phone,'whatsapp', s.whatsapp,'address_line', s.address_line,'accepts_delivery', s.accepts_delivery,'accepts_pickup', s.accepts_pickup
    ),
    'settings', (
      select jsonb_build_object(
        'logo_path', cfg.logo_path,
        'cover_path', cfg.cover_path,
        'logo_url', cfg.logo_url,
        'cover_url', cfg.cover_url,
        'brand_primary', cfg.brand_primary,
        'brand_accent', cfg.brand_accent,
        'description', cfg.description,
        'welcome_message', cfg.welcome_message,
        'closed_message', cfg.closed_message,
        'min_order_amount', cfg.min_order_amount,
        'default_prep_minutes', cfg.default_prep_minutes,
        'theme_tokens', cfg.theme_tokens
      ) from public.store_settings cfg where cfg.store_id = s.id
    ),
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object('weekday', h.weekday,'opens_at', h.opens_at,'closes_at', h.closes_at) order by h.weekday, h.opens_at)
      from public.store_hours h where h.store_id = s.id and h.is_active
    ), '[]'::jsonb),
    'is_open', coalesce(v_open, false),
    'open_by_hours', coalesce(v_by_hours, false),
    'server_time', v_now
  );
end;
$$;
