begin;
revoke execute on function public.create_catalog_promotion(uuid,text,text,public.promotion_type,numeric,numeric,uuid,uuid,timestamptz,timestamptz,boolean) from authenticated;
revoke execute on function public.set_catalog_promotion_active(uuid,uuid,boolean,timestamptz) from authenticated;
commit;
