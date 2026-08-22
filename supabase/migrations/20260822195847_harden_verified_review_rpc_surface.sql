revoke all on function public.get_public_order_review_state(text) from public, anon, authenticated;
revoke all on function public.submit_store_order_review(text, integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.get_public_order_review_state(text) to service_role;
grant execute on function public.submit_store_order_review(text, integer, integer, integer, text) to service_role;

revoke all on function public.get_my_store_review_center(uuid, integer, integer) from public, anon;
revoke all on function public.reply_to_store_review(uuid, uuid, text) from public, anon;
grant execute on function public.get_my_store_review_center(uuid, integer, integer) to authenticated, service_role;
grant execute on function public.reply_to_store_review(uuid, uuid, text) to authenticated, service_role;
