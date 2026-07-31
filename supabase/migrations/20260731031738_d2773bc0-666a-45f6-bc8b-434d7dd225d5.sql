-- ============================================================
-- FASE 09 — Catálogo básico: estrutura complementar
-- Nenhuma migration anterior é alterada. Nada é removido.
-- ============================================================

-- ---------- Categorias ----------
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS image_path  text,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_name_length_check;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_name_length_check
  CHECK (char_length(btrim(name)) BETWEEN 2 AND 80);

-- Nome único por loja, normalizado (sem acento, minúsculo, espaços colapsados).
-- Apenas categorias não arquivadas participam da unicidade.
DROP INDEX IF EXISTS public.categories_store_name_unique;
CREATE UNIQUE INDEX categories_store_name_unique
  ON public.categories (store_id, public.normalize_label(name))
  WHERE NOT is_archived;

CREATE INDEX IF NOT EXISTS categories_store_sort_idx
  ON public.categories (store_id, is_archived, sort_order, name);

-- ---------- Produtos ----------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_path       text,
  ADD COLUMN IF NOT EXISTS is_archived      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at      timestamptz,
  ADD COLUMN IF NOT EXISTS allows_notes     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS minimum_quantity numeric(10,3) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quantity_step    numeric(10,3) NOT NULL DEFAULT 1;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_name_length_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_name_length_check
  CHECK (char_length(btrim(name)) BETWEEN 2 AND 120);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_base_price_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_base_price_check
  CHECK (base_price >= 0 AND base_price <= 999999.99 AND scale(base_price) <= 2);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_quantity_rules_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_quantity_rules_check
  CHECK (minimum_quantity > 0 AND quantity_step > 0);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_description_length_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_description_length_check
  CHECK (description IS NULL OR char_length(description) <= 600);

CREATE INDEX IF NOT EXISTS products_store_category_sort_idx
  ON public.products (store_id, category_id, is_archived, sort_order, name);

CREATE INDEX IF NOT EXISTS products_store_name_search_idx
  ON public.products (store_id, public.normalize_label(name));

-- ---------- Carimbo automático de arquivamento ----------
CREATE OR REPLACE FUNCTION public.stamp_archived_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_archived AND (TG_OP = 'INSERT' OR NOT OLD.is_archived) THEN
    NEW.archived_at := now();
  ELSIF NOT NEW.is_archived THEN
    NEW.archived_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS categories_stamp_archived_at ON public.categories;
CREATE TRIGGER categories_stamp_archived_at
  BEFORE INSERT OR UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.stamp_archived_at();

DROP TRIGGER IF EXISTS products_stamp_archived_at ON public.products;
CREATE TRIGGER products_stamp_archived_at
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.stamp_archived_at();
