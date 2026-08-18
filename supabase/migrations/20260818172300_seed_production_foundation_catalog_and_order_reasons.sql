-- Production foundation only.
-- No users, stores, orders, catalog items, couriers, payments, or QA/demo tenants.
-- Intentionally excludes the R$99/R$189/R$299 validation plans from
-- 20260731014502_2f37f022-842c-4223-b232-fa7783c52d75.sql because that migration
-- explicitly marks them as development validation data, not production data.

INSERT INTO public.order_transition_reasons
  (code, internal_label, public_message, applies_reject, applies_cancel, is_active, sort_order)
VALUES
  ('store_unavailable',    'Loja indisponível no momento',        'A loja não pôde atender este pedido agora.',            true,  true,  true, 10),
  ('item_unavailable',     'Item sem disponibilidade',            'Um item do pedido ficou indisponível.',                 true,  true,  true, 20),
  ('delivery_unavailable', 'Entrega indisponível para o endereço','Não foi possível entregar no endereço informado.',    true,  true,  true, 30),
  ('unable_to_prepare',    'Não foi possível preparar',           'A loja não conseguiu preparar este pedido.',            true,  true,  true, 40),
  ('customer_request',     'Pedido do cliente',                   'O pedido foi cancelado a pedido do cliente.',           false, true,  true, 50),
  ('duplicate_order',      'Pedido duplicado',                    'Este pedido foi identificado como duplicado.',          true,  true,  true, 60),
  ('payment_issue',        'Problema com o pagamento',            'Houve um problema com a forma de pagamento escolhida.', true,  true,  true, 70),
  ('other',                'Outro motivo',                        'A loja não pôde seguir com este pedido.',               true,  true,  true, 90)
ON CONFLICT (code) DO UPDATE SET
  internal_label = EXCLUDED.internal_label,
  public_message = EXCLUDED.public_message,
  applies_reject = EXCLUDED.applies_reject,
  applies_cancel = EXCLUDED.applies_cancel,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.category_profiles
  (code, name, description, icon, default_capabilities, product_templates, is_active, sort_order)
