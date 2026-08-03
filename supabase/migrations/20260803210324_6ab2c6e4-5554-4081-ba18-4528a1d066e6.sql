ALTER TABLE public.store_settings
  ALTER COLUMN brand_primary SET DEFAULT '#0f1114',
  ALTER COLUMN brand_accent SET DEFAULT '#14b8a6';

UPDATE public.store_settings
   SET brand_primary = lower(brand_primary),
       brand_accent = lower(brand_accent)
 WHERE brand_primary <> lower(brand_primary) OR brand_accent <> lower(brand_accent);