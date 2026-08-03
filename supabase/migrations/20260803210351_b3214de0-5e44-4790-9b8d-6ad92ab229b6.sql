DELETE FROM public.store_provisioning_intents WHERE idempotency_key = 'dbg-1';
DELETE FROM public.stores WHERE slug = 'mercado-debug-1';
DELETE FROM public.user_profiles WHERE id = '00000000-0000-0000-0000-000000000000';