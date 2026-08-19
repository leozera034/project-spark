alter table public.store_automation_rules
  drop constraint if exists store_automation_rules_event_code_check;

alter table public.store_automation_rules
  add constraint store_automation_rules_event_code_check
  check (event_code = any (array[
    'novo_cliente'::text,
    'pedido_criado'::text,
    'pedido_aceito'::text,
    'pedido_em_preparo'::text,
    'pedido_pronto'::text,
    'pedido_aguardando_entregador'::text,
    'pedido_saiu_para_entrega'::text,
    'pedido_aguardando_retirada'::text,
    'pedido_entregue'::text,
    'pedido_retirado'::text,
    'pedido_recusado'::text,
    'pedido_cancelado'::text,
    'pedido_concluido'::text,
    'cliente_inativo_30d'::text,
    'cliente_vip'::text
  ]));
