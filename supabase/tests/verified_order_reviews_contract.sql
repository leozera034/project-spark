-- Verified completed-order reviews and merchant reply contract.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/verified_order_reviews_contract.sql

begin;

do $$
declare
  _uid uuid;
  _sid uuid;
  _other uuid;
  _oid uuid;
  _token text:='review-contract-token-20260822-verified';
  _state jsonb;
  _first jsonb;
  _duplicate jsonb;
  _center jsonb;
  _review_id uuid;
  _forbidden boolean:=false;
begin
  select r.user_id,r.store_id into _uid,_sid
  from public.user_roles r
  join public.user_profiles p on p.id=r.user_id and p.is_active
  where r.is_active and r.store_id is not null and r.role in ('proprietario','gerente')
    and not private.is_platform_admin_user(r.user_id)
    and exists(select 1 from public.orders o where o.store_id=r.store_id and o.status in ('entregue','retirado'))
  order by r.created_at limit 1;
  if _uid is null then raise exception 'NO_MANAGER_WITH_COMPLETED_ORDER_FOR_REVIEW_TEST'; end if;

  select o.id into _oid from public.orders o where o.store_id=_sid and o.status in ('entregue','retirado') order by o.created_at limit 1;
  delete from public.store_reviews where order_id=_oid;
  update public.orders set tracking_token_hash=encode(sha256(convert_to(_token,'UTF8')),'hex'),payment_status=case when payment_method_kind='stripe_online' then 'paid' else payment_status end where id=_oid;

  if has_function_privilege('anon','public.get_public_order_review_state(text)','EXECUTE') then raise exception 'ANON_CAN_EXECUTE_REVIEW_STATE_RPC'; end if;
  if has_function_privilege('authenticated','public.submit_store_order_review(text,integer,integer,integer,text)','EXECUTE') then raise exception 'AUTHENTICATED_CAN_EXECUTE_PUBLIC_REVIEW_SUBMIT_RPC'; end if;
  if not has_function_privilege('service_role','public.submit_store_order_review(text,integer,integer,integer,text)','EXECUTE') then raise exception 'SERVICE_ROLE_CANNOT_EXECUTE_REVIEW_SUBMIT_RPC'; end if;

  _state:=public.get_public_order_review_state(_token);
  if coalesce((_state->>'available')::boolean,false) is not true then raise exception 'COMPLETED_ORDER_REVIEW_NOT_AVAILABLE: %',_state; end if;

  _first:=public.submit_store_order_review(_token,2,3,null,'Contrato de avaliação verificada.');
  if coalesce((_first->>'ok')::boolean,false) is not true or coalesce((_first->>'reused')::boolean,true) is not false then raise exception 'FIRST_REVIEW_SUBMIT_FAILED: %',_first; end if;
  _review_id:=(_first#>>'{review,id}')::uuid;

  _duplicate:=public.submit_store_order_review(_token,5,5,null,'Tentativa de sobrescrever.');
  if coalesce((_duplicate->>'reused')::boolean,false) is not true then raise exception 'DUPLICATE_REVIEW_NOT_REUSED: %',_duplicate; end if;
  if (select overall_rating from public.store_reviews where id=_review_id)<>2 then raise exception 'DUPLICATE_OVERWROTE_ORIGINAL_REVIEW'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',_uid::text,'role','authenticated')::text,true);
  _center:=public.get_my_store_review_center(_sid,200,0);
  if not exists(select 1 from jsonb_array_elements(_center->'items') item where item->>'id'=_review_id::text) then raise exception 'MERCHANT_REVIEW_CENTER_MISSING_REVIEW'; end if;
  perform public.reply_to_store_review(_sid,_review_id,'Resposta pública do contrato.');

  _state:=public.get_public_order_review_state(_token);
  if _state#>>'{review,merchantReply}' <> 'Resposta pública do contrato.' then raise exception 'PUBLIC_REVIEW_STATE_MISSING_MERCHANT_REPLY: %',_state; end if;

  select s.id into _other from public.stores s where s.id<>_sid and not private.is_store_manager_user(_uid,s.id) order by s.created_at limit 1;
  if _other is not null then
    begin perform public.get_my_store_review_center(_other,100,0);
    exception when insufficient_privilege then _forbidden:=true;
    when others then if sqlstate='42501' then _forbidden:=true; else raise; end if; end;
    if not _forbidden then raise exception 'CROSS_STORE_REVIEW_CENTER_ALLOWED'; end if;
  end if;
end $$;

select 'verified_order_reviews_contract_passed' as result;
rollback;
