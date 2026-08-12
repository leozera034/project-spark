-- SHARK — atomicidade do checkout público.
--
-- A implementação legada de storefront_submit_order valida/recalcula corretamente os preços,
-- porém cria customer/order antes de algumas validações finais. Em PL/pgSQL, RETURN ok:false
-- não desfaz INSERTs anteriores. Este adaptador executa a implementação existente dentro de
-- uma subtransação e força rollback quando ela retorna falha, preservando exatamente o payload
-- público de erro para o frontend.

DO $$
BEGIN
  IF to_regprocedure('private.storefront_submit_order(text,jsonb)') IS NULL THEN
    ALTER FUNCTION public.storefront_submit_order(text,jsonb) SET SCHEMA private;
  END IF;
END $$;

REVOKE ALL ON FUNCTION private.storefront_submit_order(text,jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.storefront_submit_order(text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.storefront_submit_order(_slug text, _payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_detail text;
BEGIN
  BEGIN
    v_result := private.storefront_submit_order(_slug, _payload);

    IF NOT coalesce((v_result->>'ok')::boolean, false) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'SHARK_CHECKOUT_ROLLBACK',
        DETAIL = v_result::text;
    END IF;

    RETURN v_result;
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'SHARK_CHECKOUT_ROLLBACK' THEN
        RAISE;
      END IF;
      GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
      RETURN v_detail::jsonb;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.storefront_submit_order(text,jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storefront_submit_order(text,jsonb) TO service_role;

COMMENT ON FUNCTION public.storefront_submit_order(text,jsonb) IS
  'Atomic public checkout wrapper. Any ok:false result from the legacy implementation is rolled back before being returned.';
