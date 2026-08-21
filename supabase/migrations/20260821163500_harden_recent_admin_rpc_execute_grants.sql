-- Recent SECURITY DEFINER admin RPCs were created with PostgreSQL's default
-- EXECUTE privilege still inherited by PUBLIC. Their bodies do enforce admin
-- authorization, but anonymous callers should not reach the functions at all.

revoke execute on function public.admin_list_other_profile_demand() from public, anon;
revoke execute on function public.admin_list_professional_service_orders(text) from public, anon;
revoke execute on function public.admin_list_professional_services() from public, anon;
revoke execute on function public.admin_update_professional_service(uuid,integer,boolean) from public, anon;
revoke execute on function public.admin_update_professional_service_order_status(uuid,text) from public, anon;

grant execute on function public.admin_list_other_profile_demand() to authenticated, service_role;
grant execute on function public.admin_list_professional_service_orders(text) to authenticated, service_role;
grant execute on function public.admin_list_professional_services() to authenticated, service_role;
grant execute on function public.admin_update_professional_service(uuid,integer,boolean) to authenticated, service_role;
grant execute on function public.admin_update_professional_service_order_status(uuid,text) to authenticated, service_role;
