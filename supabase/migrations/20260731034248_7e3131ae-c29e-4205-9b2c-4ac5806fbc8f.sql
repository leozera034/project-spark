-- ============================================================
-- FASE 10 — Estrutura do catálogo avançado
-- ============================================================

-- ---------- Produtos ----------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sale_mode        public.product_sale_mode NOT NULL DEFAULT 'unit',
  ADD COLUMN IF NOT EXISTS measurement_unit public.measurement_unit  NOT NULL DEFAULT 'unit';

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sale_mode_unit_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_sale_mode_unit_check
  CHECK (
    (sale_mode = 'measured' AND measurement_unit <> 'unit')
    OR (sale_mode <> 'measured')
  );

-- ---------- Variações ----------
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS is_archived      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at      timestamptz,
  ADD COLUMN IF NOT EXISTS package_quantity numeric(10,3),
  ADD COLUMN IF NOT EXISTS package_unit     public.measurement_unit;

ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_name_length_check;
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_name_length_check
  CHECK (char_length(btrim(name)) BETWEEN 1 AND 80);

ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_price_scale_check;
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_price_scale_check
  CHECK (price >= 0 AND price <= 999999.99 AND scale(price) <= 2);

ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_package_check;
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_package_check
  CHECK (
    (package_quantity IS NULL AND package_unit IS NULL)
    OR (package_quantity > 0 AND package_unit IS NOT NULL AND package_unit <> 'unit')
  );

DROP INDEX IF EXISTS public.product_variants_name_normalized_unique;
CREATE UNIQUE INDEX product_variants_name_normalized_unique
  ON public.product_variants (product_id, public.normalize_label(name))
  WHERE NOT is_archived;

DROP INDEX IF EXISTS public.product_variants_single_default_idx;
CREATE UNIQUE INDEX product_variants_single_default_idx
  ON public.product_variants (product_id)
  WHERE is_default AND is_available AND NOT is_archived;

CREATE INDEX IF NOT EXISTS product_variants_store_product_active_idx
  ON public.product_variants (store_id, product_id, is_available, is_archived, sort_order);

DROP TRIGGER IF EXISTS product_variants_stamp_archived_at ON public.product_variants;
CREATE TRIGGER product_variants_stamp_archived_at
  BEFORE INSERT OR UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.stamp_archived_at();

-- ---------- Grupos de opções ----------
ALTER TABLE public.option_groups
  ADD COLUMN IF NOT EXISTS pricing_strategy public.option_group_pricing_strategy NOT NULL DEFAULT 'sum',
  ADD COLUMN IF NOT EXISTS price_effect     public.option_group_price_effect     NOT NULL DEFAULT 'additive',
  ADD COLUMN IF NOT EXISTS portion_count    integer,
  ADD COLUMN IF NOT EXISTS is_active        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_archived      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at      timestamptz;

ALTER TABLE public.option_groups DROP CONSTRAINT IF EXISTS option_groups_name_unique;
DROP INDEX IF EXISTS public.option_groups_name_normalized_unique;
CREATE UNIQUE INDEX option_groups_name_normalized_unique
  ON public.option_groups (store_id, public.normalize_label(name))
  WHERE NOT is_archived;

ALTER TABLE public.option_groups DROP CONSTRAINT IF EXISTS option_groups_name_length_check;
ALTER TABLE public.option_groups
  ADD CONSTRAINT option_groups_name_length_check
  CHECK (char_length(btrim(name)) BETWEEN 2 AND 80);

ALTER TABLE public.option_groups DROP CONSTRAINT IF EXISTS option_groups_portion_check;
ALTER TABLE public.option_groups
  ADD CONSTRAINT option_groups_portion_check
  CHECK (portion_count IS NULL OR (portion_count BETWEEN 2 AND 8));

ALTER TABLE public.option_groups DROP CONSTRAINT IF EXISTS option_groups_single_portion_check;
ALTER TABLE public.option_groups
  ADD CONSTRAINT option_groups_single_portion_check
  CHECK (selection_type <> 'unica' OR portion_count IS NULL);

CREATE INDEX IF NOT EXISTS option_groups_store_active_idx
  ON public.option_groups (store_id, is_archived, is_active, sort_order, name);

