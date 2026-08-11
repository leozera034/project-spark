-- SHARK — integridade relacional completa para escolhas de combo.
-- Uma variação vinculada só é válida quando pertence exatamente ao produto vinculado
-- e ao mesmo estabelecimento. A regra fica no banco para não depender apenas das RPCs.

-- Necessário para a FK composta abaixo. `id` já é único, portanto este índice não
-- muda a cardinalidade; apenas fornece uma chave candidata explícita ao PostgreSQL.
create unique index if not exists product_variants_id_product_store_uidx
  on public.product_variants(id, product_id, store_id);

-- Impede estados semanticamente incompletos, inclusive inserts administrativos diretos.
alter table public.option_items
  drop constraint if exists option_items_linked_variant_requires_product_check;
alter table public.option_items
  add constraint option_items_linked_variant_requires_product_check
  check (linked_variant_id is null or linked_product_id is not null);

-- Substitui a FK variante+loja por uma FK que também prova que a variante pertence
-- ao produto selecionado. Isso fecha a brecha de inconsistência fora de create_combo_choice().
alter table public.option_items
  drop constraint if exists option_items_linked_variant_same_store_fk;
alter table public.option_items
  drop constraint if exists option_items_linked_variant_product_store_fk;
alter table public.option_items
  add constraint option_items_linked_variant_product_store_fk
  foreign key (linked_variant_id, linked_product_id, store_id)
  references public.product_variants(id, product_id, store_id)
  on delete restrict;

comment on constraint option_items_linked_variant_product_store_fk on public.option_items is
  'SHARK: garante que a variante de uma escolha de combo pertence ao produto vinculado e ao mesmo tenant.';
