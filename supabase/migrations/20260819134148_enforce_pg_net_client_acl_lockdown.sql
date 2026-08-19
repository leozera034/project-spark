-- Supabase currently restores pg_net schema/function grants as platform-managed ACLs.
-- Keep this migration in source control because it was applied to production history;
-- runtime access to the push worker is still protected by provider readiness,
-- Vault-backed worker authentication and service-role-only backend RPCs.
revoke all privileges on schema net from public, anon, authenticated;
revoke all privileges on all functions in schema net from public, anon, authenticated;
