-- Keep paid WhatsApp add-on lifecycle RPCs callable by signed-in store users,
-- while explicitly preventing anonymous REST/RPC execution.

revoke execute on function public.request_whatsapp_addon(uuid) from public, anon;
revoke execute on function public.get_whatsapp_addon_provisioning(uuid) from public, anon;

grant execute on function public.request_whatsapp_addon(uuid) to authenticated, service_role;
grant execute on function public.get_whatsapp_addon_provisioning(uuid) to authenticated, service_role;
