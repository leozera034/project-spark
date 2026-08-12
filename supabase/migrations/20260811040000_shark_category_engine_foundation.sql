-- SHARK — motor inteligente de categorias e cardápios
-- Fundação compatível com catálogo legado: nenhuma coluna existente é removida.

-- 1) Perfis globais de categoria do estabelecimento. São defaults, não prisão.
create table if not exists public.category_profiles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]{2,50}$'),
  name text not null,
  description text,
  icon text,
  default_capabilities jsonb not null default '{}'::jsonb,
  product_templates jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.category_profiles enable row level security;
grant select on public.category_profiles to authenticated, anon;
grant all on public.category_profiles to service_role;
create policy category_profiles_public_read on public.category_profiles
  for select to authenticated, anon using (is_active or private.is_platform_admin());
create policy category_profiles_admin_manage on public.category_profiles
  for all to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());

alter table public.stores add column if not exists category_profile_id uuid references public.category_profiles(id) on delete set null;
create index if not exists stores_category_profile_idx on public.stores(category_profile_id);

-- 2) Regra do produto: independente da categoria da loja.
alter table public.products add column if not exists product_type text not null default 'simple';
alter table public.products add column if not exists capabilities jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists pricing_rules jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists engine_version integer not null default 1;
alter table public.products add column if not exists stock_quantity numeric null;

alter table public.products drop constraint if exists products_stock_quantity_check;
alter table public.products add constraint products_stock_quantity_check check (stock_quantity is null or stock_quantity >= 0);

create index if not exists products_product_type_idx on public.products(store_id, product_type) where not is_archived;

-- Legado permanece explicitamente simples até a loja converter.
update public.products
set product_type = coalesce(nullif(product_type,''),'simple'),
    capabilities = coalesce(capabilities,'{}'::jsonb),
    pricing_rules = coalesce(pricing_rules,'{}'::jsonb),
    engine_version = coalesce(engine_version,1)
where product_type is null or capabilities is null or pricing_rules is null or engine_version is null;

-- 3) Grupos de opção ganham semântica e política de itens incluídos.
alter table public.option_groups add column if not exists role text not null default 'generic';
alter table public.option_groups add column if not exists included_selections integer not null default 0;
alter table public.option_groups add column if not exists configuration jsonb not null default '{}'::jsonb;

alter table public.option_groups drop constraint if exists option_groups_included_check;
alter table public.option_groups add constraint option_groups_included_check
  check (included_selections >= 0 and included_selections <= max_selections);

-- Itens podem representar um produto/variação real em um passo de combo.
alter table public.option_items add column if not exists linked_product_id uuid;
alter table public.option_items add column if not exists linked_variant_id uuid;
alter table public.option_items add column if not exists inventory_quantity numeric null;
alter table public.option_items add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.option_items drop constraint if exists option_items_inventory_check;
alter table public.option_items add constraint option_items_inventory_check check (inventory_quantity is null or inventory_quantity >= 0);

-- FKs compostas preservam isolamento do tenant.
do $$ begin
  if not exists (select 1 from pg_constraint where conname='option_items_linked_product_same_store_fk') then
    alter table public.option_items add constraint option_items_linked_product_same_store_fk
      foreign key (linked_product_id, store_id) references public.products(id, store_id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='option_items_linked_variant_same_store_fk') then
    alter table public.option_items add constraint option_items_linked_variant_same_store_fk
      foreign key (linked_variant_id, store_id) references public.product_variants(id, store_id) on delete set null;
  end if;
end $$;

-- 4) Perfis iniciais. A aplicação lê dados; não contém if(category === ...).
insert into public.category_profiles(code,name,description,icon,sort_order,default_capabilities,product_templates)
values
('pizzaria','Pizzaria','Pizzas, sabores, tamanhos, bordas e montagem.','pizza',10,
 '{"sizes":true,"flavors":true,"multi_flavor":true,"option_groups":true,"removals":true,"dough":true,"crust":true,"combos":true}'::jsonb,
 '[{"type":"multi_flavor","label":"Pizza","capabilities":{"sizes":true,"flavors":true,"multi_flavor":true,"crust":true,"dough":true,"add_ons":true}},{"type":"simple","label":"Bebida","capabilities":{}}]'::jsonb),
