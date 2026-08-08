-- Fase 22 — evolução do billing existente para contrato em centavos.
--
-- A Fase 04 já criou plans, store_subscriptions, subscription_payments e o enum
-- subscription_status. Esta migration NÃO cria uma segunda fundação: evolui as
-- tabelas existentes, preserva os dados/colunas legadas durante a transição e
-- instala as RPCs usadas pelo módulo atual de billing.

-- 1. Tipos novos que realmente não existiam na fundação ----------------------
CREATE TYPE public.plan_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE public.payment_method AS ENUM ('manual_transfer', 'pix_manual', 'cash', 'other');
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- subscription_status permanece canônico no vocabulário original:
-- ativa | inadimplente | suspensa | cortesia | cancelada.

-- 2. Plans: adicionar contrato monetário em centavos -------------------------
ALTER TABLE public.plans
  ADD COLUMN monthly_amount_cents integer,
  ADD COLUMN currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN grace_days integer NOT NULL DEFAULT 3,
  ADD COLUMN reminder_days_before integer NOT NULL DEFAULT 5,
  ADD COLUMN status public.plan_status,
  ADD COLUMN is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN version integer NOT NULL DEFAULT 1,
  ADD COLUMN created_by uuid REFERENCES auth.users(id),
  ADD COLUMN updated_by uuid REFERENCES auth.users(id);

UPDATE public.plans
   SET monthly_amount_cents = round(monthly_price * 100)::integer,
       status = CASE WHEN is_active THEN 'active'::public.plan_status ELSE 'archived'::public.plan_status END,
       is_archived = NOT is_active
 WHERE monthly_amount_cents IS NULL OR status IS NULL;

ALTER TABLE public.plans
  ALTER COLUMN monthly_amount_cents SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE public.plans
  ADD CONSTRAINT plans_monthly_amount_cents_check CHECK (monthly_amount_cents >= 0),
  ADD CONSTRAINT plans_phase22_grace_days_check CHECK (grace_days >= 0),
  ADD CONSTRAINT plans_reminder_days_before_check CHECK (reminder_days_before >= 0);

-- 3. Assinaturas: adicionar período/versionamento modernos -------------------
ALTER TABLE public.store_subscriptions
  ADD COLUMN current_period_start timestamptz,
  ADD COLUMN trial_end timestamptz,
  ADD COLUMN cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN suspended_at timestamptz,
  ADD COLUMN next_billing_date timestamptz,
  ADD COLUMN version integer NOT NULL DEFAULT 1;

UPDATE public.store_subscriptions
   SET current_period_start = coalesce(
         current_period_start,
         started_at::timestamp AT TIME ZONE 'America/Sao_Paulo'
       ),
       next_billing_date = coalesce(
         next_billing_date,
         CASE
           WHEN current_period_end IS NOT NULL
             THEN current_period_end::timestamp AT TIME ZONE 'America/Sao_Paulo'
           ELSE (started_at::timestamp AT TIME ZONE 'America/Sao_Paulo') + interval '1 month'
         END
       ),
       trial_end = CASE
         WHEN status = 'cortesia' AND trial_end IS NULL
           THEN coalesce(
             current_period_end::timestamp AT TIME ZONE 'America/Sao_Paulo',
             (started_at::timestamp AT TIME ZONE 'America/Sao_Paulo') + interval '14 days'
           )
         ELSE trial_end
       END;

ALTER TABLE public.store_subscriptions
  ALTER COLUMN current_period_start SET NOT NULL,
  ALTER COLUMN current_period_start SET DEFAULT now(),
  ALTER COLUMN next_billing_date SET NOT NULL;

-- 4. Pagamentos: evoluir log manual para centavos/imutabilidade ---------------
ALTER TABLE public.subscription_payments
  ADD COLUMN amount_due_cents integer,
  ADD COLUMN amount_paid_cents integer,
  ADD COLUMN discount_amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN due_date date,
  ADD COLUMN payment_method public.payment_method,
  ADD COLUMN audit_immutable boolean NOT NULL DEFAULT true,
  ADD COLUMN created_by uuid REFERENCES auth.users(id);

UPDATE public.subscription_payments
   SET amount_due_cents = coalesce(amount_due_cents, round(amount * 100)::integer),
       amount_paid_cents = coalesce(
         amount_paid_cents,
         CASE WHEN status IN ('pago','cortesia') THEN round(amount * 100)::integer ELSE 0 END
       ),
       due_date = coalesce(due_date, reference_month, created_at::date);

ALTER TABLE public.subscription_payments
  ALTER COLUMN amount_due_cents SET NOT NULL,
  ALTER COLUMN amount_paid_cents SET NOT NULL,
  ALTER COLUMN amount_paid_cents SET DEFAULT 0,
  ALTER COLUMN due_date SET NOT NULL,
  ALTER COLUMN reference_month DROP NOT NULL;

-- O modelo Phase22 é log imutável por evento, portanto mais de um lançamento no
-- mesmo mês é permitido. A constraint antiga de uma linha por mês impediria
-- pagamentos/ajustes manuais independentes.
ALTER TABLE public.subscription_payments
  DROP CONSTRAINT IF EXISTS subscription_payments_month_unique;

