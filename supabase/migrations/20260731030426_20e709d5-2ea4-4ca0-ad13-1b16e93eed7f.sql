-- ============================================================
-- FASE 08 — Parte 2: RPCs de configuração da loja
-- ============================================================

------------------------------------------------------------------
-- Helpers privados
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.reserved_slugs()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT ARRAY[
    'admin','app','api','auth','entrar','login','logout','preview','design-system',
    'suporte','ajuda','assets','brand','public','loja','entregador','configuracoes',
    'sobre','contato','termos','privacidade','status','static','www','cdn','root'
  ]::text[]
$$;

CREATE OR REPLACE FUNCTION private.require_permission(_permission public.app_permission, _store_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT private.has_permission(_permission, _store_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- Resolve a loja alvo. Nunca confia apenas no valor recebido do cliente.
CREATE OR REPLACE FUNCTION private.resolve_store(_store_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  _uid uuid := auth.uid();
  _ids uuid[];
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;

  IF _store_id IS NOT NULL THEN
    RETURN _store_id;   -- a permissão é sempre revalidada depois
  END IF;

  SELECT array_agg(DISTINCT r.store_id) INTO _ids
    FROM public.user_roles r
   WHERE r.user_id = _uid AND r.is_active AND r.store_id IS NOT NULL
     AND r.role IN ('proprietario','gerente','atendente','cozinha');

  IF _ids IS NULL OR cardinality(_ids) = 0 THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;
  IF cardinality(_ids) > 1 THEN
    RAISE EXCEPTION 'STORE_SELECTION_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  RETURN _ids[1];
END;
$$;

CREATE OR REPLACE FUNCTION private.assert_version(_expected timestamptz, _actual timestamptz)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
BEGIN
  IF _expected IS NOT NULL AND _actual IS NOT NULL
     AND date_trunc('milliseconds', _expected) <> date_trunc('milliseconds', _actual) THEN
    RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- Auditoria: apenas nomes de campos, nunca conteúdo sensível.
CREATE OR REPLACE FUNCTION private.log_config_audit(
  _store_id uuid, _action text, _entity text, _entity_id uuid, _fields text[]
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _roles text;
BEGIN
  SELECT string_agg(DISTINCT r.role::text, ',') INTO _roles
    FROM public.user_roles r
   WHERE r.user_id = auth.uid() AND r.is_active AND r.store_id = _store_id;

  INSERT INTO public.audit_logs (store_id, actor_user_id, actor_kind, action, entity, entity_id, context)
  VALUES (
    _store_id, auth.uid(), 'usuario', _action, _entity, _entity_id,
    jsonb_build_object('roles', coalesce(_roles, ''), 'fields', to_jsonb(coalesce(_fields, ARRAY[]::text[])))
  );
END;
$$;

------------------------------------------------------------------
-- Leitura da configuração
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_my_stores()
RETURNS TABLE (id uuid, name text, slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT s.id, s.name, s.slug
    FROM public.stores s
   WHERE EXISTS (
     SELECT 1 FROM public.user_roles r
      WHERE r.user_id = auth.uid() AND r.is_active AND r.store_id = s.id
        AND r.role IN ('proprietario','gerente','atendente','cozinha')
   )
   ORDER BY s.name;
$$;

CREATE OR REPLACE FUNCTION public.get_my_store_configuration(_store_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _sensitive boolean;
  _result jsonb;
BEGIN
  PERFORM private.require_permission('store.view_basic', _sid);
  _sensitive := private.has_permission('store.update_profile', _sid);

  SELECT jsonb_build_object(
    'store', jsonb_build_object(
      'id', s.id, 'slug', s.slug, 'name', s.name, 'status', s.status,
      'legal_name', CASE WHEN _sensitive THEN s.legal_name END,
      'document',   CASE WHEN _sensitive THEN s.document END,
      'segment', s.segment, 'phone', s.phone, 'whatsapp', s.whatsapp, 'email', s.email,
      'city', s.city, 'state', s.state, 'timezone', s.timezone,
      'accepts_delivery', s.accepts_delivery, 'accepts_pickup', s.accepts_pickup,
      'updated_at', s.updated_at
    ),
    'settings', jsonb_build_object(
      'brand_primary', st.brand_primary, 'brand_accent', st.brand_accent,
      'logo_path', st.logo_path, 'cover_path', st.cover_path,
      'description', st.description, 'welcome_message', st.welcome_message,
      'closed_message', st.closed_message, 'min_order_amount', st.min_order_amount,
      'default_prep_minutes', st.default_prep_minutes,
      'sound_alert_enabled', st.sound_alert_enabled,
      'auto_open_by_hours', st.auto_open_by_hours,
      'updated_at', st.updated_at
    ),
    'hours', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'weekday', h.weekday,
               'opens_at', to_char(h.opens_at,'HH24:MI'),
               'closes_at', to_char(h.closes_at,'HH24:MI'))
               ORDER BY h.weekday, h.opens_at)
        FROM public.store_hours h WHERE h.store_id = _sid AND h.is_active
    ), '[]'::jsonb),
    'neighborhoods', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', n.id, 'name', n.name, 'delivery_fee', n.delivery_fee,
               'min_order_amount', n.min_order_amount, 'eta_minutes', n.eta_minutes,
               'notes', n.notes, 'is_active', n.is_active, 'is_archived', n.is_archived,
               'sort_order', n.sort_order, 'updated_at', n.updated_at)
               ORDER BY n.sort_order, n.name)
        FROM public.neighborhoods n WHERE n.store_id = _sid
    ), '[]'::jsonb),
    'payment_methods', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', p.id, 'kind', p.kind, 'label', p.label, 'instructions', p.instructions,
               'needs_change', p.needs_change, 'is_active', p.is_active,
               'available_for_delivery', p.available_for_delivery,
               'available_for_pickup', p.available_for_pickup,
               'sort_order', p.sort_order, 'updated_at', p.updated_at)
               ORDER BY p.sort_order, p.label)
        FROM public.payment_methods p WHERE p.store_id = _sid
    ), '[]'::jsonb),
    'can', jsonb_build_object(
      'update_profile',          private.has_permission('store.update_profile', _sid),
      'manage_settings',         private.has_permission('store.manage_settings', _sid),
      'manage_hours',            private.has_permission('store.manage_hours', _sid),
      'manage_neighborhoods',    private.has_permission('store.manage_neighborhoods', _sid),
      'manage_payment_methods',  private.has_permission('store.manage_payment_methods', _sid)
    )
  ) INTO _result
  FROM public.stores s
  LEFT JOIN public.store_settings st ON st.store_id = s.id
  WHERE s.id = _sid;

  IF _result IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  RETURN _result;
