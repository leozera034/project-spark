-- Phase 27 — Security hardening
-- Remove anonymous execution from privileged SECURITY DEFINER RPCs.
-- Public slug availability remains intentionally callable by anon.

REVOKE EXECUTE ON FUNCTION public.activate_store_courier(uuid, uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.assign_delivery_courier(uuid, uuid, uuid, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.deactivate_store_courier(uuid, uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_courier_management_counts(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_store_courier_detail(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_store_delivery_assignment(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_eligible_couriers_for_delivery(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_my_store_couriers(uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reassign_delivery_courier(uuid, uuid, uuid, integer, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_store_courier(uuid, uuid, integer, text, text, boolean) FROM anon;

-- Store provisioning is a server-only saga invoked through the service-role client.
REVOKE EXECUTE ON FUNCTION public.provision_store_with_owner(text, text, uuid, text, text, text, text, text, text, text, text, text, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_store_provisioning(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_store_with_owner(text, text, uuid, text, text, text, text, text, text, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_store_provisioning(text, text) TO service_role;

-- Ensure the intended public RPC remains public.
GRANT EXECUTE ON FUNCTION public.check_public_store_slug(text) TO anon, authenticated, service_role;
