DELETE FROM public.order_item_options oio
 USING public.order_items oi, public.orders o
 WHERE oio.order_item_id = oi.id AND oi.order_id = o.id AND o.source = 'publico';

DELETE FROM public.order_items oi
 USING public.orders o
 WHERE oi.order_id = o.id AND o.source = 'publico';

DELETE FROM public.order_status_history h
 USING public.orders o
 WHERE h.order_id = o.id AND o.source = 'publico';

DELETE FROM public.orders WHERE source = 'publico';

UPDATE public.store_settings SET manual_override_open = NULL;