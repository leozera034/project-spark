-- Restore the application Storage and Realtime contract from the live Project Spark backend.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('store-branding', 'store-branding', false, null, null),
  ('store-catalog', 'store-catalog', false, null, null)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies are intentionally tenant-aware and authenticated-only.
drop policy if exists catalog_assets_delete on storage.objects;
create policy catalog_assets_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'store-catalog'
  and private.has_permission('catalog.update'::app_permission, private.catalog_object_store_id(name))
);

drop policy if exists catalog_assets_insert on storage.objects;
create policy catalog_assets_insert
on storage.objects
for insert
to authenticated
with check (
  (
    bucket_id = 'store-catalog'
    and private.has_permission('catalog.update'::app_permission, private.catalog_object_store_id(name))
    and split_part(name, '/', 2) = any (array['categories'::text, 'products'::text])
    and lower(right(name, 5)) = '.jpeg'
  )
  or
  (
    bucket_id = 'store-catalog'
    and private.has_permission('catalog.update'::app_permission, private.catalog_object_store_id(name))
    and split_part(name, '/', 2) = any (array['categories'::text, 'products'::text])
    and lower(right(name, 4)) = any (array['.png'::text, '.jpg'::text, '.webp'::text])
  )
);

drop policy if exists catalog_assets_read on storage.objects;
create policy catalog_assets_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'store-catalog'
  and private.has_permission('catalog.view'::app_permission, private.catalog_object_store_id(name))
  and split_part(name, '/', 2) = any (array['categories'::text, 'products'::text])
);

drop policy if exists catalog_assets_update on storage.objects;
create policy catalog_assets_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'store-catalog'
  and private.has_permission('catalog.update'::app_permission, private.catalog_object_store_id(name))
)
with check (
  bucket_id = 'store-catalog'
  and private.has_permission('catalog.update'::app_permission, private.catalog_object_store_id(name))
);

drop policy if exists store_branding_delete on storage.objects;
create policy store_branding_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'store-branding'
  and private.has_permission(
    'store.manage_settings'::app_permission,
    nullif((storage.foldername(name))[1], '')::uuid
  )
);

drop policy if exists store_branding_insert on storage.objects;
create policy store_branding_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'store-branding'
  and (storage.foldername(name))[2] = any (array['logo'::text, 'cover'::text])
  and private.has_permission(
    'store.manage_settings'::app_permission,
    nullif((storage.foldername(name))[1], '')::uuid
  )
);

drop policy if exists store_branding_select on storage.objects;
create policy store_branding_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'store-branding'
  and private.has_permission(
    'store.manage_settings'::app_permission,
    nullif((storage.foldername(name))[1], '')::uuid
  )
);

drop policy if exists store_branding_update on storage.objects;
create policy store_branding_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'store-branding'
  and private.has_permission(
    'store.manage_settings'::app_permission,
    nullif((storage.foldername(name))[1], '')::uuid
  )
)
with check (
  bucket_id = 'store-branding'
  and private.has_permission(
    'store.manage_settings'::app_permission,
    nullif((storage.foldername(name))[1], '')::uuid
  )
);

-- Realtime is limited to the event bridge table used by the store order UI.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'store_order_realtime_events'
  ) then
    alter publication supabase_realtime add table public.store_order_realtime_events;
  end if;
end
$$;