('hamburgueria','Hamburgueria','Hambúrgueres, adicionais, ponto, pães, molhos e combos.','burger',20,
 '{"sizes":true,"option_groups":true,"removals":true,"doneness":true,"bread":true,"sauces":true,"sides":true,"beverages":true,"combos":true}'::jsonb,
 '[{"type":"buildable","label":"Lanche","capabilities":{"add_ons":true,"removals":true,"doneness":true,"bread":true,"sauces":true}},{"type":"combo","label":"Combo","capabilities":{"combo_steps":true}}]'::jsonb),
('acai','Açaí','Tamanhos, cremes, frutas, coberturas e complementos incluídos.','cup-soda',30,
 '{"sizes":true,"option_groups":true,"included_choices":true,"fruits":true,"creams":true,"toppings":true,"add_ons":true,"buildable":true}'::jsonb,
 '[{"type":"buildable","label":"Açaí montável","capabilities":{"sizes":true,"included_choices":true,"creams":true,"fruits":true,"toppings":true,"add_ons":true}}]'::jsonb),
('sorveteria','Sorveteria','Bolas, sabores, coberturas, copo/casquinha e adicionais.','ice-cream-bowl',40,
 '{"sizes":true,"flavors":true,"option_groups":true,"toppings":true,"containers":true,"add_ons":true,"portions":true}'::jsonb,
 '[{"type":"buildable","label":"Sorvete montável","capabilities":{"sizes":true,"flavors":true,"portions":true,"toppings":true,"containers":true}}]'::jsonb),
('restaurante','Marmitaria / Restaurante','Pratos, marmitas, proteínas, acompanhamentos e prato do dia.','utensils',50,
 '{"sizes":true,"option_groups":true,"proteins":true,"sides":true,"removals":true,"buildable":true,"combos":true,"beverages":true}'::jsonb,
 '[{"type":"buildable","label":"Marmita montável","capabilities":{"sizes":true,"proteins":true,"sides":true,"add_ons":true,"removals":true}},{"type":"simple","label":"Prato do dia","capabilities":{}}]'::jsonb),
('lanchonete','Lanchonete','Lanches, adicionais, acompanhamentos, bebidas e combos.','sandwich',60,
 '{"sizes":true,"flavors":true,"option_groups":true,"add_ons":true,"removals":true,"sides":true,"beverages":true,"combos":true}'::jsonb,
 '[{"type":"buildable","label":"Lanche","capabilities":{"add_ons":true,"removals":true}},{"type":"combo","label":"Combo","capabilities":{"combo_steps":true}}]'::jsonb),
('pastelaria','Pastelaria','Sabores, tamanhos, montagem e combos.','cookie',70,
 '{"sizes":true,"flavors":true,"multi_flavor":true,"option_groups":true,"add_ons":true,"combos":true,"beverages":true}'::jsonb,
 '[{"type":"flavors","label":"Pastel","capabilities":{"flavors":true,"add_ons":true}}]'::jsonb),
('adega','Bebidas / Adega','Volume, embalagem, kits, sabores, gelo e complementos.','wine',80,
 '{"volume":true,"packages":true,"variants":true,"flavors":true,"kits":true,"combos":true,"option_groups":true}'::jsonb,
 '[{"type":"variant","label":"Bebida com volumes","capabilities":{"volume":true,"variants":true}},{"type":"kit","label":"Kit / fardo","capabilities":{"packages":true,"kits":true}}]'::jsonb),
('mercado','Padaria / Conveniência / Mercado','Produtos simples, peso/volume, estoque, variações e kits.','shopping-basket',90,
 '{"simple":true,"measured":true,"stock":true,"variants":true,"packages":true,"kits":true,"combos":true}'::jsonb,
 '[{"type":"simple","label":"Produto simples","capabilities":{"stock":true}},{"type":"measured","label":"Por peso/volume","capabilities":{"measured":true,"stock":true}},{"type":"kit","label":"Kit","capabilities":{"kits":true}}]'::jsonb)
