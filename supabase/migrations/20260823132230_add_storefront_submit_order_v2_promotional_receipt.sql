begin;

create or replace function public.storefront_submit_order_v2(_slug text, _payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  _result jsonb;
  _order_id uuid;
  _store_id uuid;
  _order public.orders;
begin
  _result := public.storefront_submit_order(_slug,_payload);
  if not coalesce((_result->>'ok')::boolean,false) then
    return _result;
  end if;

  _order_id := nullif(_result#>>'{order,id}','')::uuid;
  select s.id into _store_id
    from public.stores s
   where s.slug=public.storefront_normalize_slug(_slug)
   limit 1;

  if _order_id is null or _store_id is null then
    return _result;
  end if;

  select * into _order
    from public.orders o
   where o.id=_order_id and o.store_id=_store_id
   limit 1;

  if not found then return _result; end if;

  _result := jsonb_set(_result,'{order,itemsSubtotal}',to_jsonb(private.money(_order.items_subtotal)),true);
  _result := jsonb_set(_result,'{order,deliveryFee}',to_jsonb(private.money(_order.delivery_fee)),true);
  _result := jsonb_set(_result,'{order,discountTotal}',to_jsonb(private.money(_order.discount_total)),true);
  _result := jsonb_set(_result,'{order,total}',to_jsonb(private.money(_order.total_amount)),true);
  return _result;
end;
$$;

revoke all on function public.storefront_submit_order_v2(text,jsonb) from public,anon,authenticated;
grant execute on function public.storefront_submit_order_v2(text,jsonb) to service_role;

comment on function public.storefront_submit_order_v2(text,jsonb) is
  'Checkout publico v2: preserva o fluxo existente e devolve o recibo a partir do pedido persistido apos congelar promocoes.';

commit;
