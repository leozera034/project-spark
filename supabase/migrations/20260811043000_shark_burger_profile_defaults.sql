-- SHARK — defaults mais claros para hamburgueria/lanchonete.
-- Continua configurável: categoria sugere, produto decide.

update public.category_profiles
set
  default_capabilities = default_capabilities || '{"proteins":true,"beverages":true}'::jsonb,
  product_templates = '[
    {"type":"buildable","label":"Hambúrguer / lanche montável","capabilities":{"bread":true,"proteins":true,"doneness":true,"sauces":true,"add_ons":true,"removals":true,"sides":true,"beverages":true}},
    {"type":"combo","label":"Combo de lanche","capabilities":{"combo_steps":true,"beverages":true,"sides":true}},
    {"type":"simple","label":"Bebida","capabilities":{}}
  ]'::jsonb,
  updated_at = now()
where code='hamburgueria';

update public.category_profiles
set
  default_capabilities = default_capabilities || '{"bread":true,"proteins":true,"sauces":true}'::jsonb,
  product_templates = '[
    {"type":"buildable","label":"Lanche montável","capabilities":{"bread":true,"proteins":true,"sauces":true,"add_ons":true,"removals":true,"sides":true,"beverages":true}},
    {"type":"combo","label":"Combo","capabilities":{"combo_steps":true,"beverages":true,"sides":true}},
    {"type":"simple","label":"Produto simples","capabilities":{}}
  ]'::jsonb,
  updated_at = now()
where code='lanchonete';