DROP TRIGGER IF EXISTS option_groups_stamp_archived_at ON public.option_groups;
CREATE TRIGGER option_groups_stamp_archived_at
  BEFORE INSERT OR UPDATE ON public.option_groups
  FOR EACH ROW EXECUTE FUNCTION public.stamp_archived_at();

-- ---------- Itens de opção ----------
ALTER TABLE public.option_items
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.option_items DROP CONSTRAINT IF EXISTS option_items_name_unique;
DROP INDEX IF EXISTS public.option_items_name_normalized_unique;
CREATE UNIQUE INDEX option_items_name_normalized_unique
  ON public.option_items (option_group_id, public.normalize_label(name))
  WHERE NOT is_archived;

ALTER TABLE public.option_items DROP CONSTRAINT IF EXISTS option_items_name_length_check;
ALTER TABLE public.option_items
  ADD CONSTRAINT option_items_name_length_check
  CHECK (char_length(btrim(name)) BETWEEN 1 AND 80);

ALTER TABLE public.option_items DROP CONSTRAINT IF EXISTS option_items_price_scale_check;
ALTER TABLE public.option_items
  ADD CONSTRAINT option_items_price_scale_check
  CHECK (additional_price >= 0 AND additional_price <= 999999.99 AND scale(additional_price) <= 2);

CREATE INDEX IF NOT EXISTS option_items_store_group_active_idx
  ON public.option_items (store_id, option_group_id, is_available, is_archived, sort_order);

DROP TRIGGER IF EXISTS option_items_stamp_archived_at ON public.option_items;
CREATE TRIGGER option_items_stamp_archived_at
  BEFORE INSERT OR UPDATE ON public.option_items
  FOR EACH ROW EXECUTE FUNCTION public.stamp_archived_at();

-- ---------- Vínculo produto x grupo ----------
ALTER TABLE public.product_option_groups
  ADD COLUMN IF NOT EXISTS is_active   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS product_option_groups_store_product_sort_idx
  ON public.product_option_groups (store_id, product_id, sort_order);

DROP TRIGGER IF EXISTS product_option_groups_stamp_archived_at ON public.product_option_groups;
CREATE TRIGGER product_option_groups_stamp_archived_at
  BEFORE INSERT OR UPDATE ON public.product_option_groups
  FOR EACH ROW EXECUTE FUNCTION public.stamp_archived_at();

-- ---------- Preço do item por variação ----------
CREATE TABLE IF NOT EXISTS public.product_variant_option_item_prices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id           uuid NOT NULL,
  product_id         uuid NOT NULL,
  product_variant_id uuid NOT NULL,
  option_item_id     uuid NOT NULL,
  price              numeric(12,2) NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pvoip_id_store_key UNIQUE (id, store_id),
  CONSTRAINT pvoip_unique UNIQUE (product_variant_id, option_item_id),
  CONSTRAINT pvoip_price_check CHECK (price >= 0 AND price <= 999999.99 AND scale(price) <= 2),
  CONSTRAINT pvoip_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT pvoip_product_fk FOREIGN KEY (product_id, store_id) REFERENCES public.products(id, store_id) ON DELETE CASCADE,
  CONSTRAINT pvoip_variant_fk FOREIGN KEY (product_variant_id, store_id) REFERENCES public.product_variants(id, store_id) ON DELETE CASCADE,
  CONSTRAINT pvoip_item_fk FOREIGN KEY (option_item_id, store_id) REFERENCES public.option_items(id, store_id) ON DELETE CASCADE
);

GRANT SELECT ON public.product_variant_option_item_prices TO authenticated;
GRANT ALL    ON public.product_variant_option_item_prices TO service_role;

ALTER TABLE public.product_variant_option_item_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pvoip_select_catalog_view ON public.product_variant_option_item_prices;
CREATE POLICY pvoip_select_catalog_view
  ON public.product_variant_option_item_prices
  FOR SELECT TO authenticated
  USING (private.has_permission('catalog.view', store_id));

CREATE INDEX IF NOT EXISTS pvoip_store_variant_idx
  ON public.product_variant_option_item_prices (store_id, product_variant_id);
CREATE INDEX IF NOT EXISTS pvoip_store_item_idx
  ON public.product_variant_option_item_prices (store_id, option_item_id);

DROP TRIGGER IF EXISTS set_updated_at_pvoip ON public.product_variant_option_item_prices;
CREATE TRIGGER set_updated_at_pvoip
  BEFORE UPDATE ON public.product_variant_option_item_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();