ALTER TABLE public.subscription_payments
  ADD CONSTRAINT subscription_payments_amount_due_cents_check CHECK (amount_due_cents >= 0),
  ADD CONSTRAINT subscription_payments_amount_paid_cents_check CHECK (amount_paid_cents >= 0),
  ADD CONSTRAINT subscription_payments_discount_cents_check CHECK (discount_amount_cents >= 0),
  ADD CONSTRAINT subscription_payments_audit_immutable_check CHECK (audit_immutable = true);

-- 5. RLS: reaproveitar a matriz central de permissões -------------------------
-- Policies de leitura da Fase 06 continuam válidas para loja/plataforma.
-- Ações administrativas novas são restritas às permissões platform.* já
-- definidas por private.has_permission.

CREATE POLICY plans_platform_manage_phase22
ON public.plans
FOR ALL TO authenticated
USING (private.has_permission('platform.plans.manage', NULL))
WITH CHECK (private.has_permission('platform.plans.manage', NULL));

CREATE POLICY subscriptions_platform_payment_update_phase22
ON public.store_subscriptions
FOR UPDATE TO authenticated
USING (private.has_permission('platform.billing.register_payment', NULL))
WITH CHECK (private.has_permission('platform.billing.register_payment', NULL));

CREATE POLICY subscription_payments_platform_insert_phase22
ON public.subscription_payments
FOR INSERT TO authenticated
WITH CHECK (private.has_permission('platform.billing.register_payment', NULL));

-- 6. Imutabilidade do ledger de pagamentos ----------------------------------
CREATE OR REPLACE FUNCTION private.prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public','pg_temp'
AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries are immutable and cannot be modified or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS tr_prevent_payment_update ON public.subscription_payments;
DROP TRIGGER IF EXISTS tr_prevent_payment_delete ON public.subscription_payments;
CREATE TRIGGER tr_prevent_payment_update
BEFORE UPDATE ON public.subscription_payments
FOR EACH ROW EXECUTE FUNCTION private.prevent_mutation();
CREATE TRIGGER tr_prevent_payment_delete
BEFORE DELETE ON public.subscription_payments
FOR EACH ROW EXECUTE FUNCTION private.prevent_mutation();

-- 7. Núcleo privado do billing ------------------------------------------------
CREATE OR REPLACE FUNCTION private.list_platform_subscriptions(
  _search text DEFAULT NULL,
  _status text DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
) RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE
  _total integer;
  _items json;
BEGIN
  IF NOT private.has_permission('platform.billing.view', NULL) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;
  IF _limit < 1 OR _limit > 200 OR _offset < 0 THEN
    RAISE EXCEPTION 'INVALID_PAGINATION' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO _total
    FROM public.store_subscriptions sub
    JOIN public.stores s ON s.id = sub.store_id
   WHERE (_search IS NULL OR s.name ILIKE '%' || _search || '%' OR s.slug ILIKE '%' || _search || '%')
     AND (_status IS NULL OR sub.status::text = _status);

  SELECT coalesce(json_agg(t), '[]'::json) INTO _items
    FROM (
      SELECT
        sub.id,
        sub.store_id,
        s.name AS store_name,
        s.slug AS store_slug,
        p.name AS plan_name,
        p.monthly_amount_cents,
        p.currency,
        sub.status,
        sub.current_period_end,
        sub.next_billing_date,
        sub.version
      FROM public.store_subscriptions sub
      JOIN public.stores s ON s.id = sub.store_id
      JOIN public.plans p ON p.id = sub.plan_id
      WHERE (_search IS NULL OR s.name ILIKE '%' || _search || '%' OR s.slug ILIKE '%' || _search || '%')
        AND (_status IS NULL OR sub.status::text = _status)
      ORDER BY sub.created_at DESC
      LIMIT _limit OFFSET _offset
    ) t;

  RETURN json_build_object('items', _items, 'total', _total);
END;
$$;

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
    0,
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

REVOKE ALL ON FUNCTION private.list_platform_subscriptions(text,text,integer,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.register_manual_payment(uuid,integer,integer,public.payment_method,text) FROM PUBLIC;

-- 8. Wrappers públicos usados por supabase.rpc -------------------------------
CREATE OR REPLACE FUNCTION public.list_platform_subscriptions(
  _search text DEFAULT NULL,
  _status text DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
) RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
  SELECT private.list_platform_subscriptions(_search, _status, _limit, _offset)
$$;

CREATE OR REPLACE FUNCTION public.register_manual_payment(
  _subscription_id uuid,
  _amount_paid_cents integer,
  _discount_amount_cents integer DEFAULT 0,
  _payment_method public.payment_method DEFAULT 'manual_transfer',
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
  SELECT private.register_manual_payment(
    _subscription_id,
    _amount_paid_cents,
    _discount_amount_cents,
    _payment_method,
    _notes
  )
$$;

REVOKE ALL ON FUNCTION public.list_platform_subscriptions(text,text,integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_manual_payment(uuid,integer,integer,public.payment_method,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_platform_subscriptions(text,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_manual_payment(uuid,integer,integer,public.payment_method,text) TO authenticated;
