-- ============================================================
-- FASE 08 — Parte 1: complementos de esquema
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_label(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT regexp_replace(
           lower(
             translate(
               btrim(coalesce(_value, '')),
               'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
               'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
             )
           ),
           '\s+', ' ', 'g'
         )
$$;

CREATE OR REPLACE FUNCTION public.normalize_store_slug(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT btrim(
           regexp_replace(
             regexp_replace(public.normalize_label(_value), '[^a-z0-9]+', '-', 'g'),
             '-{2,}', '-', 'g'
           ),
           '-'
         )
$$;

-- ---------------- neighborhoods ----------------
ALTER TABLE public.neighborhoods
  ALTER COLUMN min_order_amount DROP NOT NULL,
  ALTER COLUMN min_order_amount DROP DEFAULT;

ALTER TABLE public.neighborhoods
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS neighborhoods_name_normalized_unique
  ON public.neighborhoods (store_id, public.normalize_label(name));

-- ---------------- payment_methods ----------------
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS available_for_delivery boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_for_pickup   boolean NOT NULL DEFAULT true;

ALTER TABLE public.payment_methods
  DROP CONSTRAINT IF EXISTS payment_methods_availability_check;
ALTER TABLE public.payment_methods
  ADD CONSTRAINT payment_methods_availability_check
  CHECK (available_for_delivery OR available_for_pickup OR NOT is_active);

-- ---------------- store_settings ----------------
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS logo_path  text,
  ADD COLUMN IF NOT EXISTS cover_path text;

UPDATE public.store_settings
   SET brand_primary = lower(brand_primary),
       brand_accent  = lower(brand_accent);

ALTER TABLE public.store_settings
  DROP CONSTRAINT IF EXISTS store_settings_brand_hex_check;
ALTER TABLE public.store_settings
  ADD CONSTRAINT store_settings_brand_hex_check
  CHECK (brand_primary ~ '^#[0-9a-f]{6}$' AND brand_accent ~ '^#[0-9a-f]{6}$');
