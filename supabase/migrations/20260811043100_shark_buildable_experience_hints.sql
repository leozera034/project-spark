-- SHARK — hints explícitos de experiência para produtos montáveis.
-- Não alteram regra de preço; apenas ajudam UI/assistente a escolher linguagem e ordem.
-- Categoria continua fornecendo defaults, produto continua soberano.

update public.category_profiles
set product_templates = (
  select jsonb_agg(
    case
      when elem->>'type'='buildable' and coalesce(elem->>'label','') ilike '%hamb%'
        then jsonb_set(elem,'{capabilities}',coalesce(elem->'capabilities','{}'::jsonb)||'{"burger_experience":true}'::jsonb,true)
      else elem
    end
  )
  from jsonb_array_elements(product_templates) elem
), updated_at=now()
where code='hamburgueria';

update public.category_profiles
set product_templates = (
  select jsonb_agg(
    case
      when elem->>'type'='buildable' and coalesce(elem->>'label','') ilike '%lanche%'
        then jsonb_set(elem,'{capabilities}',coalesce(elem->'capabilities','{}'::jsonb)||'{"burger_experience":true}'::jsonb,true)
      else elem
    end
  )
  from jsonb_array_elements(product_templates) elem
), updated_at=now()
where code='lanchonete';

update public.category_profiles
set product_templates = (
  select jsonb_agg(
    case
      when elem->>'type'='buildable' and coalesce(elem->>'label','') ilike '%marmita%'
        then jsonb_set(elem,'{capabilities}',coalesce(elem->'capabilities','{}'::jsonb)||'{"meal_experience":true}'::jsonb,true)
      else elem
    end
  )
  from jsonb_array_elements(product_templates) elem
), updated_at=now()
where code='restaurante';

-- Produtos já convertidos recebem hint apenas quando a estrutura é inequívoca.
-- Não sobrescreve capacidades já declaradas.
update public.products p
set capabilities = p.capabilities || '{"burger_experience":true}'::jsonb,
    updated_at=now()
where p.product_type='buildable'
  and coalesce((p.capabilities->>'burger_experience')::boolean,false)=false
  and coalesce((p.capabilities->>'bread')::boolean,false)=true
  and (coalesce((p.capabilities->>'doneness')::boolean,false)=true or coalesce((p.capabilities->>'sauces')::boolean,false)=true)
  and coalesce((p.capabilities->>'meal_experience')::boolean,false)=false;

update public.products p
set capabilities = p.capabilities || '{"meal_experience":true}'::jsonb,
    updated_at=now()
where p.product_type='buildable'
  and coalesce((p.capabilities->>'meal_experience')::boolean,false)=false
  and coalesce((p.capabilities->>'proteins')::boolean,false)=true
  and coalesce((p.capabilities->>'sides')::boolean,false)=true
  and coalesce((p.capabilities->>'bread')::boolean,false)=false
  and coalesce((p.capabilities->>'burger_experience')::boolean,false)=false;
