ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS request_hash text,
  ADD COLUMN IF NOT EXISTS payment_method_kind text,
  ADD COLUMN IF NOT EXISTS payment_instructions text,
  ADD COLUMN IF NOT EXISTS payment_needs_change boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_phone_display text,
  ADD COLUMN IF NOT EXISTS minimum_order_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'publico';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_change_for_check') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_change_for_check
      CHECK (change_for IS NULL OR change_for >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_minimum_order_check') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_minimum_order_check
      CHECK (minimum_order_amount >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_source_check') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_source_check
      CHECK (source IN ('publico','loja','admin'));
  END IF;
END $$;

ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS address_fingerprint text,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_fingerprint_unique
  ON public.customer_addresses (store_id, customer_id, address_fingerprint)
  WHERE address_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_store_created_idx ON public.orders (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_items_store_order_idx ON public.order_items (store_id, order_id);
CREATE INDEX IF NOT EXISTS order_item_options_store_item_idx ON public.order_item_options (store_id, order_item_id);
CREATE INDEX IF NOT EXISTS order_status_history_store_order_idx ON public.order_status_history (store_id, order_id);
CREATE INDEX IF NOT EXISTS customers_store_phone_idx ON public.customers (store_id, phone);

CREATE OR REPLACE FUNCTION private.address_fingerprint(
  _neighborhood_id uuid,
  _street text,
  _number text,
  _has_no_number boolean,
  _complement text
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT encode(
    sha256(convert_to(
      coalesce(_neighborhood_id::text, '-') || '|' ||
      lower(btrim(regexp_replace(coalesce(_street, ''), '\s+', ' ', 'g'))) || '|' ||
      CASE WHEN coalesce(_has_no_number, false) THEN 'sn'
           ELSE lower(btrim(coalesce(_number, ''))) END || '|' ||
      lower(btrim(regexp_replace(coalesce(_complement, ''), '\s+', ' ', 'g'))),
      'UTF8'
    )),
    'hex'
  );
$$;

REVOKE ALL ON FUNCTION private.address_fingerprint(uuid, text, text, boolean, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.normalize_phone(_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  d text := regexp_replace(coalesce(_raw, ''), '[^0-9]', '', 'g');
BEGIN
  IF length(d) IN (12, 13) AND left(d, 2) = '55' THEN
    d := substr(d, 3);
  END IF;
  IF length(d) NOT IN (10, 11) THEN
    RETURN NULL;
  END IF;
  IF left(d, 1) = '0' OR substr(d, 2, 1) = '0' THEN
    RETURN NULL;
  END IF;
  IF d ~ '^(.)\1+$' THEN
    RETURN NULL;
  END IF;
  IF length(d) = 11 AND substr(d, 3, 1) <> '9' THEN
    RETURN NULL;
  END IF;
  RETURN d;
END;
$$;

REVOKE ALL ON FUNCTION private.normalize_phone(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.storefront_payment_methods(_slug text, _fulfillment_type text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_slug text := public.storefront_normalize_slug(_slug);
  v_store uuid;
  v_type text := lower(coalesce(_fulfillment_type, ''));
  v_methods jsonb;
BEGIN
  IF v_slug IS NULL THEN RETURN NULL; END IF;

  SELECT st.id INTO v_store
    FROM public.stores st
   WHERE st.slug = v_slug AND st.status = 'ativa'
   LIMIT 1;
  IF v_store IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(jsonb_agg(m ORDER BY (m->>'sortOrder')::int, m->>'displayName'), '[]'::jsonb)
    INTO v_methods
  FROM (
    SELECT jsonb_build_object(
             'id', pm.id,
             'kind', pm.kind,
             'displayName', pm.label,
             'publicInstructions', pm.instructions,
             'requiresChange', pm.needs_change,
             'availableForDelivery', pm.available_for_delivery,
             'availableForPickup', pm.available_for_pickup,
             'sortOrder', pm.sort_order
           ) AS m
      FROM public.payment_methods pm
     WHERE pm.store_id = v_store
       AND pm.is_active
       AND (
         v_type = '' OR
         (v_type = 'entrega' AND pm.available_for_delivery) OR
         (v_type = 'retirada' AND pm.available_for_pickup)
       )
  ) s;

  RETURN jsonb_build_object('methods', v_methods);
END;
$$;

REVOKE ALL ON FUNCTION public.storefront_payment_methods(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storefront_payment_methods(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storefront_payment_methods(text, text) TO service_role;