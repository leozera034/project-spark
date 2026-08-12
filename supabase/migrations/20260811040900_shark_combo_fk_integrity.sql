-- SHARK — integridade forte para referências de produtos/variações em combos.
-- Evita ON DELETE SET NULL em FK composta, que poderia tentar zerar store_id obrigatório.

alter table public.option_items
  drop constraint if exists option_items_linked_product_same_store_fk;

alter table public.option_items
  add constraint option_items_linked_product_same_store_fk
  foreign key (linked_product_id, store_id)
  references public.products(id, store_id)
  on delete restrict;

alter table public.option_items
  drop constraint if exists option_items_linked_variant_same_store_fk;

alter table public.option_items
  add constraint option_items_linked_variant_same_store_fk
  foreign key (linked_variant_id, store_id)
  references public.product_variants(id, store_id)
  on delete restrict;
