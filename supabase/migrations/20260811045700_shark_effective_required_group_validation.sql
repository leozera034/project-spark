-- SHARK — corrige a resolução de obrigatoriedade entre grupo e vínculo do produto.
-- product_option_groups.is_required é um override nullable. Quando NULL, a regra
-- deve herdar option_groups.is_required. O motor anterior selecionava os dois
-- campos com o mesmo nome e podia ler o NULL do vínculo, aceitando grupo obrigatório vazio.

do $$
declare
  d text;
  patched text;
begin
  select pg_get_functiondef(
    'private.calculate_configured_product_price_v2(uuid,uuid,uuid,numeric,jsonb)'::regprocedure
  ) into d;

  patched := replace(
    d,
    'og.is_required,',
    'coalesce(pog.is_required,og.is_required) effective_required,'
  );
  patched := replace(patched, '_link.is_required', '_link.effective_required');

  if patched = d then
    -- A função pode já estar corrigida em um ambiente reconciliado. Nesse caso,
    -- só aceitamos se o contrato efetivo já existir na definição.
    if position('effective_required' in d) = 0 then
      raise exception 'SHARK_REQUIRED_GROUP_PATCH_NOT_APPLIED';
    end if;
  else
    execute patched;
  end if;
end
$$;
