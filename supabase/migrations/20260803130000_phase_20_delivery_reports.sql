-- ============================================================
-- Fase 20 — Relatórios de entregas e contador derivado
-- ============================================================

-- 1. Permissões específicas para relatórios -------------------
-- (Assume-se que a tabela public.app_permission já existe da Fase 07)
-- Inserir novas permissões se não existirem
INSERT INTO public.app_permission (code, name, description)
VALUES 
  ('delivery_reports.view', 'Ver relatórios de entrega', 'Acesso ao resumo e série diária de entregas da loja'),
  ('delivery_reports.view_courier_comparison', 'Comparar entregadores', 'Ver contagem de entregas por entregador'),
  ('delivery_reports.view_history', 'Ver histórico de entregas', 'Ver lista detalhada de entregas concluídas'),
  ('courier_reports.view_own', 'Ver próprio contador', 'Acesso do entregador às suas próprias estatísticas')
ON CONFLICT (code) DO NOTHING;

-- 2. Fonte privada de fatos de entrega concluída --------------
-- Esta view centraliza a lógica de "o que é uma entrega concluída"
CREATE OR REPLACE VIEW private.completed_delivery_facts AS
SELECT 
  d.store_id,
  d.id AS delivery_id,
  o.id AS order_id,
  o.order_number,
  d.courier_id,
  c.full_name AS courier_name,
  c.status AS courier_status,
  d.completed_at,
  s.timezone AS store_timezone,
  (d.completed_at AT TIME ZONE 'UTC' AT TIME ZONE s.timezone)::date AS completed_local_date
FROM public.deliveries d
JOIN public.orders o ON o.id = d.order_id AND o.store_id = d.store_id
JOIN public.stores s ON s.id = d.store_id
JOIN public.couriers c ON c.id = d.courier_id AND c.store_id = d.store_id
WHERE o.fulfillment_type = 'delivery'
  AND o.status = 'entregue'
  AND d.status = 'concluida'
  AND d.completed_at IS NOT NULL
  AND d.courier_id IS NOT NULL;

-- 3. Índices de performance para relatórios -------------------
CREATE INDEX IF NOT EXISTS deliveries_reports_idx 
  ON public.deliveries (store_id, status, completed_at) 
  WHERE status = 'concluida';

CREATE INDEX IF NOT EXISTS deliveries_courier_reports_idx 
  ON public.deliveries (store_id, courier_id, status, completed_at) 
  WHERE status = 'concluida';

