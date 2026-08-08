begin;

set local search_path = public, private, extensions, pg_temp;

select plan(25);

-- ---------------------------------------------------------------------
-- Contrato de exposição da RPC
-- ---------------------------------------------------------------------
select ok(
  has_function_privilege('service_role', 'public.storefront_submit_order(text,jsonb)', 'EXECUTE'),
  'service_role pode executar storefront_submit_order'
);
select ok(
  not has_function_privilege('anon', 'public.storefront_submit_order(text,jsonb)', 'EXECUTE'),
  'anon nao pode executar storefront_submit_order diretamente'
);
select ok(
  not has_function_privilege('authenticated', 'public.storefront_submit_order(text,jsonb)', 'EXECUTE'),
  'authenticated nao pode executar storefront_submit_order diretamente'
);

-- ---------------------------------------------------------------------
-- Fixtures deterministicas ja criadas pelas migrations de desenvolvimento
-- ---------------------------------------------------------------------
create temp table checkout_test_context as
select
  s.id as store_id,
  (select pm.id
     from public.payment_methods pm
    where pm.store_id = s.id and pm.kind = 'pix' and pm.is_active
    order by pm.sort_order, pm.id
    limit 1) as payment_id,
  (select n.id
     from public.neighborhoods n
    where n.store_id = s.id and n.name = 'Centro' and n.is_active and not n.is_archived
    limit 1) as area_id,
  (select p.id
     from public.products p
    where p.store_id = s.id and p.name = 'Clássico da Casa' and not p.is_archived
    limit 1) as burger_id,
  (select p.id
     from public.products p
    where p.store_id = s.id and p.name = 'Refrigerante lata 350ml' and not p.is_archived
    limit 1) as soda_id
from public.stores s
where s.slug = 'brasa-urbana';

select ok(
  exists (
    select 1
      from checkout_test_context
     where store_id is not null
       and payment_id is not null
       and area_id is not null
       and burger_id is not null
       and soda_id is not null
  ),
  'fixtures de checkout da Brasa Urbana estao disponiveis'
);

-- Evita dependencia do horario do runner. A alteracao e revertida ao fim do teste.
update public.store_settings
   set manual_override_open = true
 where store_id = (select store_id from checkout_test_context);

create temp table checkout_test_cases (
  name text primary key,
  payload jsonb not null,
  result jsonb,
  order_id uuid
);

-- ---------------------------------------------------------------------
-- 1) Falha tardia por produto inexistente.
-- A implementacao historica ja tinha criado customer + order neste ponto.
-- O wrapper deve reverter tudo.
-- ---------------------------------------------------------------------
insert into checkout_test_cases (name, payload)
select
  'invalid-product',
  jsonb_build_object(
    'idempotencyKey', 'p0-invalid-product-0001',
    'customer', jsonb_build_object('firstName', 'Teste', 'phone', '11999990001'),
    'fulfillment', jsonb_build_object(
      'type', 'retirada',
      'deliveryAreaId', null,
      'configurationVersion', null
    ),
    'address', null,
    'payment', jsonb_build_object('methodId', c.payment_id, 'changeFor', null),
    'notes', null,
    'lines', jsonb_build_array(
      jsonb_build_object(
        'lineId', 'line-invalid-product',
        'product_id', 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        'variant_id', null,
        'quantity', 1,
        'notes', null,
        'selections', '[]'::jsonb
      )
    )
  )
from checkout_test_context c;

update checkout_test_cases
   set result = public.storefront_submit_order('brasa-urbana', payload)
 where name = 'invalid-product';

select is(
  (select result->>'error' from checkout_test_cases where name = 'invalid-product'),
  'line_unavailable',
  'produto inexistente retorna line_unavailable'
);
select is(
  (select count(*) from public.customers where phone = '11999990001'),
  0::bigint,
  'falha tardia nao persiste customer'
);
select is(
  (select count(*) from public.orders where idempotency_key = 'p0-invalid-product-0001'),
  0::bigint,
  'falha tardia nao persiste order parcial'
);

