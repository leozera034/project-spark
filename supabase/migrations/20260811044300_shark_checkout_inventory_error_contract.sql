-- SHARK — contrato público para corrida de estoque no checkout.
-- A reserva atômica continua sendo a autoridade. Se outra compra consumir o
-- estoque entre a cotação e o INSERT, o cliente recebe o erro já compreendido
-- pelo checkout em vez de uma exceção PostgreSQL.

create or replace function public.storefront_submit_order(_slug text, _payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_result jsonb;
  v_detail text;
begin
  begin
    v_result := private.storefront_submit_order(_slug,_payload);

    if not coalesce((v_result->>'ok')::boolean,false) then
      raise exception using
        errcode='P0001',
        message='SHARK_CHECKOUT_ROLLBACK',
        detail=v_result::text;
    end if;

    return v_result;
  exception
    when sqlstate 'P0001' then
      if sqlerrm='SHARK_CHECKOUT_ROLLBACK' then
        get stacked diagnostics v_detail=PG_EXCEPTION_DETAIL;
        return v_detail::jsonb;
      end if;

      if sqlerrm in (
        'PRODUCT_STOCK_INSUFFICIENT',
        'OPTION_STOCK_INSUFFICIENT'
      ) then
        return jsonb_build_object(
          'ok',false,
          'error','line_unavailable',
          'reason','out_of_stock'
        );
      end if;

      raise;
  end;
end;
$$;

revoke all on function public.storefront_submit_order(text,jsonb) from public,anon,authenticated;
grant execute on function public.storefront_submit_order(text,jsonb) to service_role;

comment on function public.storefront_submit_order(text,jsonb) is
  'Atomic checkout wrapper. Rolls back ok:false and maps concurrent managed-stock exhaustion to line_unavailable.';
