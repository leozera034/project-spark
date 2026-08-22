-- Preserve read semantics while avoiding duplicate permissive SELECT policies.

-- category_profiles: authenticated readers can see active profiles; platform admins can see all.
drop policy if exists category_profiles_admin_manage on public.category_profiles;
create policy category_profiles_admin_insert on public.category_profiles
  for insert to authenticated
  with check (private.is_platform_admin());
create policy category_profiles_admin_update on public.category_profiles
  for update to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());
create policy category_profiles_admin_delete on public.category_profiles
  for delete to authenticated
  using (private.is_platform_admin());

-- store_automation_rules: all store members may read; only managers may mutate.
drop policy if exists store_automation_rules_manager_write on public.store_automation_rules;
create policy store_automation_rules_manager_insert on public.store_automation_rules
  for insert to authenticated
  with check (private.is_store_manager(store_id));
create policy store_automation_rules_manager_update on public.store_automation_rules
  for update to authenticated
  using (private.is_store_manager(store_id))
  with check (private.is_store_manager(store_id));
create policy store_automation_rules_manager_delete on public.store_automation_rules
  for delete to authenticated
  using (private.is_store_manager(store_id));

-- store_marketing_campaigns: all store members may read; only managers may mutate.
drop policy if exists store_marketing_campaigns_manager_write on public.store_marketing_campaigns;
create policy store_marketing_campaigns_manager_insert on public.store_marketing_campaigns
  for insert to authenticated
  with check (private.is_store_manager(store_id));
create policy store_marketing_campaigns_manager_update on public.store_marketing_campaigns
  for update to authenticated
  using (private.is_store_manager(store_id))
  with check (private.is_store_manager(store_id));
create policy store_marketing_campaigns_manager_delete on public.store_marketing_campaigns
  for delete to authenticated
  using (private.is_store_manager(store_id));
