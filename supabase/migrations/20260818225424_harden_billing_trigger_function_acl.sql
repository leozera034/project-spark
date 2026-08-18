revoke all on function private.set_subscription_delinquent_since() from public, anon, authenticated;
grant execute on function private.set_subscription_delinquent_since() to postgres, service_role;
