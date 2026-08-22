-- The configured Pix destination is operational configuration. Keep its raw value
-- visible only to members who can manage payment methods; less privileged store
-- members may still see whether Pix has been configured.
create or replace function public.get_my_store_configuration(_store_id uuid default null::uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _sensitive boolean;
  _payment_sensitive boolean;
  _result jsonb;
begin
  perform private.require_permission('store.view_basic',_sid);
  _sensitive:=private.has_permission('store.update_profile',_sid);
  _payment_sensitive:=private.has_permission('store.manage_payment_methods',_sid);

  select jsonb_build_object(
    'store',jsonb_build_object(
      'id',s.id,'slug',s.slug,'name',s.name,'status',s.status,
      'legal_name',case when _sensitive then s.legal_name end,
      'document',case when _sensitive then s.document end,
      'segment',s.segment,'phone',s.phone,'whatsapp',s.whatsapp,'email',s.email,
      'postal_code',s.postal_code,'street',s.street,'address_number',s.address_number,
      'address_complement',s.address_complement,'neighborhood',s.neighborhood,
      'address_line',s.address_line,'city',s.city,'state',s.state,
      'latitude',s.latitude,'longitude',s.longitude,'location_source',s.location_source,
      'location_verified_at',s.location_verified_at,'location_accuracy_meters',s.location_accuracy_meters,
      'timezone',s.timezone,'accepts_delivery',s.accepts_delivery,'accepts_pickup',s.accepts_pickup,'updated_at',s.updated_at
    ),
    'settings',jsonb_build_object(
      'brand_primary',st.brand_primary,'brand_accent',st.brand_accent,'logo_path',st.logo_path,
      'cover_path',st.cover_path,'description',st.description,'welcome_message',st.welcome_message,
      'closed_message',st.closed_message,'min_order_amount',st.min_order_amount,
      'default_prep_minutes',st.default_prep_minutes,'sound_alert_enabled',st.sound_alert_enabled,
      'auto_open_by_hours',st.auto_open_by_hours,'manual_override_open',st.manual_override_open,
      'online_payments_enabled',coalesce(st.online_payments_enabled,false),
      'manual_pix_key',case when _payment_sensitive then st.manual_pix_key end,
      'manual_pix_key_type',case when _payment_sensitive then st.manual_pix_key_type end,
      'online_payment_terms_accepted_at',st.online_payment_terms_accepted_at,'updated_at',st.updated_at
    ),
    'payment_setup',jsonb_build_object(
      'online_enabled',coalesce(st.online_payments_enabled,false),
      'online_ready',coalesce(sc.details_submitted,false) and coalesce(sc.charges_enabled,false) and coalesce(sc.payouts_enabled,false) and coalesce(sc.transfers_enabled,false),
      'stripe_connected',sc.store_id is not null,
      'details_submitted',coalesce(sc.details_submitted,false),
      'charges_enabled',coalesce(sc.charges_enabled,false),
      'payouts_enabled',coalesce(sc.payouts_enabled,false),
      'transfers_enabled',coalesce(sc.transfers_enabled,false),
      'requirements_currently_due',coalesce(to_jsonb(sc.requirements_currently_due),'[]'::jsonb),
      'application_fee_bps',coalesce(sc.application_fee_bps_override,sc.application_fee_bps),
      'manual_pix_configured',nullif(btrim(coalesce(st.manual_pix_key,'')),'') is not null,
      'online_terms_accepted_at',st.online_payment_terms_accepted_at
    ),
    'hours',coalesce((select jsonb_agg(jsonb_build_object('weekday',h.weekday,'opens_at',to_char(h.opens_at,'HH24:MI'),'closes_at',to_char(h.closes_at,'HH24:MI')) order by h.weekday,h.opens_at) from public.store_hours h where h.store_id=_sid and h.is_active),'[]'::jsonb),
    'neighborhoods',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'name',n.name,'delivery_fee',n.delivery_fee,'min_order_amount',n.min_order_amount,'eta_minutes',n.eta_minutes,'notes',n.notes,'is_active',n.is_active,'is_archived',n.is_archived,'sort_order',n.sort_order,'updated_at',n.updated_at) order by n.sort_order,n.name) from public.neighborhoods n where n.store_id=_sid),'[]'::jsonb),
    'payment_methods',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'kind',p.kind,'label',p.label,
      'instructions',case when _payment_sensitive then p.instructions else null end,
      'needs_change',p.needs_change,'is_active',p.is_active,
      'available_for_delivery',p.available_for_delivery,'available_for_pickup',p.available_for_pickup,
      'processing_mode',case when p.kind='stripe_online'::public.payment_method_kind then 'online' else 'manual' end,
      'sort_order',p.sort_order,'updated_at',p.updated_at
    ) order by p.sort_order,p.label) from public.payment_methods p where p.store_id=_sid),'[]'::jsonb),
    'can',jsonb_build_object(
      'update_profile',private.has_permission('store.update_profile',_sid),
      'manage_settings',private.has_permission('store.manage_settings',_sid),
      'manage_hours',private.has_permission('store.manage_hours',_sid),
      'manage_neighborhoods',private.has_permission('store.manage_neighborhoods',_sid),
      'manage_payment_methods',_payment_sensitive
    )
  ) into _result
  from public.stores s
  left join public.store_settings st on st.store_id=s.id
  left join private.stripe_connect_accounts sc on sc.store_id=s.id
  where s.id=_sid;

  if _result is null then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  return _result;
end;
$function$;
