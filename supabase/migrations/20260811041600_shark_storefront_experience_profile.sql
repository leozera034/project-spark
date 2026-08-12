-- SHARK — perfil público server-only para experiência adaptativa do cardápio.
-- Não expõe configuração administrativa sensível; somente defaults de experiência.

CREATE OR REPLACE FUNCTION public.storefront_experience_profile(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text := public.storefront_normalize_slug(_slug);
  v_store uuid;
  v_profile_id uuid;
  v_code text;
  v_name text;
  v_icon text;
  v_capabilities jsonb;
BEGIN
  IF v_slug IS NULL THEN RETURN NULL; END IF;

  SELECT st.id, cp.id, cp.code, cp.name, cp.icon, cp.default_capabilities
    INTO v_store, v_profile_id, v_code, v_name, v_icon, v_capabilities
    FROM public.stores st
    LEFT JOIN public.category_profiles cp
      ON cp.id = st.category_profile_id
     AND cp.is_active
   WHERE st.slug = v_slug
     AND st.status = 'ativa'
   LIMIT 1;

  IF v_store IS NULL THEN RETURN NULL; END IF;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object(
      'code', null,
      'name', null,
      'icon', null,
      'default_capabilities', '{}'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'code', v_code,
    'name', v_name,
    'icon', v_icon,
    'default_capabilities', coalesce(v_capabilities, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.storefront_experience_profile(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storefront_experience_profile(text) TO service_role;

COMMENT ON FUNCTION public.storefront_experience_profile(text) IS
  'Server-only storefront category defaults used to derive adaptive UX from capabilities rather than category conditionals.';