on conflict(code) do update set
  name=excluded.name,description=excluded.description,icon=excluded.icon,sort_order=excluded.sort_order,
  default_capabilities=excluded.default_capabilities,product_templates=excluded.product_templates,is_active=true,updated_at=now();

-- Migração suave do segmento textual existente quando houver correspondência inequívoca.
update public.stores s set category_profile_id=cp.id
from public.category_profiles cp
where s.category_profile_id is null and (
  (lower(coalesce(s.segment,'')) like '%pizz%' and cp.code='pizzaria') or
  (lower(coalesce(s.segment,'')) like '%hamb%' and cp.code='hamburgueria') or
  (lower(coalesce(s.segment,'')) like '%aça%' and cp.code='acai') or
  (lower(coalesce(s.segment,'')) like '%acai%' and cp.code='acai') or
  (lower(coalesce(s.segment,'')) like '%sorvet%' and cp.code='sorveteria') or
  ((lower(coalesce(s.segment,'')) like '%marmit%' or lower(coalesce(s.segment,'')) like '%restaur%') and cp.code='restaurante') or
  (lower(coalesce(s.segment,'')) like '%lanch%' and cp.code='lanchonete') or
  (lower(coalesce(s.segment,'')) like '%pastel%' and cp.code='pastelaria') or
  ((lower(coalesce(s.segment,'')) like '%adega%' or lower(coalesce(s.segment,'')) like '%bebid%') and cp.code='adega') or
  ((lower(coalesce(s.segment,'')) like '%mercad%' or lower(coalesce(s.segment,'')) like '%padar%' or lower(coalesce(s.segment,'')) like '%conveni%') and cp.code='mercado')
);

