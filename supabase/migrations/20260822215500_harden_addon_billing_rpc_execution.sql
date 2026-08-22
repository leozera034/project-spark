-- Restrict add-on billing mutation RPCs to trusted backend callers only.
-- The browser-facing Stripe Edge Function authenticates the JWT and passes the verified user id.

revoke execute on function public.billing_begin_addon_checkout(uuid,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.billing_begin_addon_checkout(uuid,uuid,text,text,text,text) to service_role;

revoke execute on function public.billing_complete_addon_checkout_provider_create(uuid,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.billing_complete_addon_checkout_provider_create(uuid,uuid,text,text,text,text) to service_role;

revoke execute on function public.billing_complete_addon_checkout_session_create(uuid,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.billing_complete_addon_checkout_session_create(uuid,uuid,text,text,text,text) to service_role;
