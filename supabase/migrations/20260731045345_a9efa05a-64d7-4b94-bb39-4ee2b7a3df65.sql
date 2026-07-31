-- Fase 12 — Configuração pública de atendimento (modalidades + bairros)
-- Projeção explícita, SECURITY DEFINER, executável apenas pelo servidor.

CREATE OR REPLACE FUNCTION public.storefront_fulfillment(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_slug text := public.storefront_normalize_slug(_slug);
  s record;
  v_store jsonb;
  v_areas jsonb;
  v_version text;
BEGIN
  IF v_slug IS NULL THEN
    RETURN NULL;
  END IF;

  v_store := public.storefront_store(v_slug);
  IF v_store IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT st.id, st.name, st.accepts_delivery, st.accepts_pickup
    INTO s
    FROM public.stores st
   WHERE st.slug = v_slug AND st.status = 'ativa'
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id,
           'name', n.name,
           'deliveryFee', n.delivery_fee,
           'minimumOrderAmount', n.min_order_amount,
           'estimatedMinutes', n.eta_minutes,
           'publicNotes', n.notes
         ) ORDER BY n.sort_order, n.name), '[]'::jsonb)
    INTO v_areas
    FROM public.neighborhoods n
   WHERE n.store_id = s.id
     AND n.is_active
     AND NOT n.is_archived;

  SELECT md5(
           coalesce(max(x.stamp)::text, '') || ':' ||
           coalesce(count(*)::text, '0') || ':' ||
           s.accepts_delivery::text || ':' || s.accepts_pickup::text
         )
    INTO v_version
    FROM (
      SELECT n.updated_at AS stamp FROM public.neighborhoods n
       WHERE n.store_id = s.id AND n.is_active AND NOT n.is_archived
      UNION ALL
      SELECT st.updated_at FROM public.stores st WHERE st.id = s.id
      UNION ALL
      SELECT cfg.updated_at FROM public.store_settings cfg WHERE cfg.store_id = s.id
    ) x;

  RETURN jsonb_build_object(
    'configurationVersion', v_version,
    'deliveryEnabled', coalesce(s.accepts_delivery, false),
    'pickupEnabled', coalesce(s.accepts_pickup, false),
    'storeIsOpen', coalesce((v_store->>'is_open')::boolean, false),
    'storeName', s.name,
    'defaultPreparationMinutes', coalesce((v_store#>>'{settings,default_prep_minutes}')::int, 30),
    'deliveryAreas', CASE WHEN coalesce(s.accepts_delivery, false) THEN v_areas ELSE '[]'::jsonb END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.storefront_validate_fulfillment(
  _slug text,
  _fulfillment_type text,
  _delivery_area_id uuid DEFAULT NULL,
  _configuration_version text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cfg jsonb := public.storefront_fulfillment(_slug);
  v_errors text[] := ARRAY[]::text[];
  v_area jsonb := NULL;
  v_type text := lower(coalesce(_fulfillment_type, ''));
BEGIN
  IF v_cfg IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_type NOT IN ('entrega', 'retirada') THEN
    v_errors := v_errors || 'FULFILLMENT_INVALID';
  ELSIF v_type = 'entrega' AND NOT (v_cfg->>'deliveryEnabled')::boolean THEN
    v_errors := v_errors || 'FULFILLMENT_UNAVAILABLE';
  ELSIF v_type = 'retirada' AND NOT (v_cfg->>'pickupEnabled')::boolean THEN
    v_errors := v_errors || 'FULFILLMENT_UNAVAILABLE';
  END IF;

  IF v_type = 'entrega' THEN
    IF _delivery_area_id IS NULL THEN
      v_errors := v_errors || 'AREA_REQUIRED';
    ELSE
      SELECT a INTO v_area
        FROM jsonb_array_elements(v_cfg->'deliveryAreas') a
       WHERE (a->>'id')::uuid = _delivery_area_id
       LIMIT 1;
      IF v_area IS NULL THEN
        v_errors := v_errors || 'AREA_UNAVAILABLE';
      END IF;
    END IF;
  END IF;

  IF _configuration_version IS NOT NULL
     AND _configuration_version <> (v_cfg->>'configurationVersion') THEN
    v_errors := v_errors || 'CONFIGURATION_CHANGED';
  END IF;

  RETURN jsonb_build_object(
    'isValid', cardinality(v_errors) = 0,
    'configurationVersion', v_cfg->>'configurationVersion',
    'fulfillmentType', CASE WHEN v_type IN ('entrega','retirada') THEN v_type ELSE NULL END,
    'storeIsOpen', (v_cfg->>'storeIsOpen')::boolean,
    'deliveryEnabled', (v_cfg->>'deliveryEnabled')::boolean,
    'pickupEnabled', (v_cfg->>'pickupEnabled')::boolean,
    'deliveryArea', v_area,
    'deliveryFee', CASE WHEN v_area IS NULL THEN NULL ELSE (v_area->>'deliveryFee')::numeric END,
    'minimumOrderAmount', CASE WHEN v_area IS NULL THEN NULL ELSE (v_area->>'minimumOrderAmount')::numeric END,
    'estimatedMinutes', CASE
      WHEN v_area IS NOT NULL THEN (v_area->>'estimatedMinutes')::int
      ELSE (v_cfg->>'defaultPreparationMinutes')::int END,
    'validationErrors', to_jsonb(v_errors)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.storefront_fulfillment(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.storefront_validate_fulfillment(text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storefront_fulfillment(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.storefront_validate_fulfillment(text, text, uuid, text) TO service_role;