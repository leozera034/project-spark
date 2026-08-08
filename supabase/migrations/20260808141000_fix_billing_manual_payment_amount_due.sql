-- Manual-payment ledger semantics after Phase 22 reconciliation.
-- amount_due_cents represents the obligation discharged by the event:
-- paid amount + granted discount. amount_paid_cents remains cash actually paid.

CREATE OR REPLACE FUNCTION private.register_manual_payment(
  _subscription_id uuid,
  _amount_paid_cents integer,
  _discount_amount_cents integer DEFAULT 0,
  _payment_method public.payment_method DEFAULT 'manual_transfer',
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE
  _sub public.store_subscriptions;
  _payment_id uuid;
  _legacy_amount numeric(10,2);
BEGIN
  IF NOT private.has_permission('platform.billing.register_payment', NULL) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(_amount_paid_cents, -1) < 0 OR coalesce(_discount_amount_cents, -1) < 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO _sub
    FROM public.store_subscriptions
   WHERE id = _subscription_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  _legacy_amount := round((_amount_paid_cents::numeric / 100.0), 2);

  INSERT INTO public.subscription_payments (
    store_id,
    subscription_id,
    reference_month,
    amount,
    status,
    paid_at,
    method_note,
    registered_by,
    notes,
    amount_due_cents,
    amount_paid_cents,
    discount_amount_cents,
    currency,
    due_date,
    payment_method,
    audit_immutable,
    created_by
  ) VALUES (
    _sub.store_id,
    _sub.id,
    date_trunc('month', current_date)::date,
    _legacy_amount,
    'pago',
    now(),
    _payment_method::text,
    auth.uid(),
    nullif(btrim(coalesce(_notes, '')), ''),
    _amount_paid_cents + _discount_amount_cents,
    _amount_paid_cents,
    _discount_amount_cents,
    'BRL',
    current_date,
    _payment_method,
    true,
    auth.uid()
  ) RETURNING id INTO _payment_id;

  UPDATE public.store_subscriptions
     SET status = 'ativa',
         current_period_start = now(),
         current_period_end = (current_date + interval '1 month')::date,
         next_billing_date = now() + interval '1 month',
         updated_at = now(),
         version = version + 1
   WHERE id = _subscription_id;

  INSERT INTO public.audit_logs
    (store_id, actor_user_id, actor_kind, action, entity, entity_id, context)
  VALUES (
    _sub.store_id,
    auth.uid(),
    'admin',
    'platform.billing.manual_payment_registered',
    'subscription_payments',
    _payment_id,
    jsonb_build_object('subscriptionId', _subscription_id, 'paymentId', _payment_id)
  );

  RETURN _payment_id;
END;
$$;

REVOKE ALL ON FUNCTION private.register_manual_payment(uuid,integer,integer,public.payment_method,text) FROM PUBLIC;
