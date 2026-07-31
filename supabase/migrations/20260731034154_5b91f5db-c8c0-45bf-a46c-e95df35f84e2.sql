DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='product_sale_mode') THEN
    CREATE TYPE public.product_sale_mode AS ENUM ('unit','measured','fixed_package');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='measurement_unit') THEN
    CREATE TYPE public.measurement_unit AS ENUM ('unit','kg','g','l','ml');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='option_group_pricing_strategy') THEN
    CREATE TYPE public.option_group_pricing_strategy AS ENUM ('sum','highest_price','average_price');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='option_group_price_effect') THEN
    CREATE TYPE public.option_group_price_effect AS ENUM ('additive','replace_base');
  END IF;
END $$;

ALTER TYPE public.option_selection_type ADD VALUE IF NOT EXISTS 'quantidade';