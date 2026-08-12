-- SHARK — corrige política pública de perfis de categoria.
-- `anon` não possui EXECUTE em private.is_platform_admin(); portanto a leitura pública
-- não deve depender de função administrativa. Perfis ativos continuam públicos,
-- enquanto usuários autenticados preservam a exceção para administração da plataforma.

alter table public.category_profiles enable row level security;

drop policy if exists category_profiles_public_read on public.category_profiles;
drop policy if exists category_profiles_authenticated_read on public.category_profiles;

create policy category_profiles_public_read
on public.category_profiles
for select
to anon
using (is_active);

create policy category_profiles_authenticated_read
on public.category_profiles
for select
to authenticated
using (is_active or private.is_platform_admin());

-- Mantém gestão restrita ao admin da plataforma.
drop policy if exists category_profiles_admin_manage on public.category_profiles;
create policy category_profiles_admin_manage
on public.category_profiles
for all
to authenticated
using (private.is_platform_admin())
with check (private.is_platform_admin());

comment on table public.category_profiles is
  'Perfis SHARK: leitura anônima limitada a ativos; administração exige platform admin.';