-- ---------------------------------------------------------------------
-- 2) Pedido abaixo do minimo.
-- Aqui order e order_item ja foram escritos pela implementacao historica.
-- O retorno soft deve reverter ambos.
-- ---------------------------------------------------------------------
insert into checkout_test_cases (name, payload)
select
  'minimum-not-met',
  jsonb_build_object(
    'idempotencyKey', 'p0-minimum-not-met-0001',
    'customer', jsonb_build_object('firstName', 'Teste', 'phone', '11999990002'),
    'fulfillment', jsonb_build_object(
      'type', 'entrega',
      'deliveryAreaId', c.area_id,
      'configurationVersion', null
    ),
    'address', jsonb_build_object(
      'street', 'Rua Teste',
      'number', '10',
      'hasNoNumber', false,
      'complement', null,
      'reference', null,
      'label', 'Casa'
    ),
    'payment', jsonb_build_object('methodId', c.payment_id, 'changeFor', null),
    'notes', null,
    'lines', jsonb_build_array(
      jsonb_build_object(
        'lineId', 'line-minimum',
        'product_id', c.soda_id,
        'variant_id', null,
        'quantity', 1,
        'notes', null,
        'selections', '[]'::jsonb
      )
    )
  )
from checkout_test_context c;

update checkout_test_cases
   set result = public.storefront_submit_order('brasa-urbana', payload)
 where name = 'minimum-not-met';

select is(
  (select result->>'error' from checkout_test_cases where name = 'minimum-not-met'),
  'minimum_not_met',
  'subtotal abaixo do minimo retorna minimum_not_met'
);
select is(
  (select count(*) from public.customers where phone = '11999990002'),
  0::bigint,
  'minimum_not_met nao persiste customer'
);
select is(
  (select count(*) from public.orders where idempotency_key = 'p0-minimum-not-met-0001'),
  0::bigint,
  'minimum_not_met nao persiste order nem seus itens'
);

-- ---------------------------------------------------------------------
-- 3) Pedido valido + persistencia estrutural + token somente em hash.
-- ---------------------------------------------------------------------
insert into checkout_test_cases (name, payload)
select
  'valid',
  jsonb_build_object(
    'idempotencyKey', 'p0-valid-order-0001',
    'customer', jsonb_build_object('firstName', 'Teste', 'phone', '11999990003'),
    'fulfillment', jsonb_build_object(
      'type', 'entrega',
      'deliveryAreaId', c.area_id,
      'configurationVersion', null
    ),
    'address', jsonb_build_object(
      'street', 'Rua Teste',
      'number', '20',
      'hasNoNumber', false,
      'complement', 'Apto 1',
      'reference', 'Portao preto',
      'label', 'Casa'
    ),
    'payment', jsonb_build_object('methodId', c.payment_id, 'changeFor', null),
    'notes', 'pedido de teste atomico',
    'lines', jsonb_build_array(
      jsonb_build_object(
        'lineId', 'line-valid',
        'product_id', c.burger_id,
        'variant_id', null,
        'quantity', 1,
        'notes', null,
        'selections', '[]'::jsonb
      )
    )
  )
from checkout_test_context c;

update checkout_test_cases
   set result = public.storefront_submit_order('brasa-urbana', payload)
 where name = 'valid';

