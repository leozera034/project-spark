create or replace function public.storefront_review_summary(_slug text)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','public' as $$
declare v_slug text:=public.storefront_normalize_slug(_slug); v_store uuid; v_total bigint; v_avg numeric; v_replied bigint;
begin
 if v_slug is null then return null; end if;
 select id into v_store from public.stores where slug=v_slug and status='ativa' limit 1;
 if not found then return null; end if;
 select count(*),round(coalesce(avg(overall_rating),0),2),count(*) filter(where merchant_reply is not null) into v_total,v_avg,v_replied from public.store_reviews where store_id=v_store and is_visible;
 return jsonb_build_object('total',v_total,'averageRating',v_avg,'replied',v_replied);
end$$;
revoke all on function public.storefront_review_summary(text) from public,anon,authenticated;
grant execute on function public.storefront_review_summary(text) to service_role;
