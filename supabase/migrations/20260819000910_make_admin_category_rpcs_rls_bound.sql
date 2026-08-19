-- Remove unnecessary owner-rights execution from category-profile admin RPCs.
-- Authorization for reads/writes is delegated to the existing RLS policies on
-- public.category_profiles. This avoids exposing the private schema just so an
-- invoker function can call private.is_platform_admin().

CREATE OR REPLACE FUNCTION public.admin_list_category_profiles()
RETURNS SETOF public.category_profiles
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT *
  FROM public.category_profiles
  ORDER BY sort_order, name;
$function$;

CREATE OR REPLACE FUNCTION public.admin_save_category_profile(
  _id uuid,
  _code text,
  _name text,
  _description text,
  _icon text,
  _capabilities jsonb,
  _templates jsonb,
  _active boolean,
  _sort_order integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  out_id uuid;
BEGIN
  IF _code !~ '^[a-z0-9_]{2,50}$' OR length(trim(_name)) < 2 THEN
    RAISE EXCEPTION 'INVALID_CATEGORY_PROFILE';
  END IF;

  IF jsonb_typeof(coalesce(_capabilities, '{}')) <> 'object'
     OR jsonb_typeof(coalesce(_templates, '[]')) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_CATEGORY_PROFILE_CONFIG';
  END IF;

  IF _id IS NULL THEN
    INSERT INTO public.category_profiles(
      code,
      name,
      description,
      icon,
      default_capabilities,
      product_templates,
      is_active,
      sort_order
    )
    VALUES (
      _code,
      trim(_name),
      nullif(trim(coalesce(_description, '')), ''),
      nullif(trim(coalesce(_icon, '')), ''),
      coalesce(_capabilities, '{}'),
      coalesce(_templates, '[]'),
      coalesce(_active, true),
      coalesce(_sort_order, 0)
    )
    RETURNING id INTO out_id;
  ELSE
    UPDATE public.category_profiles
       SET code = _code,
           name = trim(_name),
           description = nullif(trim(coalesce(_description, '')), ''),
           icon = nullif(trim(coalesce(_icon, '')), ''),
           default_capabilities = coalesce(_capabilities, '{}'),
           product_templates = coalesce(_templates, '[]'),
           is_active = coalesce(_active, true),
           sort_order = coalesce(_sort_order, 0),
           updated_at = now()
     WHERE id = _id
     RETURNING id INTO out_id;

    IF out_id IS NULL THEN
      RAISE EXCEPTION 'CATEGORY_PROFILE_NOT_FOUND';
    END IF;
  END IF;

  RETURN out_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_list_category_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_category_profiles() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_save_category_profile(uuid,text,text,text,text,jsonb,jsonb,boolean,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_category_profile(uuid,text,text,text,text,jsonb,jsonb,boolean,integer) TO authenticated, service_role;
