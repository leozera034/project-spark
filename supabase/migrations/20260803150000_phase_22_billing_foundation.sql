-- Migration: Phase 22 - Plans, Subscriptions and Payments Foundation
-- Implementation of global plans, store subscriptions and manual payments with immutable audit logs.

-- 1. ENUMS
CREATE TYPE public.plan_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE public.subscription_status AS ENUM ('active', 'past_due', 'suspended_payment', 'trialing', 'canceled');
CREATE TYPE public.payment_method AS ENUM ('manual_transfer', 'pix_manual', 'cash', 'other');
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- 2. TABLES

-- Global Plans
CREATE TABLE public.plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    name text NOT NULL,
    description text,
    monthly_amount_cents integer NOT NULL CHECK (monthly_amount_cents >= 0),
    currency text NOT NULL DEFAULT 'BRL',
    grace_days integer NOT NULL DEFAULT 3 CHECK (grace_days >= 0),
    reminder_days_before integer NOT NULL DEFAULT 5 CHECK (reminder_days_before >= 0),
    status public.plan_status NOT NULL DEFAULT 'draft',
    is_archived boolean NOT NULL DEFAULT false,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    updated_by uuid REFERENCES auth.users(id)
);

-- Store Subscriptions
CREATE TABLE public.store_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id),
    plan_id uuid NOT NULL REFERENCES public.plans(id),
    status public.subscription_status NOT NULL DEFAULT 'trialing',
    current_period_start timestamptz NOT NULL DEFAULT now(),
    current_period_end timestamptz NOT NULL,
    trial_end timestamptz,
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    canceled_at timestamptz,
    suspended_at timestamptz,
    next_billing_date timestamptz NOT NULL,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(store_id)
);

-- Subscription Payments (Immutable Audit Log Pattern)
CREATE TABLE public.subscription_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id),
    subscription_id uuid NOT NULL REFERENCES public.store_subscriptions(id),
    amount_due_cents integer NOT NULL CHECK (amount_due_cents >= 0),
    amount_paid_cents integer NOT NULL DEFAULT 0 CHECK (amount_paid_cents >= 0),
    discount_amount_cents integer NOT NULL DEFAULT 0 CHECK (discount_amount_cents >= 0),
    currency text NOT NULL DEFAULT 'BRL',
    due_date date NOT NULL,
    paid_at timestamptz,
    status public.payment_status NOT NULL DEFAULT 'pending',
    payment_method public.payment_method,
    notes text,
    audit_immutable boolean NOT NULL DEFAULT true CHECK (audit_immutable = true),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- 3. SECURITY & RLS

-- Plans (Read: Auth, Write: Admin)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;

CREATE POLICY "Admin can manage plans"
ON public.plans
FOR ALL
TO authenticated
USING (private.has_platform_permission('manage_plans'));

-- Store Subscriptions (Read: Store Staff, Write: Admin)
ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.store_subscriptions TO authenticated;
GRANT ALL ON public.store_subscriptions TO service_role;

CREATE POLICY "Users can view their own store subscription"
ON public.store_subscriptions
FOR SELECT
TO authenticated
USING (private.current_store_id() = store_id);

CREATE POLICY "Admin can manage subscriptions"
ON public.store_subscriptions
FOR ALL
TO authenticated
USING (private.has_platform_permission('manage_subscriptions'));

-- Subscription Payments (Read: Store Staff, Write: Admin, Delete/Update: BLOCKED)
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;

-- NO UPDATE/DELETE POLICIES = DENIED BY DEFAULT
CREATE POLICY "Users can view their own store payments"
ON public.subscription_payments
FOR SELECT
TO authenticated
USING (private.current_store_id() = store_id);

CREATE POLICY "Admin can insert payments"
ON public.subscription_payments
FOR INSERT
TO authenticated
WITH CHECK (private.has_platform_permission('manage_payments'));

CREATE POLICY "Admin can view all payments"
ON public.subscription_payments
FOR SELECT
TO authenticated
USING (private.has_platform_permission('manage_payments'));

