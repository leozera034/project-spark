alter type public.delivery_status add value if not exists 'retornando_loja' after 'em_rota';
alter type public.delivery_status add value if not exists 'devolvida_loja' after 'retornando_loja';
alter type public.delivery_event_type add value if not exists 'inicio_retorno' after 'tentativa_falha';
alter type public.delivery_event_type add value if not exists 'devolucao_loja' after 'inicio_retorno';
