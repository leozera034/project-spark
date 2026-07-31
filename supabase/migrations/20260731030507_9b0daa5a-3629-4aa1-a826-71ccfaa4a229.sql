DROP POLICY IF EXISTS "store_branding_select" ON storage.objects;
DROP POLICY IF EXISTS "store_branding_insert" ON storage.objects;
DROP POLICY IF EXISTS "store_branding_update" ON storage.objects;
DROP POLICY IF EXISTS "store_branding_delete" ON storage.objects;

CREATE POLICY "store_branding_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'store-branding'
  AND private.has_permission('store.manage_settings', nullif((storage.foldername(name))[1], '')::uuid)
);

CREATE POLICY "store_branding_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'store-branding'
  AND (storage.foldername(name))[2] IN ('logo','cover')
  AND private.has_permission('store.manage_settings', nullif((storage.foldername(name))[1], '')::uuid)
);

CREATE POLICY "store_branding_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'store-branding'
  AND private.has_permission('store.manage_settings', nullif((storage.foldername(name))[1], '')::uuid)
)
WITH CHECK (
  bucket_id = 'store-branding'
  AND private.has_permission('store.manage_settings', nullif((storage.foldername(name))[1], '')::uuid)
);

CREATE POLICY "store_branding_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'store-branding'
  AND private.has_permission('store.manage_settings', nullif((storage.foldername(name))[1], '')::uuid)
);
