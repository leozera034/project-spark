create or replace function public.get_store_meta_whatsapp_connection(_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _account private.integration_provider_accounts%rowtype;
  _session private.whatsapp_onboarding_sessions%rowtype;
  _webhook_subscribed boolean := false;
  _template_count integer := 0;
begin
  perform private.require_growth_access(_store_id);

  select * into _account
  from private.integration_provider_accounts a
  where a.store_id=_store_id and a.provider='meta_whatsapp' and a.connection_key='default'
  limit 1;

  if _account.id is not null then
    begin _webhook_subscribed := coalesce((_account.public_config->>'webhook_subscribed')::boolean,false); exception when others then _webhook_subscribed := false; end;
    begin _template_count := greatest(coalesce((_account.public_config->>'template_count')::integer,0),0); exception when others then _template_count := 0; end;
  end if;

  select * into _session
  from private.whatsapp_onboarding_sessions s
  where s.store_id=_store_id
  order by s.created_at desc
  limit 1;

  return jsonb_build_object(
    'configured', _account.id is not null,
    'connected', coalesce(_account.status='connected',false),
    'status', coalesce(_account.status,'disconnected'),
    'waba_id', coalesce(_account.public_config->>'waba_id',_account.external_account_id),
    'phone_number_id', _account.public_config->>'phone_number_id',
    'display_phone_number', _account.public_config->>'display_phone_number',
    'verified_name', _account.public_config->>'verified_name',
    'quality_rating', _account.public_config->>'quality_rating',
    'business_id', _account.public_config->>'business_id',
    'graph_api_version', _account.public_config->>'graph_api_version',
    'webhook_subscribed', _webhook_subscribed,
    'template_count', _template_count,
    'templates_synced_at', _account.public_config->>'templates_synced_at',
    'token_expires_at', _account.public_config->>'token_expires_at',
    'connected_at', _account.connected_at,
    'last_health_at', _account.last_health_at,
    'last_error', _account.last_error,
    'onboarding_session', case when _session.id is null then null else jsonb_build_object(
      'id',_session.id,
      'status',case when _session.status in ('created','exchanging') and _session.expires_at <= now() then 'expired' else _session.status end,
      'error_code',_session.error_code,
      'error_message',_session.error_message,
      'expires_at',_session.expires_at,
      'completed_at',_session.completed_at,
      'created_at',_session.created_at
    ) end
  );
end;
$function$;

revoke all on function public.get_store_meta_whatsapp_connection(uuid) from public, anon;
grant execute on function public.get_store_meta_whatsapp_connection(uuid) to authenticated;
