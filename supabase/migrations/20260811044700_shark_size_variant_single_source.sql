-- SHARK — tamanho tem uma única fonte de verdade: product_variants.
-- O starter antigo da 41700 criava também um option_group role=size. Isso poderia
-- duplicar a decisão de tamanho no produto. Preservamos o gerador legado internamente
-- e expomos um wrapper que remove somente rascunhos Shark de tamanho.

DO $$
BEGIN
  IF to_regprocedure('public.create_product_starter_group_drafts_legacy(uuid,uuid)') IS NULL
     AND to_regprocedure('public.create_product_starter_group_drafts(uuid,uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.create_product_starter_group_drafts(uuid,uuid)
      RENAME TO create_product_starter_group_drafts_legacy;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.create_product_starter_group_drafts_legacy(uuid,uuid)
  FROM public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.create_product_starter_group_drafts(
  _store_id uuid,
  _product_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,private,pg_temp
AS $$
DECLARE
  _sid uuid:=private.resolve_store(_store_id);
  _result jsonb;
  _removed_ids uuid[]:=array[]::uuid[];
  _created jsonb;
BEGIN
  perform private.require_permission('catalog.create',_sid);
  perform private.assert_product_editable(_sid,_product_id);

  _result:=public.create_product_starter_group_drafts_legacy(_sid,_product_id);

  SELECT coalesce(array_agg(og.id),array[]::uuid[])
    INTO _removed_ids
  FROM public.product_option_groups pog
  JOIN public.option_groups og
    ON og.id=pog.option_group_id AND og.store_id=pog.store_id
  WHERE pog.store_id=_sid
    AND pog.product_id=_product_id
    AND not pog.is_archived
    AND og.role='size'
    AND coalesce((og.configuration->>'shark_draft')::boolean,false)=true
    AND og.configuration->>'shark_starter_key'='size';

  IF cardinality(_removed_ids)>0 THEN
    DELETE FROM public.product_option_groups
    WHERE store_id=_sid
      AND product_id=_product_id
      AND option_group_id=ANY(_removed_ids);

    DELETE FROM public.option_groups
    WHERE store_id=_sid
      AND id=ANY(_removed_ids)
      AND coalesce((configuration->>'shark_draft')::boolean,false)=true
      AND configuration->>'shark_starter_key'='size';
  END IF;

  SELECT coalesce(jsonb_agg(entry),'[]'::jsonb)
    INTO _created
  FROM jsonb_array_elements(coalesce(_result->'created','[]'::jsonb)) entry
  WHERE coalesce(entry->>'role','')<>'size';

  return jsonb_build_object(
    'created',_created,
    'created_count',jsonb_array_length(_created),
    'size_configuration','variants'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_product_starter_group_drafts(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.create_product_starter_group_drafts(uuid,uuid) FROM anon;

COMMENT ON FUNCTION public.create_product_starter_group_drafts(uuid,uuid) IS
  'Gerador canônico de rascunhos SHARK. Tamanhos são configurados exclusivamente em product_variants; nenhum option_group size é mantido.';
