create or replace function public.submit_store_order_review(_tracking_token text,_overall_rating integer,_food_rating integer default null,_delivery_rating integer default null,_comment text default null)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private','extensions' as $$
declare _hash text; _order public.orders%rowtype; _review public.store_reviews%rowtype; _comment_clean text;
begin
 if _tracking_token is null or length(_tracking_token)<16 or length(_tracking_token)>256 then return jsonb_build_object('ok',false,'error','review_not_available'); end if;
 if _overall_rating is null or _overall_rating not between 1 and 5 then return jsonb_build_object('ok',false,'error','rating_invalid'); end if;
 if _food_rating is not null and _food_rating not between 1 and 5 then return jsonb_build_object('ok',false,'error','food_rating_invalid'); end if;
 if _delivery_rating is not null and _delivery_rating not between 1 and 5 then return jsonb_build_object('ok',false,'error','delivery_rating_invalid'); end if;
 _comment_clean:=nullif(btrim(coalesce(_comment,'')),'');
 if _comment_clean is not null and char_length(_comment_clean)>1000 then return jsonb_build_object('ok',false,'error','comment_too_long'); end if;
 _hash:=encode(sha256(convert_to(_tracking_token,'UTF8')),'hex');
 select * into _order from public.orders o where o.tracking_token_hash=_hash limit 1;
 if not found then return jsonb_build_object('ok',false,'error','review_not_available'); end if;
 if _order.status not in ('entregue'::public.order_status,'retirado'::public.order_status) then return jsonb_build_object('ok',false,'error','order_not_completed'); end if;
 if _order.payment_method_kind='stripe_online' and _order.payment_status not in ('paid','partially_refunded','refunded') then return jsonb_build_object('ok',false,'error','order_not_completed'); end if;
 if _order.fulfillment<>'entrega'::public.fulfillment_type and _delivery_rating is not null then return jsonb_build_object('ok',false,'error','delivery_rating_not_applicable'); end if;
 insert into public.store_reviews(store_id,order_id,customer_id,fulfillment,overall_rating,food_rating,delivery_rating,comment)
 values(_order.store_id,_order.id,_order.customer_id,_order.fulfillment,_overall_rating,_food_rating,_delivery_rating,_comment_clean)
 on conflict(order_id) do nothing returning * into _review;
 if not found then
   select * into _review from public.store_reviews where order_id=_order.id;
   return jsonb_build_object('ok',true,'reused',true,'review',jsonb_build_object('id',_review.id,'overallRating',_review.overall_rating,'createdAt',_review.created_at));
 end if;
 insert into public.audit_logs(store_id,actor_kind,action,entity,entity_id,context)
 values(_order.store_id,'sistema','store.review.created','store_reviews',_review.id,jsonb_build_object('source','customer_tracking_token','orderId',_order.id,'orderNumber',_order.order_number,'overallRating',_overall_rating));
 return jsonb_build_object('ok',true,'reused',false,'review',jsonb_build_object('id',_review.id,'overallRating',_review.overall_rating,'createdAt',_review.created_at));
end$$;
