create or replace function public.get_store_delivery_pricing_config(_store_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path to 'public','private','pg_temp'
as $function$
declare _sid uuid:=private.resolve_store(_store_id); _cfg public.store_delivery_pricing_settings; _bands jsonb;
begin
  perform private.require_permission('store.manage_neighborhoods',_sid);
  select * into _cfg from public.store_delivery_pricing_settings where store_id=_sid;
  if not found then
    _cfg.store_id:=_sid;
    _cfg.mode:='neighborhood';
    _cfg.fixed_fee:=0;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'max_distance_km',b.max_distance_km,'delivery_fee',b.delivery_fee,'min_order_amount',b.min_order_amount,'eta_minutes',b.eta_minutes,'is_active',b.is_active,'sort_order',b.sort_order) order by b.max_distance_km),'[]'::jsonb)
  into _bands from public.store_delivery_radius_bands b where b.store_id=_sid;
  return jsonb_build_object('store_id',_sid,'mode',_cfg.mode,'fixed_fee',_cfg.fixed_fee,'fixed_min_order_amount',_cfg.fixed_min_order_amount,'fixed_eta_minutes',_cfg.fixed_eta_minutes,'radius_bands',_bands);
end;$function$;
