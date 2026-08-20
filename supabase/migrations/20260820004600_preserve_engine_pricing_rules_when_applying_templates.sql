create or replace function public.update_product_engine_profile(
  _store_id uuid,
  _product_id uuid,
  _product_type text,
  _capabilities jsonb,
  _pricing_rules jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _sid uuid := private.resolve_store(_store_id);
  _p public.products;
  _merged_rules jsonb;
begin
  perform private.require_permission('catalog.update',_sid);
  if nullif(trim(_product_type),'') is null or length(trim(_product_type))>50 then raise exception 'INVALID_PRODUCT_TYPE'; end if;
  perform private.assert_shark_capabilities(coalesce(_capabilities,'{}'::jsonb));
  if jsonb_typeof(coalesce(_pricing_rules,'{}'::jsonb))<>'object' then raise exception 'INVALID_PRICING_RULES'; end if;

  select * into _p
    from public.products
   where id=_product_id and store_id=_sid and not is_archived
   for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;

  _merged_rules := coalesce(_p.pricing_rules,'{}'::jsonb) || coalesce(_pricing_rules,'{}'::jsonb);

  update public.products
     set product_type=lower(trim(_product_type)),
         capabilities=coalesce(_capabilities,'{}'::jsonb),
         pricing_rules=_merged_rules,
         engine_version=2,
         updated_at=now()
   where id=_product_id and store_id=_sid and not is_archived
   returning * into _p;

  perform private.log_config_audit(_sid,'catalog.product.engine_profile.updated','products',_product_id,array['product_type','capabilities','pricing_rules','engine_version']);
  return jsonb_build_object('product_id',_p.id,'product_type',_p.product_type,'capabilities',_p.capabilities,'pricing_rules',_p.pricing_rules,'engine_version',_p.engine_version);
end;
$function$;