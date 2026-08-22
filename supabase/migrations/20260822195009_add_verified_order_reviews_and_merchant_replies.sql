create table if not exists public.store_reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  fulfillment public.fulfillment_type not null,
  overall_rating smallint not null check (overall_rating between 1 and 5),
  food_rating smallint check (food_rating between 1 and 5),
  delivery_rating smallint check (delivery_rating between 1 and 5),
  comment text,
  merchant_reply text,
  replied_by uuid references public.user_profiles(id) on delete set null,
  replied_at timestamptz,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_reviews_order_unique unique(order_id),
  constraint store_reviews_comment_length check (comment is null or char_length(comment)<=1000),
  constraint store_reviews_reply_length check (merchant_reply is null or char_length(merchant_reply)<=1000),
  constraint store_reviews_delivery_rating_scope check (delivery_rating is null or fulfillment='entrega'::public.fulfillment_type)
);
create index if not exists idx_store_reviews_store_created on public.store_reviews(store_id,created_at desc);
create index if not exists idx_store_reviews_store_rating on public.store_reviews(store_id,overall_rating,created_at desc);
create index if not exists idx_store_reviews_customer on public.store_reviews(store_id,customer_id) where customer_id is not null;
alter table public.store_reviews enable row level security;
revoke all on table public.store_reviews from public,anon,authenticated;
grant all on table public.store_reviews to service_role;

create or replace function public.get_public_order_review_state(_tracking_token text)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','public','private','extensions' as $$
declare _hash text; _order public.orders%rowtype; _review public.store_reviews%rowtype;
begin
 if _tracking_token is null or length(_tracking_token)<16 or length(_tracking_token)>256 then return jsonb_build_object('available',false,'reason','not_found'); end if;
 _hash:=encode(sha256(convert_to(_tracking_token,'UTF8')),'hex');
 select * into _order from public.orders o where o.tracking_token_hash=_hash limit 1;
 if not found then return jsonb_build_object('available',false,'reason','not_found'); end if;
 select * into _review from public.store_reviews r where r.order_id=_order.id;
 if found then
   return jsonb_build_object('available',false,'submitted',true,'orderNumber',_order.order_number,'fulfillment',_order.fulfillment::text,'review',jsonb_build_object('overallRating',_review.overall_rating,'foodRating',_review.food_rating,'deliveryRating',_review.delivery_rating,'comment',_review.comment,'merchantReply',_review.merchant_reply,'repliedAt',_review.replied_at,'createdAt',_review.created_at));
 end if;
 return jsonb_build_object('available',_order.status in ('entregue'::public.order_status,'retirado'::public.order_status),'submitted',false,'reason',case when _order.status in ('entregue'::public.order_status,'retirado'::public.order_status) then null else 'order_not_completed' end,'orderNumber',_order.order_number,'fulfillment',_order.fulfillment::text);
end$$;

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
 values(_order.store_id,'cliente','store.review.created','store_reviews',_review.id,jsonb_build_object('source','customer_tracking_token','orderId',_order.id,'orderNumber',_order.order_number,'overallRating',_overall_rating));
 return jsonb_build_object('ok',true,'reused',false,'review',jsonb_build_object('id',_review.id,'overallRating',_review.overall_rating,'createdAt',_review.created_at));
end$$;

create or replace function public.get_my_store_review_center(_store_id uuid,_limit integer default 100,_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','public','private' as $$
declare _uid uuid:=auth.uid(); _summary jsonb; _items jsonb;
begin
 if not private.is_store_manager_user(_uid,_store_id) and not private.is_platform_admin_user(_uid) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select jsonb_build_object('total',count(*),'averageRating',round(coalesce(avg(r.overall_rating),0),2),'averageFoodRating',round(coalesce(avg(r.food_rating),0),2),'averageDeliveryRating',round(coalesce(avg(r.delivery_rating),0),2),'replied',count(*) filter(where r.merchant_reply is not null),'responseRate',case when count(*)=0 then 0 else round((count(*) filter(where r.merchant_reply is not null))::numeric*100/count(*),1) end,'distribution',jsonb_build_object('1',count(*) filter(where r.overall_rating=1),'2',count(*) filter(where r.overall_rating=2),'3',count(*) filter(where r.overall_rating=3),'4',count(*) filter(where r.overall_rating=4),'5',count(*) filter(where r.overall_rating=5))) into _summary from public.store_reviews r where r.store_id=_store_id and r.is_visible;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'orderId',x.order_id,'orderNumber',x.order_number,'customerName',x.customer_name,'fulfillment',x.fulfillment::text,'overallRating',x.overall_rating,'foodRating',x.food_rating,'deliveryRating',x.delivery_rating,'comment',x.comment,'merchantReply',x.merchant_reply,'repliedAt',x.replied_at,'createdAt',x.created_at) order by x.created_at desc),'[]'::jsonb) into _items
 from (select r.id,r.order_id,o.order_number,coalesce(nullif(btrim(c.first_name),''),'Cliente') as customer_name,r.fulfillment,r.overall_rating,r.food_rating,r.delivery_rating,r.comment,r.merchant_reply,r.replied_at,r.created_at from public.store_reviews r join public.orders o on o.id=r.order_id and o.store_id=r.store_id left join public.customers c on c.id=r.customer_id and c.store_id=r.store_id where r.store_id=_store_id and r.is_visible order by r.created_at desc limit least(greatest(coalesce(_limit,100),1),200) offset greatest(coalesce(_offset,0),0)) x;
 return jsonb_build_object('summary',coalesce(_summary,'{}'::jsonb),'items',_items,'generatedAt',now());
end$$;

create or replace function public.reply_to_store_review(_store_id uuid,_review_id uuid,_reply text)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare _uid uuid:=auth.uid(); _review public.store_reviews%rowtype; _clean text:=nullif(btrim(coalesce(_reply,'')),'');
begin
 if not private.is_store_manager_user(_uid,_store_id) and not private.is_platform_admin_user(_uid) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if _clean is null or char_length(_clean)>1000 then raise exception 'INVALID_REPLY' using errcode='22023'; end if;
 update public.store_reviews set merchant_reply=_clean,replied_by=_uid,replied_at=now(),updated_at=now() where id=_review_id and store_id=_store_id returning * into _review;
 if not found then raise exception 'REVIEW_NOT_FOUND' using errcode='P0001'; end if;
 insert into public.audit_logs(store_id,actor_user_id,actor_kind,action,entity,entity_id,context) values(_store_id,_uid,'loja','store.review.replied','store_reviews',_review_id,jsonb_build_object('orderId',_review.order_id,'replyLength',char_length(_clean)));
 return jsonb_build_object('ok',true,'reviewId',_review.id,'repliedAt',_review.replied_at);
end$$;