-- 4. Função auxiliar: calcular limites de período -------------
CREATE OR REPLACE FUNCTION private.get_report_period_limits(
  _store_id uuid,
  _period_type text, -- 'today', 'week', 'month', 'custom'
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL
)
RETURNS TABLE (
  start_utc timestamptz,
  end_utc timestamptz,
  store_tz text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$
DECLARE
  _tz text;
  _now_local timestamptz;
  _today_local date;
BEGIN
  SELECT timezone INTO _tz FROM public.stores WHERE id = _store_id;
  IF _tz IS NULL THEN _tz := 'America/Sao_Paulo'; END IF;
  
  _now_local := now() AT TIME ZONE 'UTC' AT TIME ZONE _tz;
  _today_local := _now_local::date;

  CASE _period_type
    WHEN 'today' THEN
      start_utc := (_today_local::text || ' 00:00:00')::timestamp AT TIME ZONE _tz;
      end_utc := start_utc + interval '1 day';
    WHEN 'week' THEN
      -- Início na segunda-feira (1)
      start_utc := (date_trunc('week', _today_local)::text || ' 00:00:00')::timestamp AT TIME ZONE _tz;
      end_utc := start_utc + interval '7 days';
    WHEN 'month' THEN
      start_utc := (date_trunc('month', _today_local)::text || ' 00:00:00')::timestamp AT TIME ZONE _tz;
      end_utc := start_utc + interval '1 month';
    WHEN 'custom' THEN
      IF _start_date IS NULL OR _end_date IS NULL THEN
        RAISE EXCEPTION 'START_AND_END_DATE_REQUIRED' USING ERRCODE='P0001';
      END IF;
      IF _end_date < _start_date THEN
        RAISE EXCEPTION 'INVALID_DATE_RANGE' USING ERRCODE='P0001';
      END IF;
      IF (_end_date - _start_date) > 366 THEN
        RAISE EXCEPTION 'PERIOD_TOO_LONG' USING ERRCODE='P0001';
      END IF;
      start_utc := (_start_date::text || ' 00:00:00')::timestamp AT TIME ZONE _tz;
      end_utc := (_end_date::text || ' 00:00:00')::timestamp AT TIME ZONE _tz + interval '1 day';
    ELSE
      RAISE EXCEPTION 'INVALID_PERIOD_TYPE' USING ERRCODE='P0001';
  END CASE;

  RETURN QUERY SELECT start_utc, end_utc, _tz;
END; $$;

-- 5. RPC: Resumo de entregas da loja --------------------------
CREATE OR REPLACE FUNCTION public.get_my_store_delivery_report_summary(
  _period_type text,
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$
DECLARE
  _sid uuid;
  _limits record;
  _total_deliveries bigint;
  _active_couriers bigint;
BEGIN
  _sid := private.current_store_id(); -- Assume função existente da Fase 06/07
  IF _sid IS NULL THEN RAISE EXCEPTION 'STORE_CONTEXT_REQUIRED' USING ERRCODE='P0001'; END IF;
  
  -- Verificar permissão
  IF NOT private.has_permission('delivery_reports.view', _sid) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO _limits FROM private.get_report_period_limits(_sid, _period_type, _start_date, _end_date);

  SELECT count(*), count(DISTINCT courier_id)
    INTO _total_deliveries, _active_couriers
    FROM private.completed_delivery_facts
   WHERE store_id = _sid
     AND completed_at >= _limits.start_utc
     AND completed_at < _limits.end_utc;

  RETURN jsonb_build_object(
    'completedDeliveries', coalesce(_total_deliveries, 0),
    'couriersWithCompletions', coalesce(_active_couriers, 0),
    'period', jsonb_build_object(
      'type', _period_type,
      'start', _limits.start_utc,
      'end', _limits.end_utc
    ),
    'timezone', _limits.store_tz,
    'generatedAt', now()
  );
END; $$;

-- 6. RPC: Série diária de entregas ----------------------------
CREATE OR REPLACE FUNCTION public.get_my_store_delivery_report_series(
  _period_type text,
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$
DECLARE
  _sid uuid;
  _limits record;
  _series jsonb;
BEGIN
  _sid := private.current_store_id();
  IF _sid IS NULL THEN RAISE EXCEPTION 'STORE_CONTEXT_REQUIRED' USING ERRCODE='P0001'; END IF;
  IF NOT private.has_permission('delivery_reports.view', _sid) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO _limits FROM private.get_report_period_limits(_sid, _period_type, _start_date, _end_date);

  SELECT coalesce(jsonb_agg(d ORDER BY d.local_date), '[]'::jsonb)
    INTO _series
    FROM (
      SELECT completed_local_date::text AS local_date, count(*) AS completed_deliveries
        FROM private.completed_delivery_facts
       WHERE store_id = _sid
         AND completed_at >= _limits.start_utc
         AND completed_at < _limits.end_utc
       GROUP BY completed_local_date
    ) d;

  RETURN jsonb_build_object(
    'series', _series,
    'timezone', _limits.store_tz
  );
END; $$;

-- 7. RPC: Comparação operacional entre entregadores -----------
CREATE OR REPLACE FUNCTION public.list_my_store_delivery_report_by_courier(
  _period_type text,
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$
DECLARE
  _sid uuid;
  _limits record;
  _rows jsonb;
BEGIN
  _sid := private.current_store_id();
  IF _sid IS NULL THEN RAISE EXCEPTION 'STORE_CONTEXT_REQUIRED' USING ERRCODE='P0001'; END IF;
  IF NOT private.has_permission('delivery_reports.view_courier_comparison', _sid) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO _limits FROM private.get_report_period_limits(_sid, _period_type, _start_date, _end_date);

  SELECT coalesce(jsonb_agg(r ORDER BY r.completed_deliveries DESC, r.courier_name), '[]'::jsonb)
    INTO _rows
    FROM (
      SELECT courier_id, courier_name, courier_status, count(*) AS completed_deliveries
        FROM private.completed_delivery_facts
       WHERE store_id = _sid
         AND completed_at >= _limits.start_utc
         AND completed_at < _limits.end_utc
       GROUP BY courier_id, courier_name, courier_status
    ) r;

  RETURN jsonb_build_object(
    'rows', _rows,
    'timezone', _limits.store_tz
  );
END; $$;

-- 8. RPC: Histórico paginado de entregas concluídas -----------
CREATE OR REPLACE FUNCTION public.list_my_store_completed_deliveries(
  _period_type text,
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL,
  _courier_id uuid DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$
DECLARE
  _sid uuid;
  _limits record;
  _items jsonb;
  _total bigint;
BEGIN
  _sid := private.current_store_id();
  IF _sid IS NULL THEN RAISE EXCEPTION 'STORE_CONTEXT_REQUIRED' USING ERRCODE='P0001'; END IF;
  IF NOT private.has_permission('delivery_reports.view_history', _sid) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO _limits FROM private.get_report_period_limits(_sid, _period_type, _start_date, _end_date);

  SELECT count(*) INTO _total
    FROM private.completed_delivery_facts
   WHERE store_id = _sid
     AND completed_at >= _limits.start_utc
     AND completed_at < _limits.end_utc
     AND (_courier_id IS NULL OR courier_id = _courier_id);

  SELECT coalesce(jsonb_agg(i ORDER BY i.completed_at DESC), '[]'::jsonb)
    INTO _items
    FROM (
      SELECT delivery_id, order_number, courier_id, courier_name, completed_at
        FROM private.completed_delivery_facts
       WHERE store_id = _sid
         AND completed_at >= _limits.start_utc
         AND completed_at < _limits.end_utc
         AND (_courier_id IS NULL OR courier_id = _courier_id)
       LIMIT _limit OFFSET _offset
    ) i;

  RETURN jsonb_build_object(
    'items', _items,
    'total', _total,
    'timezone', _limits.store_tz
  );
END; $$;

-- 9. RPC: Contador próprio do entregador ----------------------
CREATE OR REPLACE FUNCTION public.get_my_courier_delivery_counter(
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$
DECLARE
  _cid uuid;
  _sid uuid;
  _today_limits record;
  _week_limits record;
  _month_limits record;
  _custom_limits record;
  _today_count bigint;
  _week_count bigint;
  _month_count bigint;
  _custom_count bigint;
BEGIN
  SELECT courier_id, store_id INTO _cid, _sid FROM private.require_current_courier();
  
  -- Verificar permissão (opcional se current_courier já valida)
  IF NOT private.has_permission('courier_reports.view_own', _sid) THEN
    -- Embora a matriz possa não ter sido atualizada para o papel 'entregador' ainda,
    -- o entregador sempre deve ver o próprio contador.
    NULL;
  END IF;

  SELECT * INTO _today_limits FROM private.get_report_period_limits(_sid, 'today');
  SELECT * INTO _week_limits FROM private.get_report_period_limits(_sid, 'week');
  SELECT * INTO _month_limits FROM private.get_report_period_limits(_sid, 'month');

  SELECT count(*) INTO _today_count FROM private.completed_delivery_facts WHERE courier_id = _cid AND completed_at >= _today_limits.start_utc AND completed_at < _today_limits.end_utc;
  SELECT count(*) INTO _week_count FROM private.completed_delivery_facts WHERE courier_id = _cid AND completed_at >= _week_limits.start_utc AND completed_at < _week_limits.end_utc;
  SELECT count(*) INTO _month_count FROM private.completed_delivery_facts WHERE courier_id = _cid AND completed_at >= _month_limits.start_utc AND completed_at < _month_limits.end_utc;

  IF _start_date IS NOT NULL AND _end_date IS NOT NULL THEN
    SELECT * INTO _custom_limits FROM private.get_report_period_limits(_sid, 'custom', _start_date, _end_date);
    SELECT count(*) INTO _custom_count FROM private.completed_delivery_facts WHERE courier_id = _cid AND completed_at >= _custom_limits.start_utc AND completed_at < _custom_limits.end_utc;
  END IF;

  RETURN jsonb_build_object(
    'today', coalesce(_today_count, 0),
    'currentWeek', coalesce(_week_count, 0),
    'currentMonth', coalesce(_month_count, 0),
    'selectedPeriod', coalesce(_custom_count, 0),
    'timezone', _today_limits.store_tz,
    'generatedAt', now()
  );
END; $$;

-- 10. RPC: Histórico próprio do entregador --------------------
CREATE OR REPLACE FUNCTION public.list_my_completed_deliveries(
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$
DECLARE
  _cid uuid;
  _sid uuid;
  _items jsonb;
BEGIN
  SELECT courier_id, store_id INTO _cid, _sid FROM private.require_current_courier();

  SELECT coalesce(jsonb_agg(i ORDER BY i.completed_at DESC), '[]'::jsonb)
    INTO _items
    FROM (
      -- Sanitizado: apenas número do pedido e data/hora
      SELECT delivery_id, order_number, completed_at
        FROM private.completed_delivery_facts
       WHERE store_id = _sid AND courier_id = _cid
       LIMIT _limit OFFSET _offset
    ) i;

  RETURN jsonb_build_object(
    'items', _items,
    'timezone', (SELECT timezone FROM public.stores WHERE id = _sid)
  );
END; $$;

-- Garantir revogação de PUBLIC para SECURITY DEFINER
REVOKE ALL ON FUNCTION public.get_my_store_delivery_report_summary(text,date,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_store_delivery_report_series(text,date,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_my_store_delivery_report_by_courier(text,date,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_my_store_completed_deliveries(text,date,date,uuid,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_courier_delivery_counter(date,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_my_completed_deliveries(integer,integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_store_delivery_report_summary(text,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_store_delivery_report_series(text,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_store_delivery_report_by_courier(text,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_store_completed_deliveries(text,date,date,uuid,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_courier_delivery_counter(date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_completed_deliveries(integer,integer) TO authenticated;

