-- SHARK — projeção mínima server-only da estrutura de sabores por variação.
-- Evita ampliar contratos legados além do necessário.

create or replace function public.storefront_variant_flavor_structure(_slug text,_product_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  _normalized_slug text:=public.storefront_normalize_slug(_slug);
  _store_id uuid;
begin
  if _normalized_slug is null or _product_id is null then return '[]'::jsonb; end if;
  select id into _store_id from public.stores
   where slug=_normalized_slug and status='ativa' limit 1;
  if _store_id is null then return '[]'::jsonb; end if;
  if not exists(select 1 from public.products p where p.id=_product_id and p.store_id=_store_id and p.is_available and not p.is_archived) then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',v.id,
      'max_flavors',v.max_flavors,
      'flavor_parts',v.flavor_parts
    ) order by v.sort_order,v.name)
    from public.product_variants v
    where v.store_id=_store_id and v.product_id=_product_id
      and v.is_available and not v.is_archived
  ),'[]'::jsonb);
end;
$$;

revoke all on function public.storefront_variant_flavor_structure(text,uuid) from public,anon,authenticated;
grant execute on function public.storefront_variant_flavor_structure(text,uuid) to service_role;
