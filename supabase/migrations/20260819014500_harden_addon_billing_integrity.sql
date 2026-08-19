-- Comandiva add-on billing hardening.
-- Lock canonical add-on/price/store relationships before any paid add-on is live,
-- make provider payment idempotency fail closed across subscriptions, and keep
-- commercial subscription data behind subscription.view.

-- A price referenced by a subscription must belong to the same add-on.
ALTER TABLE public.addon_prices
  ADD CONSTRAINT addon_prices_id_addon_id_key UNIQUE (id, addon_id);

ALTER TABLE public.store_addon_subscriptions
  DROP CONSTRAINT store_addon_subscriptions_addon_price_id_fkey;

ALTER TABLE public.store_addon_subscriptions
  ADD CONSTRAINT store_addon_subscriptions_addon_price_matches_addon_fk
  FOREIGN KEY (addon_price_id, addon_id)
  REFERENCES public.addon_prices(id, addon_id)
  ON DELETE RESTRICT;

-- A ledger row's store must be the store that owns its add-on subscription.
ALTER TABLE public.store_addon_subscriptions
  ADD CONSTRAINT store_addon_subscriptions_id_store_id_key UNIQUE (id, store_id);

ALTER TABLE public.addon_subscription_payments
  ADD CONSTRAINT addon_subscription_payments_subscription_store_fk
  FOREIGN KEY (addon_subscription_id, store_id)
  REFERENCES public.store_addon_subscriptions(id, store_id)
  ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION private.record_addon_provider_payment(
  _addon_subscription_id uuid,
  _provider text,
  _provider_payment_id text,
  _provider_event_key text,
  _provider_status text,
  _status text,
  _amount_cents integer,
  _currency text DEFAULT 'BRL',
  _paid_at timestamptz DEFAULT NULL,
  _due_at timestamptz DEFAULT NULL,
  _provider_invoice_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _subscription public.store_addon_subscriptions%rowtype;
  _payment public.addon_subscription_payments%rowtype;
  _event_payment public.addon_subscription_payments%rowtype;
  _payment_id uuid;
  _reference_month date;
  _timezone text;
  _event_key text := nullif(trim(coalesce(_provider_event_key,'')),'');
BEGIN
  IF _status NOT IN ('pending','approved','rejected','refunded','cancelled') THEN
    RAISE EXCEPTION 'INVALID_ADDON_PAYMENT_STATUS' USING ERRCODE='P0001';
  END IF;
  IF _provider !~ '^[a-z0-9_]+$' OR nullif(trim(_provider_payment_id),'') IS NULL THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_PAYMENT_REFERENCE' USING ERRCODE='P0001';
  END IF;
  IF coalesce(_amount_cents,-1) < 0 OR _currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT' USING ERRCODE='P0001';
  END IF;

  SELECT s.* INTO _subscription
  FROM public.store_addon_subscriptions s
  WHERE s.id = _addon_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ADDON_SUBSCRIPTION_NOT_FOUND' USING ERRCODE='P0001';
  END IF;

  -- Payment events are only accepted after the canonical subscription was bound
  -- to the provider. A racing webhook should retry after attachment, not invent a
  -- provider association implicitly.
  IF _subscription.billing_provider IS NULL
     OR _subscription.provider_subscription_id IS NULL THEN
    RAISE EXCEPTION 'ADDON_PROVIDER_NOT_ATTACHED' USING ERRCODE='P0001';
  END IF;
  IF _subscription.billing_provider <> _provider THEN
    RAISE EXCEPTION 'ADDON_PROVIDER_MISMATCH' USING ERRCODE='P0001';
  END IF;

  SELECT coalesce(st.timezone,'America/Sao_Paulo') INTO _timezone
  FROM public.stores st
  WHERE st.id = _subscription.store_id;

  _reference_month := date_trunc(
    'month',
    coalesce(_paid_at,_due_at,now()) AT TIME ZONE _timezone
  )::date;

  -- An event key is globally unique per provider. If it is already attached to a
  -- different provider payment or subscription, fail closed instead of silently
  -- treating the event as idempotent.
  IF _event_key IS NOT NULL THEN
    SELECT p.* INTO _event_payment
    FROM public.addon_subscription_payments p
    WHERE p.provider = _provider
      AND p.provider_event_key = _event_key
    FOR UPDATE;

    IF FOUND AND (
      _event_payment.provider_payment_id IS DISTINCT FROM trim(_provider_payment_id)
      OR _event_payment.addon_subscription_id <> _addon_subscription_id
      OR _event_payment.store_id <> _subscription.store_id
    ) THEN
      RAISE EXCEPTION 'ADDON_PROVIDER_EVENT_CONFLICT' USING ERRCODE='P0001';
    END IF;
  END IF;

  SELECT p.* INTO _payment
  FROM public.addon_subscription_payments p
  WHERE p.provider = _provider
    AND p.provider_payment_id = trim(_provider_payment_id)
  FOR UPDATE;

  IF FOUND THEN
    IF _payment.addon_subscription_id <> _addon_subscription_id
       OR _payment.store_id <> _subscription.store_id THEN
      RAISE EXCEPTION 'ADDON_PAYMENT_SUBSCRIPTION_MISMATCH' USING ERRCODE='P0001';
    END IF;

    UPDATE public.addon_subscription_payments p
    SET provider_event_key = coalesce(_event_key,p.provider_event_key),
        provider_status = nullif(trim(coalesce(_provider_status,'')),''),
        status = _status,
        amount_cents = _amount_cents,
        currency = _currency,
        paid_at = coalesce(_paid_at,p.paid_at),
        due_at = coalesce(_due_at,p.due_at),
        provider_invoice_id = coalesce(
          nullif(trim(coalesce(_provider_invoice_id,'')),''),
          p.provider_invoice_id
        ),
        metadata = coalesce(_metadata,'{}'::jsonb),
        updated_at = now()
    WHERE p.id = _payment.id;

    RETURN _payment.id;
  END IF;

  INSERT INTO public.addon_subscription_payments(
    store_id,
    addon_subscription_id,
    addon_price_id,
    reference_month,
    amount_cents,
    currency,
    status,
    provider,
    provider_payment_id,
    provider_invoice_id,
    provider_event_key,
    provider_status,
    due_at,
    paid_at,
    external_reference,
    metadata
  ) VALUES (
    _subscription.store_id,
    _subscription.id,
    _subscription.addon_price_id,
    _reference_month,
    _amount_cents,
    _currency,
    _status,
    _provider,
    trim(_provider_payment_id),
    nullif(trim(coalesce(_provider_invoice_id,'')),''),
    _event_key,
    nullif(trim(coalesce(_provider_status,'')),''),
    _due_at,
    _paid_at,
    private.addon_billing_external_reference(_subscription.id),
    coalesce(_metadata,'{}'::jsonb)
  )
  RETURNING id INTO _payment_id;

  RETURN _payment_id;
EXCEPTION
  WHEN unique_violation THEN
    -- Concurrency-safe idempotency: only the exact same subscription/payment may
    -- collapse to the existing row. Event-key collisions with a different row
    -- remain hard failures.
    SELECT p.* INTO _payment
    FROM public.addon_subscription_payments p
    WHERE p.provider = _provider
      AND p.provider_payment_id = trim(_provider_payment_id);

    IF FOUND THEN
      IF _payment.addon_subscription_id <> _addon_subscription_id
         OR _payment.store_id <> _subscription.store_id THEN
        RAISE EXCEPTION 'ADDON_PAYMENT_SUBSCRIPTION_MISMATCH' USING ERRCODE='P0001';
      END IF;
      RETURN _payment.id;
    END IF;

    IF _event_key IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.addon_subscription_payments p
      WHERE p.provider = _provider
        AND p.provider_event_key = _event_key
    ) THEN
      RAISE EXCEPTION 'ADDON_PROVIDER_EVENT_CONFLICT' USING ERRCODE='P0001';
    END IF;

    RAISE;
