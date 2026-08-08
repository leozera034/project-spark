-- Harden allowed-actions helpers against a PostgreSQL 17.6 backend crash.
--
-- The audit reproduced a SIGSEGV only when a SECURITY DEFINER allowed-actions
-- helper nested calls to private.has_permission(...). The same permission calls
-- execute successfully when invoked directly. These outer helpers do not need
-- elevated privileges: they only assemble action names while has_permission is
-- already the single SECURITY DEFINER authorization boundary and derives the
-- actor exclusively from auth.uid().
--
-- Business rules, output ordering and existing function privileges are
-- intentionally unchanged. CREATE OR REPLACE preserves the existing grants /
-- revokes; only execution context and implementation shape change.

CREATE OR REPLACE FUNCTION private.order_allowed_actions(
  _status public.order_status,
  _fulfillment public.fulfillment_type,
  _store_id uuid
) RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _actions text[] := '{}'::text[];
BEGIN
  IF _status = 'aguardando_confirmacao' THEN
    IF private.has_permission('orders.accept', _store_id) THEN
      _actions := array_append(_actions, 'accept');
    END IF;
  END IF;

  IF _status = 'aceito' THEN
    IF private.has_permission('orders.start_preparation', _store_id) THEN
      _actions := array_append(_actions, 'start_preparation');
    END IF;
  END IF;

  IF _status = 'em_preparo' THEN
    IF private.has_permission('orders.mark_ready', _store_id) THEN
      _actions := array_append(_actions, 'mark_ready');
    END IF;
  END IF;

  IF _status = 'aguardando_retirada' AND _fulfillment = 'retirada' THEN
    IF private.has_permission('orders.complete_pickup', _store_id) THEN
      _actions := array_append(_actions, 'complete_pickup');
    END IF;
  END IF;

  IF _status = 'aguardando_confirmacao' THEN
    IF private.has_permission('orders.reject', _store_id) THEN
      _actions := array_append(_actions, 'reject');
    END IF;
  END IF;

  IF _status IN (
    'aguardando_confirmacao',
    'aceito',
    'em_preparo',
    'pronto',
    'aguardando_retirada',
    'aguardando_entregador'
  ) THEN
    IF private.has_permission('orders.cancel', _store_id) THEN
      _actions := array_append(_actions, 'cancel');
    END IF;
  END IF;

  RETURN _actions;
END;
$function$;

CREATE OR REPLACE FUNCTION private.kitchen_allowed_actions(
  _status public.order_status,
  _store_id uuid
) RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _actions text[] := '{}'::text[];
BEGIN
  IF _status = 'aceito' THEN
    IF private.has_permission('kitchen.start_preparation', _store_id)
       AND private.has_permission('orders.start_preparation', _store_id) THEN
      _actions := array_append(_actions, 'start_preparation');
    END IF;
  END IF;

  IF _status = 'em_preparo' THEN
    IF private.has_permission('kitchen.mark_ready', _store_id)
       AND private.has_permission('orders.mark_ready', _store_id) THEN
      _actions := array_append(_actions, 'mark_ready');
    END IF;
  END IF;

  RETURN _actions;
END;
$function$;

CREATE OR REPLACE FUNCTION private.courier_allowed_actions(
  _store_id uuid,
  _status public.courier_status
) RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _actions text[] := '{}'::text[];
BEGIN
  IF private.has_permission('couriers.update', _store_id) THEN
    _actions := array_append(_actions, 'update');

    IF _status = 'ativo' THEN
      _actions := array_append(_actions, 'deactivate');
    END IF;

    IF _status = 'inativo' THEN
      _actions := array_append(_actions, 'activate');
    END IF;
  END IF;

  IF private.has_permission('couriers.reset_access', _store_id) THEN
    _actions := array_append(_actions, 'reset_access');
  END IF;

  RETURN _actions;
END;
$function$;