-- 5) RPCs configuráveis: categoria sugere; produto decide.
create or replace function public.get_store_category_profile(_store_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare out jsonb;
begin
  if not private.is_store_member(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  select case when cp.id is null then null else jsonb_build_object(
    'id',cp.id,'code',cp.code,'name',cp.name,'description',cp.description,'icon',cp.icon,
    'default_capabilities',cp.default_capabilities,'product_templates',cp.product_templates
  ) end into out
  from public.stores s left join public.category_profiles cp on cp.id=s.category_profile_id and cp.is_active
  where s.id=_store_id;
  return out;
end; $$;

create or replace function public.set_store_category_profile(_store_id uuid,_profile_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cp public.category_profiles;
begin
  if not private.is_store_manager(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  select * into cp from public.category_profiles where id=_profile_id and is_active;
  if not found then raise exception 'CATEGORY_PROFILE_NOT_FOUND'; end if;
  update public.stores set category_profile_id=cp.id,segment=coalesce(segment,cp.name),updated_at=now() where id=_store_id;
  return jsonb_build_object('id',cp.id,'code',cp.code,'name',cp.name,'default_capabilities',cp.default_capabilities,'product_templates',cp.product_templates);
end; $$;

create or replace function public.get_product_engine_profile(_store_id uuid,_product_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare p public.products; cp public.category_profiles;
begin
  if not private.is_store_member(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  select * into p from public.products where id=_product_id and store_id=_store_id and not is_archived;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  select cp.* into cp from public.stores s left join public.category_profiles cp on cp.id=s.category_profile_id where s.id=_store_id;
  return jsonb_build_object(
    'product_id',p.id,'product_type',p.product_type,'capabilities',p.capabilities,'pricing_rules',p.pricing_rules,
    'engine_version',p.engine_version,'category_profile',case when cp.id is null then null else jsonb_build_object('id',cp.id,'code',cp.code,'name',cp.name,'default_capabilities',cp.default_capabilities,'product_templates',cp.product_templates) end
  );
end; $$;

create or replace function public.update_product_engine_profile(
  _store_id uuid,_product_id uuid,_product_type text,_capabilities jsonb,_pricing_rules jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.products;
begin
  if not private.is_store_manager(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if nullif(trim(_product_type),'') is null or length(_product_type)>50 then raise exception 'INVALID_PRODUCT_TYPE'; end if;
  if jsonb_typeof(coalesce(_capabilities,'{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(_pricing_rules,'{}'::jsonb)) <> 'object' then raise exception 'INVALID_CAPABILITIES'; end if;
  update public.products set product_type=lower(trim(_product_type)),capabilities=coalesce(_capabilities,'{}'::jsonb),pricing_rules=coalesce(_pricing_rules,'{}'::jsonb),engine_version=2,updated_at=now()
  where id=_product_id and store_id=_store_id and not is_archived returning * into p;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  return jsonb_build_object('product_id',p.id,'product_type',p.product_type,'capabilities',p.capabilities,'pricing_rules',p.pricing_rules,'engine_version',p.engine_version);
end; $$;

-- Admin SaaS gerencia categorias sem rebuild do frontend.
create or replace function public.admin_list_category_profiles()
returns setof public.category_profiles language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not private.is_platform_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  return query select * from public.category_profiles order by sort_order,name;
end; $$;

create or replace function public.admin_save_category_profile(
  _id uuid,_code text,_name text,_description text,_icon text,_capabilities jsonb,_templates jsonb,_active boolean,_sort_order integer
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare out_id uuid;
begin
  if not private.is_platform_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if _code !~ '^[a-z0-9_]{2,50}$' or length(trim(_name))<2 then raise exception 'INVALID_CATEGORY_PROFILE'; end if;
  if jsonb_typeof(coalesce(_capabilities,'{}'))<>'object' or jsonb_typeof(coalesce(_templates,'[]'))<>'array' then raise exception 'INVALID_CATEGORY_PROFILE_CONFIG'; end if;
  if _id is null then
    insert into public.category_profiles(code,name,description,icon,default_capabilities,product_templates,is_active,sort_order)
    values(_code,trim(_name),nullif(trim(coalesce(_description,'')),''),nullif(trim(coalesce(_icon,'')),''),coalesce(_capabilities,'{}'),coalesce(_templates,'[]'),coalesce(_active,true),coalesce(_sort_order,0)) returning id into out_id;
  else
    update public.category_profiles set code=_code,name=trim(_name),description=nullif(trim(coalesce(_description,'')),''),icon=nullif(trim(coalesce(_icon,'')),''),default_capabilities=coalesce(_capabilities,'{}'),product_templates=coalesce(_templates,'[]'),is_active=coalesce(_active,true),sort_order=coalesce(_sort_order,0),updated_at=now() where id=_id returning id into out_id;
    if out_id is null then raise exception 'CATEGORY_PROFILE_NOT_FOUND'; end if;
  end if;
  return out_id;
end; $$;

grant execute on function public.get_store_category_profile(uuid) to authenticated;
grant execute on function public.set_store_category_profile(uuid,uuid) to authenticated;
grant execute on function public.get_product_engine_profile(uuid,uuid) to authenticated;
grant execute on function public.update_product_engine_profile(uuid,uuid,text,jsonb,jsonb) to authenticated;
grant execute on function public.admin_list_category_profiles() to authenticated;
grant execute on function public.admin_save_category_profile(uuid,text,text,text,text,jsonb,jsonb,boolean,integer) to authenticated;
revoke all on function public.get_store_category_profile(uuid) from anon;
revoke all on function public.set_store_category_profile(uuid,uuid) from anon;
revoke all on function public.get_product_engine_profile(uuid,uuid) from anon;
revoke all on function public.update_product_engine_profile(uuid,uuid,text,jsonb,jsonb) from anon;
revoke all on function public.admin_list_category_profiles() from anon;
revoke all on function public.admin_save_category_profile(uuid,text,text,text,text,jsonb,jsonb,boolean,integer) from anon;
