-- Public slug availability is exposed through the allowlisted pediu-backend-api
-- Edge Function. Direct PostgREST execution is not required and would bypass
-- the Edge gateway boundary.
revoke execute on function public.check_public_store_slug(text) from public;
revoke execute on function public.check_public_store_slug(text) from anon;
revoke execute on function public.check_public_store_slug(text) from authenticated;
grant execute on function public.check_public_store_slug(text) to service_role;

comment on function public.check_public_store_slug(text)
is 'Slug availability helper. Direct API execution is service-role-only; public callers must use the allowlisted Edge gateway.';
