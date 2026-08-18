-- The function reads only active rows from public.category_profiles.
-- That table already grants SELECT to authenticated users and enforces RLS:
-- authenticated users may read active rows (or all rows when platform admin).
-- SECURITY DEFINER is therefore unnecessary privilege elevation.
alter function public.list_active_category_profiles() security invoker;

comment on function public.list_active_category_profiles()
is 'Lists active category profiles under caller privileges and category_profiles RLS.';
