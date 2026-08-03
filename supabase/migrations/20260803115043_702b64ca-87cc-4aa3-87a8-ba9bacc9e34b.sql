-- Contas de teste (ambiente de desenvolvimento)
insert into public.user_profiles (id, full_name, display_name, phone, is_active) values
  ('e0db8a21-3d8e-4d94-99a5-2acd57f4b30a','Ana Admin','Ana','(62) 90000-0001',true),
  ('7821539e-bde2-45b4-b93d-bfbf2f69f80c','Paulo Proprietário','Paulo','(62) 90000-0002',true),
  ('fac8feb7-29d0-44ec-a72c-0095eb8317e6','Gisele Gerente','Gisele','(62) 90000-0003',true),
  ('3e0ae446-cd8f-48af-8e81-e9303ee7be03','Alice Atendente','Alice','(62) 90000-0004',true),
  ('c4adb55f-b1e6-4565-bb11-ab0597c6a99e','Caio Cozinha','Caio','(62) 90000-0005',true),
  ('dbc26a07-5c8c-4f55-9c11-7c1d3b339aeb','Bruno Brasa','Bruno','(62) 90000-0006',true),
  ('45f228bf-e077-4323-a523-342b63a036b3','Carlos Entregador','Carlos','(62) 90000-0007',true),
  ('d8b6d153-1420-4c37-8ef4-aa67e1b885a2','Bia Entregadora','Bia','(62) 90000-0008',true)
on conflict (id) do update set full_name = excluded.full_name, is_active = true;

insert into public.user_roles (user_id, store_id, role, is_active) values
  ('e0db8a21-3d8e-4d94-99a5-2acd57f4b30a', null, 'admin_plataforma', true),
  ('7821539e-bde2-45b4-b93d-bfbf2f69f80c','00000000-0000-4000-8000-000000000205','proprietario', true),
  ('fac8feb7-29d0-44ec-a72c-0095eb8317e6','00000000-0000-4000-8000-000000000205','gerente', true),
  ('3e0ae446-cd8f-48af-8e81-e9303ee7be03','00000000-0000-4000-8000-000000000205','atendente', true),
  ('c4adb55f-b1e6-4565-bb11-ab0597c6a99e','00000000-0000-4000-8000-000000000205','cozinha', true),
  ('dbc26a07-5c8c-4f55-9c11-7c1d3b339aeb','00000000-0000-4000-8000-000000000201','proprietario', true),
  ('45f228bf-e077-4323-a523-342b63a036b3','00000000-0000-4000-8000-000000000205','entregador', true),
  ('d8b6d153-1420-4c37-8ef4-aa67e1b885a2','00000000-0000-4000-8000-000000000205','entregador', true)
on conflict do nothing;

insert into public.couriers (id, store_id, user_id, full_name, phone, vehicle, plate, status, is_online, can_accept_deliveries) values
  ('00000000-0000-4000-8000-0000000c0001','00000000-0000-4000-8000-000000000205','45f228bf-e077-4323-a523-342b63a036b3','Carlos Entregador','(62) 90000-0007','Moto','ABC1D23','ativo',false,true),
  ('00000000-0000-4000-8000-0000000c0002','00000000-0000-4000-8000-000000000205','d8b6d153-1420-4c37-8ef4-aa67e1b885a2','Bia Entregadora','(62) 90000-0008','Bicicleta',null,'ativo',false,true)
on conflict (id, store_id) do nothing;

insert into public.courier_auth_identities (store_id, courier_id, auth_user_id, login_identifier, synthetic_email, requires_password_change, is_login_enabled) values
  ('00000000-0000-4000-8000-000000000205','00000000-0000-4000-8000-0000000c0001','45f228bf-e077-4323-a523-342b63a036b3','carlos.aurora','45a254b483e0fba8c7acd66234102c34@courier.pediuaqui.internal', false, true),
  ('00000000-0000-4000-8000-000000000205','00000000-0000-4000-8000-0000000c0002','d8b6d153-1420-4c37-8ef4-aa67e1b885a2','bia.aurora','07984d4510598c79e0a5867931fa38d1@courier.pediuaqui.internal', true, true)
on conflict do nothing;