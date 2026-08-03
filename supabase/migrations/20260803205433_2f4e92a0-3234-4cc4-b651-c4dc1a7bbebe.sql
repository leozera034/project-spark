-- 1. Intenções de provisionamento (idempotência da saga)
CREATE TABLE IF NOT EXISTS public.store_provisioning_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  request_hash text NOT NULL,
  status text NOT NULL DEFAULT 'iniciada',
  origin text NOT NULL DEFAULT 'autoatendimento',
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  owner_user_id uuid,
  requested_by uuid,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_provisioning_intents_status_check
    CHECK (status IN ('iniciada','concluida','falhou'))
);

GRANT ALL ON public.store_provisioning_intents TO service_role;
ALTER TABLE public.store_provisioning_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provisioning_intents_admin_read"
  ON public.store_provisioning_intents
  FOR SELECT
  TO authenticated
  USING (private.is_platform_admin());

-- 2. Disponibilidade pública de slug (tela de cadastro de loja)
CREATE OR REPLACE FUNCTION public.check_public_store_slug(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  _n text := public.normalize_store_slug(coalesce(_slug, ''));
BEGIN
  IF length(_n) < 3 OR length(_n) > 60 THEN
    RETURN jsonb_build_object('slug', _n, 'available', false, 'reason', 'formato');
  END IF;
  IF _n = ANY (private.reserved_slugs()) THEN
    RETURN jsonb_build_object('slug', _n, 'available', false, 'reason', 'reservado');
  END IF;
  IF EXISTS (SELECT 1 FROM public.stores s WHERE s.slug = _n) THEN
    RETURN jsonb_build_object('slug', _n, 'available', false, 'reason', 'em_uso');
  END IF;
  RETURN jsonb_build_object('slug', _n, 'available', true, 'reason', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.check_public_store_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_public_store_slug(text) TO anon, authenticated, service_role;

-- 3. Saga de criação de loja com proprietário (somente servidor)
CREATE OR REPLACE FUNCTION public.provision_store_with_owner(
  _idempotency_key text,
  _request_hash text,
  _owner_user_id uuid,
  _owner_full_name text,
  _store_name text,
  _slug text,
  _city text,
  _state text,
  _segment text,
  _phone text,
  _plan_code text DEFAULT 'essencial',
  _origin text DEFAULT 'autoatendimento',
  _requested_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  _existing public.store_provisioning_intents;
  _slug_n text := public.normalize_store_slug(coalesce(_store_name, ''));
  _store_id uuid;
  _plan_id uuid;
  _plan_price numeric;
  _weekday int;
BEGIN
  IF coalesce(btrim(_slug), '') <> '' THEN
    _slug_n := public.normalize_store_slug(_slug);
  END IF;

  SELECT * INTO _existing
    FROM public.store_provisioning_intents
   WHERE idempotency_key = _idempotency_key;

  IF FOUND THEN
    IF _existing.request_hash <> _request_hash THEN
      RAISE EXCEPTION 'CONFLITO_IDEMPOTENCIA';
    END IF;
    IF _existing.status = 'concluida' THEN
      RETURN jsonb_build_object(
        'store_id', _existing.store_id,
        'slug', (SELECT slug FROM public.stores WHERE id = _existing.store_id),
        'already_provisioned', true
      );
    END IF;
  ELSE
    INSERT INTO public.store_provisioning_intents
      (idempotency_key, request_hash, origin, owner_user_id, requested_by)
    VALUES (_idempotency_key, _request_hash, _origin, _owner_user_id, _requested_by);
  END IF;

  IF length(_slug_n) < 3 OR length(_slug_n) > 60 THEN
    RAISE EXCEPTION 'SLUG_INVALIDO';
  END IF;
  IF _slug_n = ANY (private.reserved_slugs()) THEN
    RAISE EXCEPTION 'SLUG_RESERVADO';
  END IF;
  IF EXISTS (SELECT 1 FROM public.stores WHERE slug = _slug_n) THEN
    RAISE EXCEPTION 'SLUG_EM_USO';
  END IF;
  IF coalesce(btrim(_store_name), '') = '' THEN
    RAISE EXCEPTION 'NOME_INVALIDO';
  END IF;

  INSERT INTO public.stores
    (slug, name, status, segment, phone, whatsapp, city, state, timezone,
     accepts_delivery, accepts_pickup)
  VALUES
    (_slug_n, btrim(_store_name), 'em_implantacao', nullif(btrim(coalesce(_segment,'')), ''),
     nullif(btrim(coalesce(_phone,'')), ''), nullif(btrim(coalesce(_phone,'')), ''),
     coalesce(nullif(btrim(coalesce(_city,'')), ''), 'Não informado'),
     upper(coalesce(nullif(btrim(coalesce(_state,'')), ''), 'BR')),
     'America/Sao_Paulo', true, true)
  RETURNING id INTO _store_id;

  INSERT INTO public.store_settings (store_id) VALUES (_store_id);

  FOR _weekday IN 0..6 LOOP
    INSERT INTO public.store_hours (store_id, weekday, opens_at, closes_at, is_active)
    VALUES (_store_id, _weekday, '08:00', '23:00', true);
  END LOOP;

  INSERT INTO public.payment_methods
    (store_id, kind, label, needs_change, is_active, sort_order,
     available_for_delivery, available_for_pickup)
  VALUES
    (_store_id, 'dinheiro', 'Dinheiro', true, true, 1, true, true),
    (_store_id, 'pix', 'Pix', false, true, 2, true, true);

  INSERT INTO public.user_profiles (id, full_name, display_name, phone, is_active)
  VALUES (_owner_user_id, btrim(_owner_full_name), split_part(btrim(_owner_full_name), ' ', 1),
          nullif(btrim(coalesce(_phone,'')), ''), true)
  ON CONFLICT (id) DO UPDATE
    SET full_name = excluded.full_name,
        display_name = excluded.display_name,
        is_active = true,
        updated_at = now();

  INSERT INTO public.user_roles (user_id, store_id, role, is_active)
  VALUES (_owner_user_id, _store_id, 'proprietario', true)
  ON CONFLICT DO NOTHING;

  SELECT id, monthly_price INTO _plan_id, _plan_price
    FROM public.plans
   WHERE code = coalesce(_plan_code, 'essencial') AND is_active
   LIMIT 1;

  IF _plan_id IS NULL THEN
    SELECT id, monthly_price INTO _plan_id, _plan_price
      FROM public.plans WHERE is_active ORDER BY sort_order LIMIT 1;
  END IF;

  IF _plan_id IS NOT NULL THEN
    INSERT INTO public.store_subscriptions
      (store_id, plan_id, status, monthly_price, due_day, grace_days,
       current_period_end, started_at, notes)
    VALUES
      (_store_id, _plan_id, 'em_teste', _plan_price, 10, 5,
       (current_date + interval '14 days')::date, current_date,
       'Período de avaliação de 14 dias criado no provisionamento.');
  END IF;

  INSERT INTO public.audit_logs
    (store_id, actor_user_id, actor_kind, action, entity, entity_id, context)
  VALUES
    (_store_id, coalesce(_requested_by, _owner_user_id), 'sistema',
     'platform.store_created', 'stores', _store_id,
     jsonb_build_object('origin', _origin, 'slug', _slug_n, 'plan_code', _plan_code));

  UPDATE public.store_provisioning_intents
     SET status = 'concluida',
         store_id = _store_id,
         owner_user_id = _owner_user_id,
         updated_at = now()
   WHERE idempotency_key = _idempotency_key;

  RETURN jsonb_build_object('store_id', _store_id, 'slug', _slug_n, 'already_provisioned', false);
END;
$$;

REVOKE ALL ON FUNCTION public.provision_store_with_owner(text,text,uuid,text,text,text,text,text,text,text,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_store_with_owner(text,text,uuid,text,text,text,text,text,text,text,text,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.fail_store_provisioning(_idempotency_key text, _reason text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
  UPDATE public.store_provisioning_intents
     SET status = 'falhou', failure_reason = left(coalesce(_reason,''), 300), updated_at = now()
   WHERE idempotency_key = _idempotency_key;
$$;

REVOKE ALL ON FUNCTION public.fail_store_provisioning(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_store_provisioning(text,text) TO service_role;