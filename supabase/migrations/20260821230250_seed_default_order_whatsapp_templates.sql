create or replace function private.seed_default_order_whatsapp_templates(_store_id uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
begin
  insert into public.store_message_templates(
    store_id,code,name,channel,purpose,body,provider_language,provider_status,is_active
  )
  select _store_id,v.code,v.name,'whatsapp','transactional',v.body,'pt_BR','draft',true
  from (values
    ('pedido_criado','Pedido recebido','Olá {{1}}! Recebemos seu pedido #{{2}} na {{3}}. Total: {{4}}. Assim que a loja confirmar, avisamos por aqui.'),
    ('pedido_aceito','Pedido confirmado','Pedido #{{1}} confirmado ✅ Previsão: {{2}}. Estamos cuidando de tudo por aqui.'),
    ('pedido_em_preparo','Pedido em preparo','Seu pedido #{{1}} entrou em preparo 🍳. Avisamos quando estiver pronto.'),
    ('pedido_pronto','Pedido pronto','Seu pedido #{{1}} está pronto ✅. Estamos organizando a próxima etapa.'),
    ('pedido_aguardando_entregador','Aguardando entregador','Seu pedido #{{1}} está pronto e aguardando um entregador. Assim que sair, avisamos por aqui.'),
    ('pedido_saiu_para_entrega','Saiu para entrega','Seu pedido #{{1}} saiu para entrega 🛵. Fique de olho no celular e aguarde o entregador.'),
    ('pedido_aguardando_retirada','Pronto para retirada','Seu pedido #{{1}} está pronto para retirada na {{2}}. Pode vir buscar 😊'),
    ('pedido_entregue','Pedido entregue','Pedido #{{1}} entregue ✅ Obrigado por escolher a {{2}}!'),
    ('pedido_retirado','Pedido retirado','Pedido #{{1}} retirado ✅ Obrigado por escolher a {{2}}!'),
    ('pedido_recusado','Pedido não aceito','Não conseguimos aceitar o pedido #{{1}} desta vez. Se precisar, fale com a {{2}}.'),
    ('pedido_cancelado','Pedido cancelado','O pedido #{{1}} foi cancelado. Se precisar de ajuda, fale com a {{2}}.'),
    ('pedido_concluido','Pedido concluído','Pedido #{{1}} concluído ✅ Obrigado pela preferência e por escolher a {{2}}!')
  ) as v(code,name,body)
  on conflict (store_id,code) do nothing;
end;
$$;

create or replace function private.seed_default_order_whatsapp_templates_on_store()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
begin
  perform private.seed_default_order_whatsapp_templates(new.id);
  return new;
end;
$$;

revoke all on function private.seed_default_order_whatsapp_templates(uuid) from public,anon,authenticated;
revoke all on function private.seed_default_order_whatsapp_templates_on_store() from public,anon,authenticated;

drop trigger if exists trg_seed_default_order_whatsapp_templates on public.stores;
create trigger trg_seed_default_order_whatsapp_templates
after insert on public.stores
for each row execute function private.seed_default_order_whatsapp_templates_on_store();

do $$
declare
  r record;
begin
  for r in select id from public.stores loop
    perform private.seed_default_order_whatsapp_templates(r.id);
  end loop;
end;
$$;
