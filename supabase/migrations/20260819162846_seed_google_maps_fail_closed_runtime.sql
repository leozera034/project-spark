insert into private.maps_provider_runtime_readiness (
  provider,
  environment,
  api_key_configured,
  billing_confirmed,
  routes_api_enabled,
  geocoding_api_enabled,
  kill_switch_enabled,
  last_health_at,
  last_error_code,
  last_error_detail,
  created_at,
  updated_at
)
values (
  'google_maps',
  'production',
  false,
  false,
  false,
  false,
  true,
  now(),
  'PROVIDER_NOT_HOMOLOGATED',
  'Google Maps production is intentionally fail-closed until server credential, billing, API enablement and controlled validation are complete.',
  now(),
  now()
)
on conflict (provider, environment) do nothing;