update checkout_test_cases
   set order_id = nullif(result#>>'{order,id}', '')::uuid
 where name = 'valid';

select ok(
  (select result->>'ok' = 'true' and coalesce((result->>'replayed')::boolean, false) = false
     from checkout_test_cases where name = 'valid'),
  'pedido valido e criado na primeira tentativa'
);
select is(
  (select count(*) from public.orders where idempotency_key = 'p0-valid-order-0001'),
  1::bigint,
  'pedido valido persiste exatamente um order'
);
select is(
  (select count(*)
     from public.order_items oi
    where oi.order_id = (select order_id from checkout_test_cases where name = 'valid')),
  1::bigint,
  'pedido valido persiste item congelado'
);
select is(
  (select count(*)
     from public.order_status_history h
    where h.order_id = (select order_id from checkout_test_cases where name = 'valid')
      and h.to_status = 'aguardando_confirmacao'),
  1::bigint,
  'pedido valido persiste historico inicial'
);
select ok(
  (select o.public_tracking_token is null and length(o.tracking_token_hash) = 64
     from public.orders o
    where o.id = (select order_id from checkout_test_cases where name = 'valid')),
  'token bruto nunca fica persistido e hash SHA-256 existe'
);
select ok(
  length(coalesce((select result#>>'{order,trackingToken}' from checkout_test_cases where name = 'valid'), '')) >= 32,
  'primeira resposta devolve capacidade de tracking utilizavel'
);

-- ---------------------------------------------------------------------
-- 4) Replay idempotente: mesmo pedido, sem duplicacao, novo token seguro.
-- ---------------------------------------------------------------------
insert into checkout_test_cases (name, payload)
select 'replay', payload from checkout_test_cases where name = 'valid';

update checkout_test_cases
   set result = public.storefront_submit_order('brasa-urbana', payload)
 where name = 'replay';

update checkout_test_cases
   set order_id = nullif(result#>>'{order,id}', '')::uuid
 where name = 'replay';

select ok(
  (select result->>'ok' = 'true' and (result->>'replayed')::boolean
     from checkout_test_cases where name = 'replay'),
  'mesma chave e mesmo payload retornam replay idempotente'
);
select is(
  (select order_id from checkout_test_cases where name = 'replay'),
  (select order_id from checkout_test_cases where name = 'valid'),
  'replay devolve o mesmo order_id'
);
select is(
  (select count(*) from public.orders where idempotency_key = 'p0-valid-order-0001'),
  1::bigint,
  'replay nao duplica order'
);
select ok(
  length(coalesce((select result#>>'{order,trackingToken}' from checkout_test_cases where name = 'replay'), '')) >= 32,
  'replay reemite capacidade de tracking'
);
select ok(
  (select
     o.public_tracking_token is null
     and o.tracking_token_hash = encode(
       sha256(convert_to((select result#>>'{order,trackingToken}' from checkout_test_cases where name = 'replay'), 'UTF8')),
       'hex'
     )
   from public.orders o
   where o.id = (select order_id from checkout_test_cases where name = 'replay')),
  'token reemitido e armazenado somente como hash correspondente'
);

-- ---------------------------------------------------------------------
-- 5) Mesma chave com payload diferente = conflito, sem nova escrita.
-- ---------------------------------------------------------------------
insert into checkout_test_cases (name, payload)
select 'conflict', jsonb_set(payload, '{notes}', to_jsonb('payload alterado'::text), true)
  from checkout_test_cases where name = 'valid';

update checkout_test_cases
   set result = public.storefront_submit_order('brasa-urbana', payload)
 where name = 'conflict';

select is(
  (select result->>'error' from checkout_test_cases where name = 'conflict'),
  'idempotency_conflict',
  'mesma chave com payload diferente retorna conflito'
);
select is(
  (select count(*) from public.orders where idempotency_key = 'p0-valid-order-0001'),
  1::bigint,
  'conflito nao cria pedido adicional'
);

-- ---------------------------------------------------------------------
-- 6) Replay legado incompleto nunca pode virar sucesso.
-- Cria um pedido legitimo e remove os marcadores que so existem apos sucesso.
-- ---------------------------------------------------------------------
insert into checkout_test_cases (name, payload)
select
  'legacy-source',
  jsonb_set(
    jsonb_set(payload, '{idempotencyKey}', to_jsonb('p0-legacy-partial-0001'::text), true),
    '{customer,phone}',
    to_jsonb('11999990004'::text),
    true
  )
from checkout_test_cases where name = 'valid';

update checkout_test_cases
   set result = public.storefront_submit_order('brasa-urbana', payload)
 where name = 'legacy-source';

update checkout_test_cases
   set order_id = nullif(result#>>'{order,id}', '')::uuid
 where name = 'legacy-source';

select ok(
  (select result->>'ok' = 'true' from checkout_test_cases where name = 'legacy-source'),
  'fixture de pedido legado nasce como pedido valido'
);

delete from public.order_status_history
 where order_id = (select order_id from checkout_test_cases where name = 'legacy-source');
delete from public.order_items
 where order_id = (select order_id from checkout_test_cases where name = 'legacy-source');

insert into checkout_test_cases (name, payload)
select 'legacy-replay', payload from checkout_test_cases where name = 'legacy-source';

update checkout_test_cases
   set result = public.storefront_submit_order('brasa-urbana', payload)
 where name = 'legacy-replay';

select is(
  (select result->>'error' from checkout_test_cases where name = 'legacy-replay'),
  'idempotency_incomplete_order',
  'pedido parcial legado e recusado no replay'
);
select is(
  (select count(*) from public.orders where idempotency_key = 'p0-legacy-partial-0001'),
  1::bigint,
  'deteccao do legado nao cria outro pedido'
);

select * from finish();
rollback;
