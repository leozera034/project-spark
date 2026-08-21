-- Preserve existing RLS semantics while allowing PostgreSQL to initialize the
-- authenticated user id once per statement instead of recalculating it per row.

alter policy reasons_read_authenticated on public.order_transition_reasons
  using (((select auth.uid()) is not null) and is_active);

alter policy user_profiles_select_self on public.user_profiles
  using ((id = (select auth.uid())) or private.is_platform_admin());

alter policy user_profiles_update_self on public.user_profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy user_roles_select_self on public.user_roles
  using ((user_id = (select auth.uid())) or private.is_store_manager(store_id) or private.is_platform_admin());
