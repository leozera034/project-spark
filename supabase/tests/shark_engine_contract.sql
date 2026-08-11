-- SHARK — contratos funcionais do motor de cardápio.
-- Executa em transação e não deixa dados de teste persistidos.
begin;

do $test$
declare
  sid uuid := gen_random_uuid();
  cid uuid := gen_random_uuid();
  simple_id uuid := gen_random_uuid();
  sized_id uuid := gen_random_uuid();
  sized_variant uuid := gen_random_uuid();
  addon_id uuid := gen_random_uuid();
  pizza_id uuid := gen_random_uuid();
  acai_id uuid := gen_random_uuid();
  combo_id uuid := gen_random_uuid();
  beverage_id uuid := gen_random_uuid();
  legacy_id uuid := gen_random_uuid();
  unavailable_id uuid := gen_random_uuid();
  group_id uuid;
  item1 uuid;
  item2 uuid;
  item3 uuid;
  item4 uuid;
  item5 uuid;
  result jsonb;
  errors jsonb;
begin
  insert into public.stores(id,slug,name,status,city,state)
  values(sid,'shark-contract-' || substr(replace(sid::text,'-',''),1,8),'Shark Contract','ativa','Teste','MG');

  insert into public.categories(id,store_id,name,is_active,is_archived)
  values(cid,sid,'Testes',true,false);

  -- 1. Produto simples / legado.
  insert into public.products(id,store_id,category_id,name,base_price,is_available,is_archived,product_type,engine_version)
  values
    (simple_id,sid,cid,'Simples',10,true,false,'simple',2),
    (legacy_id,sid,cid,'Legado',7,true,false,'simple',1);

  result := private.calculate_configured_product_price(sid,simple_id,null,1,'[]'::jsonb);
  if (result->>'final_total')::numeric <> 10 then raise exception 'SHARK simple product failed: %',result; end if;

  result := private.calculate_configured_product_price(sid,legacy_id,null,1,'[]'::jsonb);
  if (result->>'final_total')::numeric <> 7 then raise exception 'SHARK legacy compatibility failed: %',result; end if;

  -- 2. Produto com tamanho/variação.
  insert into public.products(id,store_id,category_id,name,base_price,is_available,is_archived,has_variants,product_type,engine_version)
  values(sized_id,sid,cid,'Com tamanho',10,true,false,true,'variant',2);
  insert into public.product_variants(id,store_id,product_id,name,price,is_default,is_available,is_archived)
  values(sized_variant,sid,sized_id,'Grande',15,true,true,false);
  result := private.calculate_configured_product_price(sid,sized_id,sized_variant,1,'[]'::jsonb);
  if (result->>'final_total')::numeric <> 15 then raise exception 'SHARK variant price failed: %',result; end if;

  -- 3. Adicional + anti-adulteração: preço enviado no JSON é ignorado.
  insert into public.products(id,store_id,category_id,name,base_price,is_available,is_archived,product_type,engine_version)
  values(addon_id,sid,cid,'Com adicional',10,true,false,'buildable',2);
  group_id := gen_random_uuid(); item1 := gen_random_uuid();
  insert into public.option_groups(id,store_id,name,selection_type,is_required,min_selections,max_selections,pricing_strategy,price_effect,role,included_selections,is_active,is_archived)
  values(group_id,sid,'Adicionais','multipla',false,0,3,'sum','additive','addon',0,true,false);
  insert into public.option_items(id,store_id,option_group_id,name,additional_price,max_quantity,is_available,is_archived)
  values(item1,sid,group_id,'Bacon',2,1,true,false);
  insert into public.product_option_groups(store_id,product_id,option_group_id,is_active,is_archived)
  values(sid,addon_id,group_id,true,false);
  result := private.calculate_configured_product_price(sid,addon_id,null,1,
    jsonb_build_array(jsonb_build_object('group_id',group_id,'items',jsonb_build_array(jsonb_build_object('item_id',item1,'quantity',1,'price',0)))));
  if (result->>'final_total')::numeric <> 12 then raise exception 'SHARK tamper/addon failed: %',result; end if;

  -- 4. Pizza dois sabores com regra do maior preço.
  insert into public.products(id,store_id,category_id,name,base_price,is_available,is_archived,product_type,engine_version,capabilities,pricing_rules)
  values(pizza_id,sid,cid,'Pizza',0,true,false,'multi_flavor',2,'{"multi_flavor":true}'::jsonb,'{"multi_flavor_pricing":"highest"}'::jsonb);
  group_id := gen_random_uuid(); item1 := gen_random_uuid(); item2 := gen_random_uuid();
  insert into public.option_groups(id,store_id,name,selection_type,is_required,min_selections,max_selections,pricing_strategy,price_effect,portion_count,role,included_selections,is_active,is_archived)
  values(group_id,sid,'Sabores','multipla',true,2,2,'highest_price','replace_base',2,'flavor',0,true,false);
  insert into public.option_items(id,store_id,option_group_id,name,additional_price,max_quantity,is_available,is_archived) values
    (item1,sid,group_id,'Calabresa',30,1,true,false),(item2,sid,group_id,'Portuguesa',40,1,true,false);
  insert into public.product_option_groups(store_id,product_id,option_group_id,is_active,is_archived) values(sid,pizza_id,group_id,true,false);
  result := private.calculate_configured_product_price(sid,pizza_id,null,1,
    jsonb_build_array(jsonb_build_object('group_id',group_id,'items',jsonb_build_array(
      jsonb_build_object('item_id',item1,'quantity',1),jsonb_build_object('item_id',item2,'quantity',1)))));
  if (result->>'final_total')::numeric <> 40 then raise exception 'SHARK pizza highest failed: %',result; end if;

  -- 5. Açaí: 4 complementos incluídos e quinto cobrado.
  insert into public.products(id,store_id,category_id,name,base_price,is_available,is_archived,product_type,engine_version)
  values(acai_id,sid,cid,'Açaí 500ml',20,true,false,'buildable',2);
  group_id := gen_random_uuid(); item1:=gen_random_uuid(); item2:=gen_random_uuid(); item3:=gen_random_uuid(); item4:=gen_random_uuid(); item5:=gen_random_uuid();
  insert into public.option_groups(id,store_id,name,selection_type,is_required,min_selections,max_selections,pricing_strategy,price_effect,role,included_selections,is_active,is_archived)
  values(group_id,sid,'Complementos','multipla',false,0,6,'sum','additive','topping',4,true,false);
  insert into public.option_items(id,store_id,option_group_id,name,additional_price,max_quantity,is_available,is_archived) values
    (item1,sid,group_id,'A',2,1,true,false),(item2,sid,group_id,'B',2,1,true,false),(item3,sid,group_id,'C',2,1,true,false),(item4,sid,group_id,'D',2,1,true,false),(item5,sid,group_id,'E',2,1,true,false);
  insert into public.product_option_groups(store_id,product_id,option_group_id,is_active,is_archived) values(sid,acai_id,group_id,true,false);
  result := private.calculate_configured_product_price(sid,acai_id,null,1,
    jsonb_build_array(jsonb_build_object('group_id',group_id,'items',jsonb_build_array(
      jsonb_build_object('item_id',item1,'quantity',1),jsonb_build_object('item_id',item2,'quantity',1),jsonb_build_object('item_id',item3,'quantity',1),jsonb_build_object('item_id',item4,'quantity',1),jsonb_build_object('item_id',item5,'quantity',1)))));
  if (result->>'final_total')::numeric <> 22 then raise exception 'SHARK included choices failed: %',result; end if;

  -- 6. Combo estruturado com diferença de preço.
  insert into public.products(id,store_id,category_id,name,base_price,is_available,is_archived,product_type,engine_version,capabilities) values
    (combo_id,sid,cid,'Combo',25,true,false,'combo',2,'{"combo_steps":true}'::jsonb),
    (beverage_id,sid,cid,'Coca 600ml',8,true,false,'simple',2,'{}'::jsonb);
  group_id:=gen_random_uuid(); item1:=gen_random_uuid();
  insert into public.option_groups(id,store_id,name,selection_type,is_required,min_selections,max_selections,pricing_strategy,price_effect,role,included_selections,is_active,is_archived)
  values(group_id,sid,'Escolha a bebida','unica',true,1,1,'sum','additive','combo_step',0,true,false);
  insert into public.option_items(id,store_id,option_group_id,name,additional_price,max_quantity,is_available,is_archived,linked_product_id)
  values(item1,sid,group_id,'Coca 600ml',3,1,true,false,beverage_id);
  insert into public.product_option_groups(store_id,product_id,option_group_id,is_active,is_archived) values(sid,combo_id,group_id,true,false);
  result := private.calculate_configured_product_price(sid,combo_id,null,1,
    jsonb_build_array(jsonb_build_object('group_id',group_id,'items',jsonb_build_array(jsonb_build_object('item_id',item1,'quantity',1)))));
  if (result->>'final_total')::numeric <> 28 then raise exception 'SHARK combo difference failed: %',result; end if;

  -- 7. Obrigatório / mínimo.
  result := private.calculate_configured_product_price(sid,combo_id,null,1,'[]'::jsonb);
  errors := coalesce(result->'validation_errors','[]'::jsonb);
  if not errors ? 'SELECTION_BELOW_MINIMUM' then raise exception 'SHARK required minimum failed: %',result; end if;

  -- 8. Máximo excedido.
  update public.option_groups set selection_type='multipla',max_selections=1 where id=group_id;
  item2:=gen_random_uuid();
  insert into public.option_items(id,store_id,option_group_id,name,additional_price,max_quantity,is_available,is_archived,linked_product_id)
  values(item2,sid,group_id,'Outra bebida',0,1,true,false,beverage_id);
  result := private.calculate_configured_product_price(sid,combo_id,null,1,
    jsonb_build_array(jsonb_build_object('group_id',group_id,'items',jsonb_build_array(jsonb_build_object('item_id',item1,'quantity',1),jsonb_build_object('item_id',item2,'quantity',1)))));
  if not coalesce(result->'validation_errors','[]'::jsonb) ? 'SELECTION_ABOVE_MAXIMUM' then raise exception 'SHARK maximum failed: %',result; end if;

  -- 9. Produto indisponível.
  insert into public.products(id,store_id,category_id,name,base_price,is_available,is_archived,product_type,engine_version)
  values(unavailable_id,sid,cid,'Indisponível',9,false,false,'simple',2);
  result := private.calculate_configured_product_price(sid,unavailable_id,null,1,'[]'::jsonb);
  if not coalesce(result->'validation_errors','[]'::jsonb) ? 'PRODUCT_UNAVAILABLE' then raise exception 'SHARK unavailable product failed: %',result; end if;

  -- 10. Opção indisponível.
  update public.option_items set is_available=false where id=item1;
  result := private.calculate_configured_product_price(sid,combo_id,null,1,
    jsonb_build_array(jsonb_build_object('group_id',group_id,'items',jsonb_build_array(jsonb_build_object('item_id',item1,'quantity',1)))));
  if not coalesce(result->'validation_errors','[]'::jsonb) ? 'OPTION_INVALID' then raise exception 'SHARK unavailable option failed: %',result; end if;
end
$test$;

rollback;