END;
$$;

------------------------------------------------------------------
-- Dados do estabelecimento
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_store_profile(
  _store_id uuid,
  _name text, _legal_name text, _document text,
  _phone text, _whatsapp text, _email text, _timezone text,
  _description text, _welcome_message text, _closed_message text,
  _expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _cur public.stores%ROWTYPE;
  _n text; _doc text; _ph text; _wa text; _em text;
BEGIN
  PERFORM private.require_permission('store.update_profile', _sid);

  SELECT * INTO _cur FROM public.stores WHERE id = _sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_version(_expected_updated_at, _cur.updated_at);

  _n := btrim(coalesce(_name, ''));
  IF length(_n) < 2 OR length(_n) > 100 OR public.normalize_label(_n) !~ '[a-z0-9]' THEN
    RAISE EXCEPTION 'INVALID_NAME' USING ERRCODE = 'P0001';
  END IF;

  _doc := nullif(regexp_replace(coalesce(_document,''), '[^0-9]', '', 'g'), '');
  IF _doc IS NOT NULL AND length(_doc) NOT IN (11, 14) THEN
    RAISE EXCEPTION 'INVALID_DOCUMENT' USING ERRCODE = 'P0001';
  END IF;

  _ph := nullif(regexp_replace(coalesce(_phone,''), '[^0-9]', '', 'g'), '');
  _wa := nullif(regexp_replace(coalesce(_whatsapp,''), '[^0-9]', '', 'g'), '');
  IF (_ph IS NOT NULL AND length(_ph) NOT BETWEEN 10 AND 13)
     OR (_wa IS NOT NULL AND length(_wa) NOT BETWEEN 10 AND 13) THEN
    RAISE EXCEPTION 'INVALID_PHONE' USING ERRCODE = 'P0001';
  END IF;

  _em := nullif(lower(btrim(coalesce(_email,''))), '');
  IF _em IS NOT NULL AND _em !~ '^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$' THEN
    RAISE EXCEPTION 'INVALID_EMAIL' USING ERRCODE = 'P0001';
  END IF;

  IF _timezone IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names t WHERE t.name = _timezone) THEN
    RAISE EXCEPTION 'INVALID_TIMEZONE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.stores
     SET name = _n,
         legal_name = nullif(btrim(coalesce(_legal_name,'')), ''),
         document = _doc, phone = _ph, whatsapp = _wa, email = _em,
         timezone = _timezone, updated_at = now()
   WHERE id = _sid;

  UPDATE public.store_settings
     SET description     = nullif(btrim(coalesce(_description,'')), ''),
         welcome_message = nullif(btrim(coalesce(_welcome_message,'')), ''),
         closed_message  = nullif(btrim(coalesce(_closed_message,'')), ''),
         updated_at = now()
   WHERE store_id = _sid;

  PERFORM private.log_config_audit(_sid, 'store.profile.updated', 'stores', _sid,
    ARRAY['name','legal_name','document','phone','whatsapp','email','timezone','description','welcome_message','closed_message']);

  RETURN public.get_my_store_configuration(_sid);
