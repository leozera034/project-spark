do $$
declare
  v_store_id uuid;
  v_addon_id uuid;
begin
  select id into v_store_id from public.stores where slug = 'comandiva-burger-lab' limit 1;
  if v_store_id is null then
    raise exception 'QA_STORE_NOT_FOUND';
  end if;

  select id into v_addon_id from public.addon_catalog where code = 'whatsapp_automation' limit 1;
  if v_addon_id is null then
    raise exception 'WHATSAPP_ADDON_NOT_FOUND';
  end if;

  insert into public.store_addon_subscriptions(
    store_id, addon_id, status, complimentary_until, complimentary_reason, activated_at
  ) values (
    v_store_id, v_addon_id, 'complimentary', now() + interval '6 hours',
    'Temporary Evolution API end-to-end QA', now()
  )
  on conflict (store_id, addon_id) do update
    set status = 'complimentary',
        complimentary_until = excluded.complimentary_until,
        complimentary_reason = excluded.complimentary_reason,
        activated_at = coalesce(public.store_addon_subscriptions.activated_at, now()),
        cancelled_at = null,
        updated_at = now();
end;
$$;