END;
$function$;

REVOKE ALL ON FUNCTION private.record_addon_provider_payment(
  uuid,text,text,text,text,text,integer,text,timestamptz,timestamptz,text,jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.record_addon_provider_payment(
  uuid,text,text,text,text,text,integer,text,timestamptz,timestamptz,text,jsonb
) TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_store_addons(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _items jsonb;
  _can_view_billing boolean;
BEGIN
  IF NOT private.is_store_member(_store_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;

  _can_view_billing := private.has_permission(
    'subscription.view'::public.app_permission,
    _store_id
  );

  SELECT coalesce(
    jsonb_agg(item ORDER BY (item->>'sort_order')::integer,item->>'name'),
    '[]'::jsonb
  )
  INTO _items
  FROM (
    SELECT jsonb_build_object(
      'code',a.code,
      'name',a.name,
      'description',a.description,
      'category',a.category,
      'billing_model',a.billing_model,
      'availability_status',a.availability_status,
      'sort_order',a.sort_order,
      'features',coalesce((
        SELECT jsonb_agg(ae.feature_code ORDER BY ae.feature_code)
        FROM public.addon_entitlements ae
        WHERE ae.addon_id=a.id
      ),'[]'::jsonb),
      'monthly_price',CASE
        WHEN NOT _can_view_billing OR p.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'amount_cents',p.amount_cents,
          'currency',p.currency,
          'included_units',p.included_units,
          'metering_metric_code',p.metering_metric_code,
          'hard_limit_units',p.hard_limit_units
        )
      END,
      'subscription',CASE
        WHEN NOT _can_view_billing OR s.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'status',s.status,
          'current_period_end',s.current_period_end,
          'trial_ends_at',s.trial_ends_at,
          'grace_until',s.grace_until,
          'cancel_at_period_end',s.cancel_at_period_end,
          'complimentary_until',s.complimentary_until
        )
      END
    ) AS item
    FROM public.addon_catalog a
    LEFT JOIN LATERAL (
      SELECT ap.*
      FROM public.addon_prices ap
      WHERE ap.addon_id=a.id
        AND ap.billing_interval='monthly'
        AND ap.is_active
      ORDER BY ap.created_at DESC
      LIMIT 1
    ) p ON true
    LEFT JOIN public.store_addon_subscriptions s
      ON s.store_id=_store_id
     AND s.addon_id=a.id
    WHERE a.is_active
  ) q;

  RETURN jsonb_build_object(
    'can_view_billing',_can_view_billing,
    'items',_items
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_store_addons(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_store_addons(uuid) TO authenticated;