VALUES
  ('pizzaria','Pizzaria','Pizzas, sabores, tamanhos, bordas e montagem.','pizza',
   '{"combos":true,"crust":true,"dough":true,"flavors":true,"multi_flavor":true,"option_groups":true,"removals":true,"sizes":true}'::jsonb,
   '[{"capabilities":{"add_ons":true,"crust":true,"dough":true,"flavors":true,"multi_flavor":true,"sizes":true},"label":"Pizza","type":"multi_flavor"},{"capabilities":{},"label":"Bebida","type":"simple"}]'::jsonb,true,10),
  ('hamburgueria','Hamburgueria','Hambúrgueres, adicionais, ponto, pães, molhos e combos.','burger',
   '{"beverages":true,"bread":true,"combos":true,"doneness":true,"option_groups":true,"proteins":true,"removals":true,"sauces":true,"sides":true,"sizes":true}'::jsonb,
   '[{"capabilities":{"add_ons":true,"beverages":true,"bread":true,"burger_experience":true,"doneness":true,"proteins":true,"removals":true,"sauces":true,"sides":true},"label":"Hambúrguer / lanche montável","type":"buildable"},{"capabilities":{"beverages":true,"combo_steps":true,"sides":true},"label":"Combo de lanche","type":"combo"},{"capabilities":{},"label":"Bebida","type":"simple"}]'::jsonb,true,20),
  ('acai','Açaí','Tamanhos, cremes, frutas, coberturas e complementos incluídos.','cup-soda',
   '{"add_ons":true,"buildable":true,"creams":true,"fruits":true,"included_choices":true,"option_groups":true,"sizes":true,"toppings":true}'::jsonb,
   '[{"capabilities":{"add_ons":true,"creams":true,"fruits":true,"included_choices":true,"sizes":true,"toppings":true},"label":"Açaí montável","type":"buildable"}]'::jsonb,true,30),
  ('sorveteria','Sorveteria','Bolas, sabores, coberturas, copo/casquinha e adicionais.','ice-cream-bowl',
   '{"add_ons":true,"containers":true,"flavors":true,"icecream_experience":true,"option_groups":true,"portions":true,"sizes":true,"toppings":true}'::jsonb,
   '[{"capabilities":{"add_ons":true,"containers":true,"flavors":true,"icecream_experience":true,"portions":true,"sizes":true,"toppings":true},"label":"Sorvete montável","type":"buildable"},{"capabilities":{},"label":"Picolé / item simples","type":"simple"}]'::jsonb,true,40),
  ('restaurante','Marmitaria / Restaurante','Pratos, marmitas, proteínas, acompanhamentos e prato do dia.','utensils',
   '{"add_ons":true,"beverages":true,"buildable":true,"combos":true,"option_groups":true,"proteins":true,"removals":true,"sides":true,"sizes":true}'::jsonb,
   '[{"capabilities":{"add_ons":true,"beverages":true,"meal_experience":true,"proteins":true,"removals":true,"sides":true,"sizes":true},"label":"Marmita montável","type":"buildable"},{"capabilities":{},"label":"Prato do dia","type":"simple"},{"capabilities":{"beverages":true,"combo_steps":true},"label":"Combo refeição","type":"combo"}]'::jsonb,true,50),
  ('lanchonete','Lanchonete','Lanches, adicionais, acompanhamentos, bebidas e combos.','sandwich',
   '{"add_ons":true,"beverages":true,"bread":true,"combos":true,"flavors":true,"option_groups":true,"proteins":true,"removals":true,"sauces":true,"sides":true,"sizes":true}'::jsonb,
   '[{"capabilities":{"add_ons":true,"beverages":true,"bread":true,"burger_experience":true,"proteins":true,"removals":true,"sauces":true,"sides":true},"label":"Lanche montável","type":"buildable"},{"capabilities":{"beverages":true,"combo_steps":true,"sides":true},"label":"Combo","type":"combo"},{"capabilities":{},"label":"Produto simples","type":"simple"}]'::jsonb,true,60),
  ('pastelaria','Pastelaria','Sabores, tamanhos, montagem e combos.','cookie',
   '{"add_ons":true,"beverages":true,"combos":true,"flavors":true,"multi_flavor":true,"option_groups":true,"pastry_experience":true,"sizes":true}'::jsonb,
   '[{"capabilities":{"add_ons":true,"flavors":true,"pastry_experience":true,"sizes":true},"label":"Pastel por sabor","type":"flavors"},{"capabilities":{"add_ons":true,"flavors":true,"multi_flavor":true,"pastry_experience":true,"sizes":true},"label":"Pastel montável","type":"buildable"},{"capabilities":{"beverages":true,"combo_steps":true},"label":"Combo de pastel","type":"combo"}]'::jsonb,true,70),
  ('adega','Bebidas / Adega','Volume, embalagem, kits, sabores, gelo e complementos.','wine',
   '{"add_ons":true,"beverage_experience":true,"combos":true,"flavors":true,"ice":true,"kits":true,"option_groups":true,"packages":true,"variants":true,"volume":true}'::jsonb,
   '[{"capabilities":{"add_ons":true,"beverage_experience":true,"flavors":true,"ice":true,"variants":true,"volume":true},"label":"Bebida com volumes","type":"variant"},{"capabilities":{"beverage_experience":true,"kits":true,"packages":true},"label":"Kit / fardo","type":"kit"},{"capabilities":{"beverage_experience":true,"combo_steps":true},"label":"Combo de bebidas","type":"combo"}]'::jsonb,true,80),
  ('mercado','Padaria / Conveniência / Mercado','Produtos simples, peso/volume, estoque, variações e kits.','shopping-basket',
   '{"catalog_experience":true,"combos":true,"kits":true,"measured":true,"packages":true,"simple":true,"stock":true,"variants":true}'::jsonb,
   '[{"capabilities":{"catalog_experience":true,"stock":true},"label":"Produto simples","type":"simple"},{"capabilities":{"catalog_experience":true,"measured":true,"stock":true},"label":"Por peso / volume","type":"measured"},{"capabilities":{"catalog_experience":true,"stock":true,"variants":true},"label":"Produto com variações","type":"variant"},{"capabilities":{"catalog_experience":true,"kits":true,"packages":true,"stock":true},"label":"Kit / pacote","type":"kit"}]'::jsonb,true,90)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  default_capabilities = EXCLUDED.default_capabilities,
  product_templates = EXCLUDED.product_templates,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
