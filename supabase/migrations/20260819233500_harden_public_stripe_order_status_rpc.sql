begin;

revoke all on function public.get_public_order_stripe_payment_status(uuid,text) from public, anon, authenticated;
grant execute on function public.get_public_order_stripe_payment_status(uuid,text) to service_role;

commit;
