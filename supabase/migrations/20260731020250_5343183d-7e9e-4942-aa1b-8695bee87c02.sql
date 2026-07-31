-- =====================================================================
-- FASE 05 — Autenticação, sessão e recuperação de acesso
-- Nenhuma policy operacional é criada. Baseline de negação preservado.
-- =====================================================================

-- 1. IDENTIDADE DE ACESSO DO ENTREGADOR ------------------------------

CREATE TABLE public.courier_auth_identities (
  id                            uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id                      uuid NOT NULL,
  courier_id                    uuid NOT NULL,
  auth_user_id                  uuid NOT NULL,
  login_identifier              text NOT NULL,
  synthetic_email               text NOT NULL,
  requires_password_change      boolean NOT NULL DEFAULT true,
  is_login_enabled              boolean NOT NULL DEFAULT true,
  temporary_password_issued_at  timestamptz,
  password_changed_at           timestamptz,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courier_auth_identities_pkey PRIMARY KEY (id),
  CONSTRAINT courier_auth_identities_id_store_key UNIQUE (id, store_id),
  CONSTRAINT courier_auth_identities_auth_user_key UNIQUE (auth_user_id),
  CONSTRAINT courier_auth_identities_courier_key UNIQUE (courier_id),
  CONSTRAINT courier_auth_identities_login_key UNIQUE (login_identifier),
  CONSTRAINT courier_auth_identities_email_key UNIQUE (synthetic_email),
  CONSTRAINT courier_auth_identities_courier_fk
    FOREIGN KEY (courier_id, store_id)
    REFERENCES public.couriers (id, store_id) ON DELETE CASCADE,
  CONSTRAINT courier_auth_identities_store_fk
    FOREIGN KEY (store_id) REFERENCES public.stores (id) ON DELETE CASCADE,
  CONSTRAINT courier_auth_identities_user_fk
    FOREIGN KEY (auth_user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT courier_auth_identities_login_format_check
    CHECK (login_identifier ~ '^[a-z0-9][a-z0-9._-]{2,46}[a-z0-9]$'),
  CONSTRAINT courier_auth_identities_email_format_check
    CHECK (synthetic_email ~ '^[0-9a-f]{32}@courier\.pediuaqui\.internal$')
);

COMMENT ON TABLE public.courier_auth_identities IS
  'Identidade de acesso do entregador. PROIBIDO armazenar senha, senha temporaria, hash, salt, token ou papel. Papeis vivem exclusivamente em user_roles.';
COMMENT ON COLUMN public.courier_auth_identities.synthetic_email IS
  'Endereco interno deterministico exigido pelo provedor de auth. Nunca exibido, nunca usado para envio, nunca usado em recuperacao.';

CREATE INDEX courier_auth_identities_store_idx ON public.courier_auth_identities (store_id);

CREATE TRIGGER courier_auth_identities_set_updated_at
  BEFORE UPDATE ON public.courier_auth_identities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

REVOKE ALL ON public.courier_auth_identities FROM anon, authenticated;
GRANT ALL ON public.courier_auth_identities TO service_role;
ALTER TABLE public.courier_auth_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_auth_identities FORCE ROW LEVEL SECURITY;

-- 2. CONTEXTO DE AUTENTICACAO DO PROPRIO USUARIO ----------------------

CREATE OR REPLACE FUNCTION public.get_my_auth_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _profile public.user_profiles%ROWTYPE;
  _roles text[];
  _store_ids uuid[];
  _identity public.courier_auth_identities%ROWTYPE;
  _environment text;
  _default_route text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'sessao_ausente' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO _profile FROM public.user_profiles p WHERE p.id = _uid;

  SELECT coalesce(array_agg(DISTINCT r.role::text), '{}'),
         coalesce(array_agg(DISTINCT r.store_id) FILTER (WHERE r.store_id IS NOT NULL), '{}')
    INTO _roles, _store_ids
  FROM public.user_roles r
  WHERE r.user_id = _uid AND r.is_active;

  SELECT * INTO _identity
  FROM public.courier_auth_identities i
  WHERE i.auth_user_id = _uid;

  IF 'admin_plataforma' = ANY (_roles) THEN
    _environment := 'platform_admin';
    _default_route := '/admin';
  ELSIF _roles && ARRAY['proprietario','gerente','atendente','cozinha'] THEN
    _environment := 'store';
    _default_route := '/app/loja';
  ELSIF 'entregador' = ANY (_roles) AND _identity.id IS NOT NULL THEN
    _environment := 'courier';
    _default_route := CASE
      WHEN _identity.requires_password_change THEN '/trocar-senha-inicial'
      ELSE '/app/entregador'
    END;
  ELSE
    _environment := 'unconfigured';
    _default_route := '/sem-acesso';
  END IF;

  RETURN jsonb_build_object(
    'user_id', _uid,
    'full_name', _profile.full_name,
    'profile_active', coalesce(_profile.is_active, false),
    'roles', to_jsonb(_roles),
    'store_ids', to_jsonb(_store_ids),
    'account_environment', _environment,
    'courier_id', _identity.courier_id,
    'courier_login_enabled', coalesce(_identity.is_login_enabled, false),
    'requires_password_change', coalesce(_identity.requires_password_change, false),
    'default_route', _default_route
  );
END;
$$;

COMMENT ON FUNCTION public.get_my_auth_context() IS
  'Bootstrap de interface. Retorna somente o contexto de auth.uid(). Nao aceita parametro, nao retorna senha, e-mail sintetico, token ou dados de terceiros. Nao substitui RLS nem autorizacao por acao.';

REVOKE ALL ON FUNCTION public.get_my_auth_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_auth_context() TO authenticated;

-- 3. CONCLUSAO DA TROCA INICIAL DE SENHA ------------------------------

CREATE OR REPLACE FUNCTION public.complete_my_initial_password_change()
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _updated int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'sessao_ausente' USING ERRCODE = '28000';
  END IF;

  UPDATE public.courier_auth_identities
     SET requires_password_change = false,
         password_changed_at = now()
   WHERE auth_user_id = _uid
     AND requires_password_change;

  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated = 1;
END;
$$;

COMMENT ON FUNCTION public.complete_my_initial_password_change() IS
  'Marca a troca inicial do proprio entregador como concluida. Nao recebe identificador, nao altera senha e nao afeta outra conta.';

REVOKE ALL ON FUNCTION public.complete_my_initial_password_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_my_initial_password_change() TO authenticated;

-- 4. APOIO SERVIDOR: AUTORIZACAO DA REDEFINICAO DE ENTREGADOR ---------

CREATE OR REPLACE FUNCTION public.authorize_courier_reset(_actor_user_id uuid, _courier_id uuid)
RETURNS TABLE (auth_user_id uuid, store_id uuid, identity_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT i.auth_user_id, i.store_id, i.id
  FROM public.courier_auth_identities i
  JOIN public.couriers c
    ON c.id = i.courier_id AND c.store_id = i.store_id
  WHERE i.courier_id = _courier_id
    AND c.status = 'ativo'
    AND EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = _actor_user_id
        AND r.is_active
        AND r.store_id = i.store_id
        AND r.role IN ('proprietario','gerente')
    )
$$;

COMMENT ON FUNCTION public.authorize_courier_reset(uuid, uuid) IS
  'Uso exclusivo do servidor. Retorna a identidade do entregador somente quando o ator e proprietario ou gerente ativo da mesma loja.';

REVOKE ALL ON FUNCTION public.authorize_courier_reset(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_courier_reset(uuid, uuid) TO service_role;