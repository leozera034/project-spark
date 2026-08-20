alter table public.customers alter column phone drop not null;
alter table public.orders alter column customer_phone drop not null;

do $$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='storefront_submit_order'
  limit 1;

  if v_def is null then raise exception 'private.storefront_submit_order not found'; end if;

  v_old := '  v_phone:=private.normalize_phone(v_phone_raw); IF v_phone IS NULL THEN RETURN jsonb_build_object(''ok'',false,''error'',''phone_invalid''); END IF;';
  v_new := '  v_phone:=CASE WHEN nullif(btrim(v_phone_raw),'''') IS NULL THEN NULL ELSE private.normalize_phone(v_phone_raw) END; IF nullif(btrim(v_phone_raw),'''') IS NOT NULL AND v_phone IS NULL THEN RETURN jsonb_build_object(''ok'',false,''error'',''phone_invalid''); END IF;';
  if strpos(v_def,v_old)=0 then raise exception 'phone validation fragment changed'; end if;
  v_def := replace(v_def,v_old,v_new);

  v_old := '  SELECT c.id INTO v_customer FROM public.customers c WHERE c.store_id=v_store AND c.phone=v_phone LIMIT 1;
  IF v_customer IS NULL THEN INSERT INTO public.customers(store_id,first_name,phone) VALUES(v_store,v_first,v_phone) RETURNING id INTO v_customer;
  ELSE UPDATE public.customers SET first_name=v_first,updated_at=now() WHERE id=v_customer; END IF;';
  v_new := '  IF v_phone IS NULL THEN
    INSERT INTO public.customers(store_id,first_name,phone) VALUES(v_store,v_first,NULL) RETURNING id INTO v_customer;
  ELSE
    SELECT c.id INTO v_customer FROM public.customers c WHERE c.store_id=v_store AND c.phone=v_phone LIMIT 1;
    IF v_customer IS NULL THEN INSERT INTO public.customers(store_id,first_name,phone) VALUES(v_store,v_first,v_phone) RETURNING id INTO v_customer;
    ELSE UPDATE public.customers SET first_name=v_first,updated_at=now() WHERE id=v_customer; END IF;
  END IF;';
  if strpos(v_def,v_old)=0 then raise exception 'customer identity fragment changed'; end if;
  v_def := replace(v_def,v_old,v_new);

  execute v_def;
end $$;
