-- SHARK — corrige concatenação de códigos de validação no motor v2.
-- text[] || 'CODIGO' pode ser resolvido como concatenação de arrays e tentar
-- interpretar o texto como literal de array, gerando 22P02 justamente nos fluxos de erro.
-- Convertemos todas as adições escalares para ARRAY['CODIGO'].

do $$
declare
  d text;
  patched text;
begin
  select pg_get_functiondef(
    'private.calculate_configured_product_price_v2(uuid,uuid,uuid,numeric,jsonb)'::regprocedure
  ) into d;

  patched := regexp_replace(
    d,
    '_errors\s*:=\s*_errors\s*\|\|\s*''([A-Z0-9_]+)''',
    '_errors:=_errors||ARRAY[''\1'']',
    'g'
  );

  if patched <> d then
    execute patched;
  end if;
end
$$;
