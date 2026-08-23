drop index if exists public.products_search_aliases_gin;

create or replace function public.search_catalog_product_search_aliases(
  _store_id uuid,
  _search text default null,
  _limit integer default 50,
  _offset integer default 0
)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _q text:=public.normalize_label(coalesce(_search,''));
  _lim integer:=least(greatest(coalesce(_limit,50),1),100);
  _off integer:=greatest(coalesce(_offset,0),0);
  _total integer;
  _items jsonb;
begin
  perform private.require_permission('catalog.view',_sid);

  with base as (
    select p.id,p.name,p.category_id,c.name as category_name,p.search_aliases,p.updated_at,p.sort_order
      from public.products p
      left join public.categories c on c.id=p.category_id and c.store_id=p.store_id
     where p.store_id=_sid
       and not p.is_archived
       and (
         _q=''
         or public.normalize_label(p.name) like '%'||_q||'%'
         or public.normalize_label(coalesce(c.name,'')) like '%'||_q||'%'
         or exists(select 1 from unnest(p.search_aliases) alias where alias like '%'||_q||'%')
       )
  )
  select count(*)::integer,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'product_id',b.id,
             'name',b.name,
             'category_id',b.category_id,
             'category_name',b.category_name,
             'search_aliases',to_jsonb(b.search_aliases),
             'updated_at',b.updated_at
           ) order by b.sort_order,b.name,b.id)
             from (select * from base order by sort_order,name,id limit _lim offset _off) b
         ),'[]'::jsonb)
    into _total,_items
    from base;

  return jsonb_build_object(
    'items',_items,
    'total',_total,
    'limit',_lim,
    'offset',_off,
    'has_more',(_off+_lim)<_total
  );
end;
$function$;

revoke all on function public.search_catalog_product_search_aliases(uuid,text,integer,integer) from public, anon;
grant execute on function public.search_catalog_product_search_aliases(uuid,text,integer,integer) to authenticated, service_role;
