-- The PIN derivation helper is internal-only. SECURITY DEFINER wrappers owned by
-- the database owner can still call it; application roles cannot invoke it.
REVOKE ALL ON FUNCTION private.delivery_proof_pin(text) FROM PUBLIC, anon, authenticated, service_role;
