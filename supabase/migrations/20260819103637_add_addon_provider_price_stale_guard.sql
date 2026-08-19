create or replace function public.billing_mark_addon_provider_price_stale(
  _addon_price_id uuid,
  _reason text
)
returns boolean
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $function$
declare
  _updated integer;
begin
  update private.billing_provider_addon_price_refs
  set provider_status='stale',
      metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
        'stale_reason', left(coalesce(nullif(btrim(_reason),''),'provider_mismatch'),200),
        'stale_at', now()
      ),
      updated_at=now()
  where addon_price_id=_addon_price_id
    and provider='mercado_pago';

  get diagnostics _updated = row_count;
  return _updated=1;
end;
$function$;

revoke all on function public.billing_mark_addon_provider_price_stale(uuid,text) from public,anon,authenticated;
grant execute on function public.billing_mark_addon_provider_price_stale(uuid,text) to service_role;

comment on function public.billing_mark_addon_provider_price_stale(uuid,text) is 'Service-only kill switch used when authoritative Mercado Pago plan data no longer matches the canonical Comandiva add-on price.';