END;
$$;

------------------------------------------------------------------
-- Slug público
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_store_slug_availability(_store_id uuid, _slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _n text := public.normalize_store_slug(_slug);
BEGIN
  PERFORM private.require_permission('store.update_profile', _sid);

  IF length(_n) < 3 OR length(_n) > 60 THEN
    RETURN jsonb_build_object('slug', _n, 'available', false, 'reason', 'formato');
  END IF;
  IF _n = ANY (private.reserved_slugs()) THEN
    RETURN jsonb_build_object('slug', _n, 'available', false, 'reason', 'reservado');
  END IF;
  IF EXISTS (SELECT 1 FROM public.stores s WHERE s.slug = _n AND s.id <> _sid) THEN
    RETURN jsonb_build_object('slug', _n, 'available', false, 'reason', 'em_uso');
  END IF;
  RETURN jsonb_build_object('slug', _n, 'available', true, 'reason', NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_store_slug(
  _store_id uuid, _slug text, _expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _n text := public.normalize_store_slug(_slug);
  _cur timestamptz;
BEGIN
  PERFORM private.require_permission('store.update_profile', _sid);
  SELECT updated_at INTO _cur FROM public.stores WHERE id = _sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_version(_expected_updated_at, _cur);

  IF length(_n) < 3 OR length(_n) > 60 THEN RAISE EXCEPTION 'INVALID_SLUG' USING ERRCODE = 'P0001'; END IF;
  IF _n = ANY (private.reserved_slugs()) THEN RAISE EXCEPTION 'RESERVED_SLUG' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.stores s WHERE s.slug = _n AND s.id <> _sid) THEN
    RAISE EXCEPTION 'SLUG_TAKEN' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.stores SET slug = _n, updated_at = now() WHERE id = _sid;
  PERFORM private.log_config_audit(_sid, 'store.slug.updated', 'stores', _sid, ARRAY['slug']);
  RETURN public.get_my_store_configuration(_sid);
END;
$$;

------------------------------------------------------------------
-- Identidade visual (tokens controlados)
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_store_theme(
  _store_id uuid, _brand_primary text, _brand_accent text,
  _logo_path text DEFAULT NULL, _cover_path text DEFAULT NULL,
  _expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _p text := lower(btrim(coalesce(_brand_primary,'')));
  _a text := lower(btrim(coalesce(_brand_accent,'')));
  _cur timestamptz;
  _prefix text;
BEGIN
  PERFORM private.require_permission('store.manage_settings', _sid);
  SELECT updated_at INTO _cur FROM public.store_settings WHERE store_id = _sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_version(_expected_updated_at, _cur);

  IF _p !~ '^#[0-9a-f]{6}$' OR _a !~ '^#[0-9a-f]{6}$' THEN
    RAISE EXCEPTION 'INVALID_COLOR' USING ERRCODE = 'P0001';
  END IF;

  _prefix := _sid::text || '/';
  IF _logo_path IS NOT NULL AND left(_logo_path, length(_prefix)) <> _prefix THEN
    RAISE EXCEPTION 'INVALID_ASSET_PATH' USING ERRCODE = 'P0001';
  END IF;
  IF _cover_path IS NOT NULL AND left(_cover_path, length(_prefix)) <> _prefix THEN
    RAISE EXCEPTION 'INVALID_ASSET_PATH' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.store_settings
     SET brand_primary = _p, brand_accent = _a,
         logo_path  = coalesce(_logo_path, logo_path),
         cover_path = coalesce(_cover_path, cover_path),
         updated_at = now()
   WHERE store_id = _sid;

  PERFORM private.log_config_audit(_sid, 'store.theme.updated', 'store_settings', _sid,
    ARRAY['brand_primary','brand_accent','logo_path','cover_path']);
  RETURN public.get_my_store_configuration(_sid);
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_store_asset(_store_id uuid, _slot text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _sid uuid := private.resolve_store(_store_id);
BEGIN
  PERFORM private.require_permission('store.manage_settings', _sid);
  IF _slot NOT IN ('logo','cover') THEN RAISE EXCEPTION 'INVALID_SLOT' USING ERRCODE = 'P0001'; END IF;

  IF _slot = 'logo' THEN
    UPDATE public.store_settings SET logo_path = NULL, updated_at = now() WHERE store_id = _sid;
    PERFORM private.log_config_audit(_sid, 'store.logo.updated', 'store_settings', _sid, ARRAY['logo_path']);
  ELSE
    UPDATE public.store_settings SET cover_path = NULL, updated_at = now() WHERE store_id = _sid;
    PERFORM private.log_config_audit(_sid, 'store.cover.updated', 'store_settings', _sid, ARRAY['cover_path']);
  END IF;
  RETURN public.get_my_store_configuration(_sid);
END;
$$;

------------------------------------------------------------------
-- Atendimento
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_store_service_settings(
  _store_id uuid,
  _accepts_delivery boolean, _accepts_pickup boolean,
  _min_order_amount numeric, _default_prep_minutes integer,
  _sound_alert_enabled boolean, _auto_open_by_hours boolean,
  _expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _cur timestamptz;
BEGIN
  PERFORM private.require_permission('store.manage_settings', _sid);
  SELECT updated_at INTO _cur FROM public.store_settings WHERE store_id = _sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_version(_expected_updated_at, _cur);

  IF _min_order_amount IS NULL OR _min_order_amount < 0 OR _min_order_amount > 100000 THEN
    RAISE EXCEPTION 'INVALID_MIN_ORDER' USING ERRCODE = 'P0001';
  END IF;
  IF _default_prep_minutes IS NULL OR _default_prep_minutes < 0 OR _default_prep_minutes > 600 THEN
    RAISE EXCEPTION 'INVALID_PREP_MINUTES' USING ERRCODE = 'P0001';
  END IF;
  IF (coalesce(_accepts_delivery,false) OR coalesce(_accepts_pickup,false))
     AND _default_prep_minutes = 0 THEN
    RAISE EXCEPTION 'INVALID_PREP_MINUTES' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.stores
     SET accepts_delivery = coalesce(_accepts_delivery,false),
         accepts_pickup   = coalesce(_accepts_pickup,false),
         updated_at = now()
   WHERE id = _sid;

  UPDATE public.store_settings
     SET min_order_amount = round(_min_order_amount, 2),
         default_prep_minutes = _default_prep_minutes,
         sound_alert_enabled = coalesce(_sound_alert_enabled, true),
         auto_open_by_hours  = coalesce(_auto_open_by_hours, true),
         updated_at = now()
   WHERE store_id = _sid;

  PERFORM private.log_config_audit(_sid, 'store.service_settings.updated', 'store_settings', _sid,
    ARRAY['accepts_delivery','accepts_pickup','min_order_amount','default_prep_minutes','sound_alert_enabled','auto_open_by_hours']);
  RETURN public.get_my_store_configuration(_sid);
END;
$$;

------------------------------------------------------------------
-- Horários semanais (substituição transacional)
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.replace_store_hours(
  _store_id uuid, _hours jsonb, _expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _cur timestamptz;
  _wd int; _a int; _b int; _c int; _d int;
  _slots int[][];
  _row record;
BEGIN
  PERFORM private.require_permission('store.manage_hours', _sid);
  SELECT updated_at INTO _cur FROM public.store_settings WHERE store_id = _sid FOR UPDATE;
  PERFORM private.assert_version(_expected_updated_at, _cur);

  IF _hours IS NULL OR jsonb_typeof(_hours) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_HOURS' USING ERRCODE = 'P0001';
  END IF;

  CREATE TEMP TABLE _incoming (weekday int, opens time, closes time, s int, e int) ON COMMIT DROP;

  FOR _row IN SELECT * FROM jsonb_array_elements(_hours) AS x(v) LOOP
    IF (_row.v->>'weekday') IS NULL OR (_row.v->>'opens_at') IS NULL OR (_row.v->>'closes_at') IS NULL THEN
      RAISE EXCEPTION 'INVALID_HOURS' USING ERRCODE = 'P0001';
    END IF;
    _wd := (_row.v->>'weekday')::int;
    IF _wd < 0 OR _wd > 6 THEN RAISE EXCEPTION 'INVALID_HOURS' USING ERRCODE = 'P0001'; END IF;
    IF (_row.v->>'opens_at') !~ '^\d{2}:\d{2}$' OR (_row.v->>'closes_at') !~ '^\d{2}:\d{2}$' THEN
      RAISE EXCEPTION 'INVALID_HOURS' USING ERRCODE = 'P0001';
    END IF;
    _a := split_part(_row.v->>'opens_at', ':', 1)::int * 60 + split_part(_row.v->>'opens_at', ':', 2)::int;
    _b := split_part(_row.v->>'closes_at', ':', 1)::int * 60 + split_part(_row.v->>'closes_at', ':', 2)::int;
    IF _a > 1439 OR _b > 1439 THEN RAISE EXCEPTION 'INVALID_HOURS' USING ERRCODE = 'P0001'; END IF;
    IF _a = _b THEN RAISE EXCEPTION 'EMPTY_SHIFT' USING ERRCODE = 'P0001'; END IF;
    IF _b < _a THEN _b := _b + 1440; END IF;
    INSERT INTO _incoming VALUES (_wd, (_row.v->>'opens_at')::time, (_row.v->>'closes_at')::time, _a, _b);
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM _incoming i JOIN _incoming j
      ON i.weekday = j.weekday AND i.ctid <> j.ctid
     WHERE i.s < j.e AND j.s < i.e
  ) THEN
    RAISE EXCEPTION 'OVERLAPPING_SHIFTS' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.store_hours WHERE store_id = _sid;
  INSERT INTO public.store_hours (store_id, weekday, opens_at, closes_at, is_active)
  SELECT _sid, weekday, opens, closes, true FROM _incoming;

  UPDATE public.store_settings SET updated_at = now() WHERE store_id = _sid;

  PERFORM private.log_config_audit(_sid, 'store.hours.updated', 'store_hours', _sid, ARRAY['weekly_hours']);
  RETURN public.get_my_store_configuration(_sid);
END;
$$;

------------------------------------------------------------------
-- Estado operacional calculado no servidor
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_store_operational_preview(_store_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _tz text; _status public.store_status; _del boolean; _pick boolean; _auto boolean;
  _local timestamp; _wd int; _mins int;
  _open boolean := false; _closes text := NULL;
  _next_day int; _next_open text := NULL; _next_label text := NULL;
  _i int; _r record;
BEGIN
  PERFORM private.require_permission('store.view_basic', _sid);

  SELECT s.timezone, s.status, s.accepts_delivery, s.accepts_pickup, st.auto_open_by_hours
    INTO _tz, _status, _del, _pick, _auto
    FROM public.stores s LEFT JOIN public.store_settings st ON st.store_id = s.id
   WHERE s.id = _sid;
  IF _tz IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;

  _local := now() AT TIME ZONE _tz;
  _wd := extract(dow FROM _local)::int;
  _mins := extract(hour FROM _local)::int * 60 + extract(minute FROM _local)::int;

  -- turno de hoje
  FOR _r IN
    SELECT opens_at, closes_at,
           extract(hour FROM opens_at)::int * 60 + extract(minute FROM opens_at)::int AS s,
           CASE WHEN closes_at <= opens_at
                THEN extract(hour FROM closes_at)::int * 60 + extract(minute FROM closes_at)::int + 1440
                ELSE extract(hour FROM closes_at)::int * 60 + extract(minute FROM closes_at)::int END AS e
      FROM public.store_hours WHERE store_id = _sid AND is_active AND weekday = _wd
  LOOP
    IF _mins >= _r.s AND _mins < _r.e THEN
      _open := true; _closes := to_char(_r.closes_at, 'HH24:MI');
    END IF;
  END LOOP;

  -- turno de ontem que atravessa a meia-noite
  IF NOT _open THEN
    FOR _r IN
      SELECT closes_at,
             extract(hour FROM opens_at)::int * 60 + extract(minute FROM opens_at)::int AS s,
             extract(hour FROM closes_at)::int * 60 + extract(minute FROM closes_at)::int AS e
        FROM public.store_hours
       WHERE store_id = _sid AND is_active AND weekday = (_wd + 6) % 7
    LOOP
      IF _r.e <= _r.s AND _mins < _r.e THEN
        _open := true; _closes := to_char(_r.closes_at, 'HH24:MI');
      END IF;
    END LOOP;
  END IF;

  -- próxima abertura
  IF NOT _open THEN
    FOR _i IN 0..7 LOOP
      _next_day := (_wd + _i) % 7;
      SELECT to_char(opens_at, 'HH24:MI') INTO _next_open
        FROM public.store_hours
       WHERE store_id = _sid AND is_active AND weekday = _next_day
         AND (_i > 0 OR (extract(hour FROM opens_at)::int * 60 + extract(minute FROM opens_at)::int) > _mins)
       ORDER BY opens_at LIMIT 1;
      IF _next_open IS NOT NULL THEN
        _next_label := CASE _i WHEN 0 THEN 'hoje' WHEN 1 THEN 'amanha' ELSE
          (ARRAY['domingo','segunda','terca','quarta','quinta','sexta','sabado'])[_next_day + 1] END;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF _status <> 'ativa' THEN _open := false; END IF;
  IF _auto IS FALSE THEN _open := false; END IF;

  RETURN jsonb_build_object(
    'timezone', _tz,
    'local_time', to_char(_local, 'HH24:MI'),
    'is_open', _open,
    'closes_at', _closes,
    'next_open_at', _next_open,
    'next_open_day', _next_label,
    'delivery_enabled', coalesce(_del, false),
    'pickup_enabled', coalesce(_pick, false),
    'reason', CASE
      WHEN _status <> 'ativa' THEN 'loja_indisponivel'
      WHEN _auto IS FALSE THEN 'abertura_manual'
      WHEN _open THEN NULL
      WHEN _next_open IS NULL THEN 'sem_horarios'
      ELSE 'fora_do_horario' END
  );
END;
$$;

------------------------------------------------------------------
-- Bairros e taxas
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_store_neighborhood(
  _store_id uuid, _id uuid, _name text, _delivery_fee numeric,
  _min_order_amount numeric, _eta_minutes integer, _notes text, _is_active boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _n text := btrim(coalesce(_name,''));
  _nid uuid; _next int;
BEGIN
  PERFORM private.require_permission('store.manage_neighborhoods', _sid);

  IF length(_n) < 2 OR length(_n) > 80 THEN RAISE EXCEPTION 'INVALID_NAME' USING ERRCODE = 'P0001'; END IF;
  IF _delivery_fee IS NULL OR _delivery_fee < 0 OR _delivery_fee > 100000 THEN
    RAISE EXCEPTION 'INVALID_FEE' USING ERRCODE = 'P0001'; END IF;
  IF _min_order_amount IS NOT NULL AND (_min_order_amount < 0 OR _min_order_amount > 100000) THEN
    RAISE EXCEPTION 'INVALID_MIN_ORDER' USING ERRCODE = 'P0001'; END IF;
  IF _eta_minutes IS NULL OR _eta_minutes <= 0 OR _eta_minutes > 600 THEN
    RAISE EXCEPTION 'INVALID_ETA' USING ERRCODE = 'P0001'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.neighborhoods n
     WHERE n.store_id = _sid
       AND public.normalize_label(n.name) = public.normalize_label(_n)
       AND (_id IS NULL OR n.id <> _id)
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_NEIGHBORHOOD' USING ERRCODE = 'P0001';
  END IF;

  IF _id IS NULL THEN
    SELECT coalesce(max(sort_order), 0) + 1 INTO _next FROM public.neighborhoods WHERE store_id = _sid;
    INSERT INTO public.neighborhoods (store_id, name, delivery_fee, min_order_amount, eta_minutes, notes, is_active, sort_order)
    VALUES (_sid, _n, round(_delivery_fee,2), round(_min_order_amount,2), _eta_minutes,
            nullif(btrim(coalesce(_notes,'')),''), coalesce(_is_active,true), _next)
    RETURNING id INTO _nid;
    PERFORM private.log_config_audit(_sid, 'store.neighborhood.created', 'neighborhoods', _nid, ARRAY['name','delivery_fee','min_order_amount','eta_minutes','notes','is_active']);
  ELSE
    UPDATE public.neighborhoods
       SET name = _n, delivery_fee = round(_delivery_fee,2),
           min_order_amount = round(_min_order_amount,2), eta_minutes = _eta_minutes,
           notes = nullif(btrim(coalesce(_notes,'')),''),
           is_active = coalesce(_is_active, is_active), updated_at = now()
     WHERE id = _id AND store_id = _sid
    RETURNING id INTO _nid;
    IF _nid IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    PERFORM private.log_config_audit(_sid, 'store.neighborhood.updated', 'neighborhoods', _nid, ARRAY['name','delivery_fee','min_order_amount','eta_minutes','notes','is_active']);
  END IF;

  RETURN public.get_my_store_configuration(_sid);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_store_neighborhood(_store_id uuid, _id uuid, _archived boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _sid uuid := private.resolve_store(_store_id); _nid uuid;
BEGIN
  PERFORM private.require_permission('store.manage_neighborhoods', _sid);
  UPDATE public.neighborhoods
     SET is_archived = coalesce(_archived, true),
         is_active = CASE WHEN coalesce(_archived, true) THEN false ELSE is_active END,
         updated_at = now()
   WHERE id = _id AND store_id = _sid
  RETURNING id INTO _nid;
  IF _nid IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.log_config_audit(_sid, 'store.neighborhood.archived', 'neighborhoods', _nid, ARRAY['is_archived']);
  RETURN public.get_my_store_configuration(_sid);
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_store_neighborhoods(_store_id uuid, _ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _sid uuid := private.resolve_store(_store_id);
BEGIN
  PERFORM private.require_permission('store.manage_neighborhoods', _sid);
  IF _ids IS NULL THEN RAISE EXCEPTION 'INVALID_ORDER' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.neighborhoods n
     SET sort_order = o.ord, updated_at = now()
    FROM (SELECT id, ordinality::int AS ord FROM unnest(_ids) WITH ORDINALITY AS t(id, ordinality)) o
   WHERE n.id = o.id AND n.store_id = _sid;
  PERFORM private.log_config_audit(_sid, 'store.neighborhood.updated', 'neighborhoods', NULL, ARRAY['sort_order']);
  RETURN public.get_my_store_configuration(_sid);
END;
$$;

------------------------------------------------------------------
-- Formas de pagamento
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_store_payment_method(
  _store_id uuid, _id uuid, _label text, _instructions text,
  _needs_change boolean, _is_active boolean,
  _available_for_delivery boolean, _available_for_pickup boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _l text := btrim(coalesce(_label,''));
  _pid uuid;
BEGIN
  PERFORM private.require_permission('store.manage_payment_methods', _sid);
  IF length(_l) < 2 OR length(_l) > 60 THEN RAISE EXCEPTION 'INVALID_NAME' USING ERRCODE = 'P0001'; END IF;
  IF length(coalesce(_instructions,'')) > 400 THEN RAISE EXCEPTION 'INVALID_INSTRUCTIONS' USING ERRCODE = 'P0001'; END IF;
  IF coalesce(_is_active,false)
     AND NOT (coalesce(_available_for_delivery,false) OR coalesce(_available_for_pickup,false)) THEN
    RAISE EXCEPTION 'INVALID_AVAILABILITY' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.payment_methods
     SET label = _l,
         instructions = nullif(btrim(coalesce(_instructions,'')),''),
         needs_change = coalesce(_needs_change, false),
         is_active = coalesce(_is_active, false),
         available_for_delivery = coalesce(_available_for_delivery, false),
         available_for_pickup = coalesce(_available_for_pickup, false),
         updated_at = now()
   WHERE id = _id AND store_id = _sid
  RETURNING id INTO _pid;
  IF _pid IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;

  PERFORM private.log_config_audit(_sid, 'store.payment_method.updated', 'payment_methods', _pid,
    ARRAY['label','instructions','needs_change','is_active','available_for_delivery','available_for_pickup']);
  RETURN public.get_my_store_configuration(_sid);
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_store_payment_methods(_store_id uuid, _ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _sid uuid := private.resolve_store(_store_id);
BEGIN
  PERFORM private.require_permission('store.manage_payment_methods', _sid);
  IF _ids IS NULL THEN RAISE EXCEPTION 'INVALID_ORDER' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.payment_methods p
     SET sort_order = o.ord, updated_at = now()
    FROM (SELECT id, ordinality::int AS ord FROM unnest(_ids) WITH ORDINALITY AS t(id, ordinality)) o
   WHERE p.id = o.id AND p.store_id = _sid;
  PERFORM private.log_config_audit(_sid, 'store.payment_method.updated', 'payment_methods', NULL, ARRAY['sort_order']);
  RETURN public.get_my_store_configuration(_sid);
END;
$$;

------------------------------------------------------------------
-- Grants: apenas sessões autenticadas
------------------------------------------------------------------
DO $$
DECLARE _fn text;
BEGIN
  FOREACH _fn IN ARRAY ARRAY[
    'public.list_my_stores()',
    'public.get_my_store_configuration(uuid)',
    'public.update_store_profile(uuid,text,text,text,text,text,text,text,text,text,text,timestamptz)',
    'public.check_store_slug_availability(uuid,text)',
    'public.update_store_slug(uuid,text,timestamptz)',
    'public.update_store_theme(uuid,text,text,text,text,timestamptz)',
    'public.clear_store_asset(uuid,text)',
    'public.update_store_service_settings(uuid,boolean,boolean,numeric,integer,boolean,boolean,timestamptz)',
    'public.replace_store_hours(uuid,jsonb,timestamptz)',
    'public.get_store_operational_preview(uuid)',
    'public.upsert_store_neighborhood(uuid,uuid,text,numeric,numeric,integer,text,boolean)',
    'public.archive_store_neighborhood(uuid,uuid,boolean)',
    'public.reorder_store_neighborhoods(uuid,uuid[])',
    'public.update_store_payment_method(uuid,uuid,text,text,boolean,boolean,boolean,boolean)',
    'public.reorder_store_payment_methods(uuid,uuid[])'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', _fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', _fn);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION private.require_permission(public.app_permission, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.resolve_store(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.log_config_audit(uuid, text, text, uuid, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.reserved_slugs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.assert_version(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
