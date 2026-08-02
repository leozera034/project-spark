CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_store_role_unique
  ON public.user_roles (user_id, store_id, role) WHERE store_id IS NOT NULL;