-- 4. IMMUTABILITY TRIGGERS
CREATE OR REPLACE FUNCTION private.prevent_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries are immutable and cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_prevent_payment_update
BEFORE UPDATE ON public.subscription_payments
FOR EACH ROW EXECUTE FUNCTION private.prevent_mutation();

CREATE TRIGGER tr_prevent_payment_delete
BEFORE DELETE ON public.subscription_payments
FOR EACH ROW EXECUTE FUNCTION private.prevent_mutation();

-- 5. RPCs

-- List subscriptions for platform admin
CREATE OR REPLACE FUNCTION private.list_platform_subscriptions(_search text DEFAULT NULL, _status text DEFAULT NULL, _limit int DEFAULT 50, _offset int DEFAULT 0)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _total int;
    _items json;
BEGIN
    IF NOT private.has_platform_permission('manage_subscriptions') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT count(*) INTO _total
    FROM public.store_subscriptions sub
    JOIN public.stores s ON s.id = sub.store_id
    WHERE (_search IS NULL OR s.name ILIKE '%' || _search || '%' OR s.slug ILIKE '%' || _search || '%')
      AND (_status IS NULL OR sub.status::text = _status);

    SELECT json_agg(t) INTO _items
    FROM (
        SELECT 
            sub.id,
            sub.store_id,
            s.name as store_name,
            s.slug as store_slug,
            p.name as plan_name,
            sub.status,
            sub.current_period_end,
            sub.next_billing_date
        FROM public.store_subscriptions sub
        JOIN public.stores s ON s.id = sub.store_id
        JOIN public.plans p ON p.id = sub.plan_id
        WHERE (_search IS NULL OR s.name ILIKE '%' || _search || '%' OR s.slug ILIKE '%' || _search || '%')
          AND (_status IS NULL OR sub.status::text = _status)
        ORDER BY sub.created_at DESC
        LIMIT _limit
        OFFSET _offset
    ) t;

    RETURN json_build_object('items', COALESCE(_items, '[]'::json), 'total', _total);
END;
$$;

-- Register manual payment
CREATE OR REPLACE FUNCTION private.register_manual_payment(
    _subscription_id uuid,
    _amount_paid_cents integer,
    _discount_amount_cents integer DEFAULT 0,
    _payment_method public.payment_method DEFAULT 'manual_transfer',
    _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _sub public.store_subscriptions;
    _payment_id uuid;
BEGIN
    IF NOT private.has_platform_permission('manage_payments') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT * INTO _sub FROM public.store_subscriptions WHERE id = _subscription_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subscription not found';
    END IF;

    -- Insert immutable payment record
    INSERT INTO public.subscription_payments (
        store_id,
        subscription_id,
        amount_due_cents,
        amount_paid_cents,
        discount_amount_cents,
        due_date,
        paid_at,
        status,
        payment_method,
        notes,
        created_by
    ) VALUES (
        _sub.store_id,
        _sub.id,
        0, -- Manual registration for credit
        _amount_paid_cents,
        _discount_amount_cents,
        CURRENT_DATE,
        now(),
        'completed',
        _payment_method,
        _notes,
        auth.uid()
    ) RETURNING id INTO _payment_id;

    -- Update subscription period
    UPDATE public.store_subscriptions
    SET 
        status = 'active',
        current_period_start = now(),
        current_period_end = now() + interval '1 month',
        next_billing_date = now() + interval '1 month',
        updated_at = now(),
        version = version + 1
    WHERE id = _subscription_id;

    -- Log audit
    INSERT INTO private.platform_audit_log (action, details, created_by)
    VALUES (
        'manual_payment_registered',
        jsonb_build_object(
            'subscription_id', _subscription_id,
            'payment_id', _payment_id,
            'amount', _amount_paid_cents
        ),
        auth.uid()
    );

    RETURN _payment_id;
END;
$$;

-- Add permissions to enum (needs to be done in a separate block if enum exists)
DO $$
BEGIN
    ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'manage_plans';
    ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'manage_subscriptions';
    ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'manage_payments';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
