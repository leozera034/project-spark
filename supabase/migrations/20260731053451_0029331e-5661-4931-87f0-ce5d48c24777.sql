CREATE OR REPLACE FUNCTION public.storefront_submit_order(_slug text, _payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_slug        text := public.storefront_normalize_slug(_slug);
  v_store       uuid;
  v_key         text := nullif(btrim(_payload->>'idempotencyKey'), '');
  v_hash        text;
  v_existing    public.orders;
  v_type        text := lower(coalesce(_payload#>>'{fulfillment,type}', ''));
  v_area        uuid := nullif(_payload#>>'{fulfillment,deliveryAreaId}', '')::uuid;
  v_cfgv        text := nullif(_payload#>>'{fulfillment,configurationVersion}', '');
  v_val         jsonb;
  v_first       text := btrim(coalesce(_payload#>>'{customer,firstName}', ''));
  v_phone_raw   text := coalesce(_payload#>>'{customer,phone}', '');
  v_phone       text;
  v_notes       text := nullif(btrim(coalesce(_payload->>'notes', '')), '');
  v_pm          public.payment_methods;
  v_change      numeric := nullif(_payload#>>'{payment,changeFor}', '')::numeric;
  v_lines       jsonb := coalesce(_payload->'lines', '[]'::jsonb);
  v_line        jsonb;
  v_grouped     jsonb;
  v_calc        jsonb;
  v_errs        jsonb;
  v_subtotal    numeric := 0;
  v_fee         numeric := 0;
  v_min         numeric := 0;
  v_eta         int;
  v_customer    uuid;
  v_addr_id     uuid;
  v_fp          text;
  v_order       uuid;
  v_number      int;
  v_item        uuid;
  v_sort        int := 0;
  v_product     public.products;
  v_variant     public.product_variants;
  v_unit        public.pricing_unit;
  v_qty         numeric;
  v_sel         jsonb;
  v_oi          public.option_items;
  v_og          public.option_groups;
  v_snapshot    jsonb;
  v_token       text;
BEGIN
  IF v_slug IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'store_not_found'); END IF;
  IF v_key IS NULL OR length(v_key) < 8 OR length(v_key) > 120 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'idempotency_key_invalid');
  END IF;

  SELECT st.id INTO v_store FROM public.stores st
   WHERE st.slug = v_slug AND st.status = 'ativa' LIMIT 1;
  IF v_store IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'store_not_found'); END IF;

  -- Assinatura do conteúdo, ignorando a chave de idempotência.
  v_hash := encode(sha256(convert_to((_payload - 'idempotencyKey')::text, 'UTF8')), 'hex');

  PERFORM pg_advisory_xact_lock(hashtextextended(v_store::text || ':' || v_key, 0));

  SELECT * INTO v_existing FROM public.orders o
   WHERE o.store_id = v_store AND o.idempotency_key = v_key LIMIT 1;
  IF FOUND THEN
    IF v_existing.request_hash IS DISTINCT FROM v_hash THEN
      RETURN jsonb_build_object('ok', false, 'error', 'idempotency_conflict');
    END IF;
    RETURN jsonb_build_object(
      'ok', true, 'replayed', true,
      'order', jsonb_build_object(
        'id', v_existing.id,
        'orderNumber', v_existing.order_number,
        'trackingToken', v_existing.public_tracking_token,
        'status', v_existing.status,
        'itemsSubtotal', v_existing.items_subtotal,
        'deliveryFee', v_existing.delivery_fee,
        'total', v_existing.total_amount,
        'etaMinutes', v_existing.eta_minutes
      )
    );
  END IF;

  -- Identificação
  IF length(v_first) < 2 OR length(v_first) > 60 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name_invalid');
  END IF;
  v_phone := private.normalize_phone(v_phone_raw);
  IF v_phone IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'phone_invalid'); END IF;

  -- Modalidade, área e horário
  v_val := public.storefront_validate_fulfillment(v_slug, v_type, v_area, v_cfgv);
  IF v_val IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'store_not_found'); END IF;
  IF NOT (v_val->>'isValid')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'error', 'fulfillment_invalid',
                              'validationErrors', v_val->'validationErrors');
  END IF;
  IF NOT (v_val->>'storeIsOpen')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'error', 'store_closed');
  END IF;

  v_fee := CASE WHEN v_type = 'entrega' THEN coalesce((v_val->>'deliveryFee')::numeric, 0) ELSE 0 END;
  v_min := coalesce((v_val->>'minimumOrderAmount')::numeric, 0);
  v_eta := (v_val->>'estimatedMinutes')::int;

  -- Forma de pagamento
  SELECT * INTO v_pm FROM public.payment_methods pm
   WHERE pm.store_id = v_store
     AND pm.id = nullif(_payload#>>'{payment,methodId}', '')::uuid
     AND pm.is_active
     AND ((v_type = 'entrega' AND pm.available_for_delivery)
       OR (v_type = 'retirada' AND pm.available_for_pickup));
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'payment_method_invalid'); END IF;
  IF NOT v_pm.needs_change THEN v_change := NULL; END IF;
  IF v_change IS NOT NULL AND v_change < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'change_invalid');
  END IF;

  IF jsonb_typeof(v_lines) <> 'array' OR jsonb_array_length(v_lines) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cart_empty');
  END IF;
  IF jsonb_array_length(v_lines) > 40 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cart_too_large');
  END IF;

  -- Cliente (reaproveitado por telefone dentro da loja)
  SELECT c.id INTO v_customer FROM public.customers c
   WHERE c.store_id = v_store AND c.phone = v_phone LIMIT 1;
  IF v_customer IS NULL THEN
    INSERT INTO public.customers (store_id, first_name, phone)
    VALUES (v_store, v_first, v_phone)
    RETURNING id INTO v_customer;
  ELSE
    UPDATE public.customers SET first_name = v_first, updated_at = now() WHERE id = v_customer;
  END IF;

  -- Endereço apenas para entrega
  IF v_type = 'entrega' THEN
    IF nullif(btrim(coalesce(_payload#>>'{address,street}', '')), '') IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'address_invalid');
    END IF;
    IF (v_val#>>'{deliveryArea,id}')::uuid IS DISTINCT FROM v_area THEN
      RETURN jsonb_build_object('ok', false, 'error', 'address_invalid');
    END IF;

    v_fp := private.address_fingerprint(
      v_area,
      _payload#>>'{address,street}',
      _payload#>>'{address,number}',
      coalesce((_payload#>>'{address,hasNoNumber}')::boolean, false),
      _payload#>>'{address,complement}'
    );

    SELECT a.id INTO v_addr_id FROM public.customer_addresses a
     WHERE a.store_id = v_store AND a.customer_id = v_customer AND a.address_fingerprint = v_fp
     LIMIT 1;

    IF v_addr_id IS NULL THEN
      INSERT INTO public.customer_addresses (
        store_id, customer_id, neighborhood_id, neighborhood_name, street, number,
        has_no_number, complement, reference, label, address_fingerprint, last_used_at
      ) VALUES (
        v_store, v_customer, v_area,
        coalesce(v_val#>>'{deliveryArea,name}', 'Bairro'),
        btrim(_payload#>>'{address,street}'),
        nullif(btrim(coalesce(_payload#>>'{address,number}', '')), ''),
        coalesce((_payload#>>'{address,hasNoNumber}')::boolean, false),
        nullif(btrim(coalesce(_payload#>>'{address,complement}', '')), ''),
        nullif(btrim(coalesce(_payload#>>'{address,reference}', '')), ''),
        nullif(btrim(coalesce(_payload#>>'{address,label}', '')), ''),
        v_fp, now()
      ) RETURNING id INTO v_addr_id;
    ELSE
      UPDATE public.customer_addresses
         SET last_used_at = now(),
             reference = coalesce(nullif(btrim(coalesce(_payload#>>'{address,reference}', '')), ''), reference),
             updated_at = now()
       WHERE id = v_addr_id;
    END IF;

    SELECT jsonb_build_object(
             'neighborhoodId', a.neighborhood_id,
             'neighborhoodName', a.neighborhood_name,
             'street', a.street, 'number', a.number, 'hasNoNumber', a.has_no_number,
             'complement', a.complement, 'reference', a.reference, 'label', a.label
           ) INTO v_snapshot
      FROM public.customer_addresses a WHERE a.id = v_addr_id;
  END IF;

  -- Numeração sequencial por loja
  PERFORM pg_advisory_xact_lock(hashtextextended('order_number:' || v_store::text, 0));
  SELECT coalesce(max(o.order_number), 0) + 1 INTO v_number
    FROM public.orders o WHERE o.store_id = v_store;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  INSERT INTO public.orders (
    store_id, order_number, public_tracking_token, customer_id, customer_name,
    customer_phone, customer_phone_display, fulfillment, status, address_id,
    address_snapshot, neighborhood_id, neighborhood_snapshot, payment_method_id,
    payment_method_label, payment_method_kind, payment_instructions, payment_needs_change,
    change_for, items_subtotal, delivery_fee, discount_total, total_amount,
    minimum_order_amount, eta_minutes, customer_notes, idempotency_key, request_hash, source
  ) VALUES (
    v_store, v_number, v_token, v_customer, v_first,
    v_phone, nullif(btrim(v_phone_raw), ''), v_type::fulfillment_type, 'aguardando_confirmacao',
    v_addr_id, v_snapshot, CASE WHEN v_type = 'entrega' THEN v_area ELSE NULL END,
    CASE WHEN v_type = 'entrega' THEN v_val#>>'{deliveryArea,name}' ELSE NULL END,
    v_pm.id, v_pm.label, v_pm.kind::text, v_pm.instructions, v_pm.needs_change,
    v_change, 0, v_fee, 0, 0, v_min, v_eta, v_notes, v_key, v_hash, 'publico'
  ) RETURNING id INTO v_order;

  -- Itens recalculados
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) AS t(value)
  LOOP
    SELECT * INTO v_product FROM public.products p
     WHERE p.id = nullif(v_line->>'product_id', '')::uuid
       AND p.store_id = v_store AND NOT p.is_archived;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'line_unavailable',
                                'lineId', v_line->>'lineId', 'reason', 'unavailable');
    END IF;
    IF NOT v_product.is_available THEN
      RETURN jsonb_build_object('ok', false, 'error', 'line_unavailable',
                                'lineId', v_line->>'lineId', 'reason', 'out_of_stock');
    END IF;

    v_variant := NULL;
    IF nullif(v_line->>'variant_id', '') IS NOT NULL THEN
      SELECT * INTO v_variant FROM public.product_variants pv
       WHERE pv.id = (v_line->>'variant_id')::uuid AND pv.store_id = v_store
         AND pv.product_id = v_product.id AND pv.is_available AND NOT pv.is_archived;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'line_unavailable',
                                  'lineId', v_line->>'lineId', 'reason', 'invalid_configuration');
      END IF;
    END IF;

    SELECT coalesce(jsonb_agg(g), '[]'::jsonb) INTO v_grouped
    FROM (
      SELECT jsonb_build_object(
               'group_id', sel->>'option_group_id',
               'items', jsonb_agg(jsonb_build_object(
                 'item_id', sel->>'option_item_id',
                 'quantity', coalesce(nullif(sel->>'quantity','')::numeric, 1)
               ))
             ) AS g
        FROM jsonb_array_elements(coalesce(v_line->'selections', '[]'::jsonb)) AS sel
       WHERE sel->>'option_group_id' IS NOT NULL
       GROUP BY sel->>'option_group_id'
    ) s;

    v_qty := coalesce(nullif(v_line->>'quantity','')::numeric, 1);
    v_calc := private.calculate_configured_product_price(
      v_store, v_product.id, v_variant.id, v_qty, v_grouped
    );
    v_errs := coalesce(v_calc->'validation_errors', '[]'::jsonb);
    IF jsonb_array_length(v_errs) > 0 OR (v_calc->>'final_total') IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'line_unavailable',
                                'lineId', v_line->>'lineId', 'reason', 'invalid_configuration',
                                'validationErrors', v_errs);
    END IF;

    BEGIN
      v_unit := coalesce(v_product.measurement_unit::text, 'unidade')::public.pricing_unit;
    EXCEPTION WHEN OTHERS THEN
      v_unit := 'unidade';
    END;

    v_sort := v_sort + 1;
    INSERT INTO public.order_items (
      store_id, order_id, product_id, variant_id, product_name, variant_name,
      unit_price, quantity, pricing_unit, options_total, line_total, notes, sort_order
    ) VALUES (
      v_store, v_order, v_product.id, v_variant.id, v_product.name, v_variant.name,
      (v_calc->>'final_unit_price')::numeric, v_qty, v_unit,
      coalesce((v_calc->>'additive_groups_total')::numeric, 0),
      (v_calc->>'final_total')::numeric,
      nullif(btrim(coalesce(v_line->>'notes', '')), ''), v_sort
    ) RETURNING id INTO v_item;

    v_subtotal := v_subtotal + (v_calc->>'final_total')::numeric;

    FOR v_sel IN SELECT value FROM jsonb_array_elements(coalesce(v_line->'selections', '[]'::jsonb)) AS t(value)
    LOOP
      SELECT * INTO v_oi FROM public.option_items oi
       WHERE oi.id = nullif(v_sel->>'option_item_id', '')::uuid AND oi.store_id = v_store;
      CONTINUE WHEN NOT FOUND;
      SELECT * INTO v_og FROM public.option_groups og
       WHERE og.id = v_oi.option_group_id AND og.store_id = v_store;

      INSERT INTO public.order_item_options (
        store_id, order_item_id, option_group_id, option_item_id,
        group_name, option_name, additional_price, quantity
      ) VALUES (
        v_store, v_item, v_oi.option_group_id, v_oi.id,
        coalesce(v_og.name, 'Opção'), v_oi.name, v_oi.additional_price,
        greatest(1, coalesce(nullif(v_sel->>'quantity','')::int, 1))
      );
    END LOOP;
  END LOOP;

  v_subtotal := private.money(v_subtotal);

  IF v_min > 0 AND v_subtotal < v_min THEN
    RETURN jsonb_build_object('ok', false, 'error', 'minimum_not_met',
                              'minimumOrderAmount', v_min, 'itemsSubtotal', v_subtotal);
  END IF;

  UPDATE public.orders
     SET items_subtotal = v_subtotal,
         total_amount = private.money(v_subtotal + v_fee),
         updated_at = now()
   WHERE id = v_order;

  INSERT INTO public.order_status_history (store_id, order_id, from_status, to_status, actor_kind, reason)
  VALUES (v_store, v_order, NULL, 'aguardando_confirmacao', 'cliente', 'pedido enviado pelo cardápio público');

  RETURN jsonb_build_object(
    'ok', true, 'replayed', false,
    'order', jsonb_build_object(
      'id', v_order,
      'orderNumber', v_number,
      'trackingToken', v_token,
      'status', 'aguardando_confirmacao',
      'itemsSubtotal', v_subtotal,
      'deliveryFee', v_fee,
      'total', private.money(v_subtotal + v_fee),
      'etaMinutes', v_eta
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.storefront_submit_order(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storefront_submit_order(text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storefront_submit_order(text, jsonb) TO service_role;