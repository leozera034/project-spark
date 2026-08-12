-- SHARK — consolida os perfis restantes sem criar frontends separados.
-- Categoria define apenas defaults/templates; o comportamento final continua no produto.

update public.category_profiles
set default_capabilities = '{"sizes":true,"flavors":true,"option_groups":true,"toppings":true,"containers":true,"add_ons":true,"portions":true,"icecream_experience":true}'::jsonb,
    product_templates = '[
      {"type":"buildable","label":"Sorvete montável","capabilities":{"sizes":true,"flavors":true,"portions":true,"toppings":true,"containers":true,"add_ons":true,"icecream_experience":true}},
      {"type":"simple","label":"Picolé / item simples","capabilities":{}}
    ]'::jsonb,
    updated_at=now()
where code='sorveteria';

update public.category_profiles
set default_capabilities = '{"sizes":true,"flavors":true,"multi_flavor":true,"option_groups":true,"add_ons":true,"combos":true,"beverages":true,"pastry_experience":true}'::jsonb,
    product_templates = '[
      {"type":"flavors","label":"Pastel por sabor","capabilities":{"sizes":true,"flavors":true,"add_ons":true,"pastry_experience":true}},
      {"type":"buildable","label":"Pastel montável","capabilities":{"sizes":true,"flavors":true,"multi_flavor":true,"add_ons":true,"pastry_experience":true}},
      {"type":"combo","label":"Combo de pastel","capabilities":{"combo_steps":true,"beverages":true}}
    ]'::jsonb,
    updated_at=now()
where code='pastelaria';

update public.category_profiles
set default_capabilities = '{"volume":true,"packages":true,"variants":true,"flavors":true,"kits":true,"combos":true,"option_groups":true,"ice":true,"add_ons":true,"beverage_experience":true}'::jsonb,
    product_templates = '[
      {"type":"variant","label":"Bebida com volumes","capabilities":{"volume":true,"variants":true,"flavors":true,"ice":true,"add_ons":true,"beverage_experience":true}},
      {"type":"kit","label":"Kit / fardo","capabilities":{"packages":true,"kits":true,"beverage_experience":true}},
      {"type":"combo","label":"Combo de bebidas","capabilities":{"combo_steps":true,"beverage_experience":true}}
    ]'::jsonb,
    updated_at=now()
where code='adega';

update public.category_profiles
set default_capabilities = '{"simple":true,"measured":true,"stock":true,"variants":true,"packages":true,"kits":true,"combos":true,"catalog_experience":true}'::jsonb,
    product_templates = '[
      {"type":"simple","label":"Produto simples","capabilities":{"stock":true,"catalog_experience":true}},
      {"type":"measured","label":"Por peso / volume","capabilities":{"measured":true,"stock":true,"catalog_experience":true}},
      {"type":"variant","label":"Produto com variações","capabilities":{"variants":true,"stock":true,"catalog_experience":true}},
      {"type":"kit","label":"Kit / pacote","capabilities":{"kits":true,"packages":true,"stock":true,"catalog_experience":true}}
    ]'::jsonb,
    updated_at=now()
where code='mercado';
