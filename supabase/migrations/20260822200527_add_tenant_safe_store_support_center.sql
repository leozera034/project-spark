create table if not exists public.store_support_tickets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  created_by uuid references public.user_profiles(id) on delete set null,
  category text not null check (category in ('pedidos','cardapio','entregas','financeiro','pagamentos','conta','integracoes','outro')),
  subject text not null check (char_length(subject) between 3 and 160),
  status text not null default 'aberto' check (status in ('aberto','em_atendimento','aguardando_loja','resolvido','fechado')),
  priority text not null default 'normal' check (priority in ('normal','alta','urgente')),
  last_message_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.store_support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.store_support_tickets(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  author_user_id uuid references public.user_profiles(id) on delete set null,
  author_kind text not null check (author_kind in ('loja','admin','sistema')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists idx_store_support_tickets_store_status on public.store_support_tickets(store_id,status,last_message_at desc);
create index if not exists idx_store_support_tickets_status on public.store_support_tickets(status,last_message_at desc);
create index if not exists idx_store_support_messages_ticket on public.store_support_messages(ticket_id,created_at);
alter table public.store_support_tickets enable row level security;
alter table public.store_support_messages enable row level security;
revoke all on table public.store_support_tickets from public,anon,authenticated;
revoke all on table public.store_support_messages from public,anon,authenticated;
grant all on table public.store_support_tickets to service_role;
grant all on table public.store_support_messages to service_role;

create or replace function public.open_my_store_support_ticket(_store_id uuid,_category text,_subject text,_message text)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare u uuid:=auth.uid(); t public.store_support_tickets%rowtype; c text:=lower(btrim(coalesce(_category,''))); s text:=nullif(btrim(coalesce(_subject,'')),''); m text:=nullif(btrim(coalesce(_message,'')),'');
begin
 if not private.is_store_manager_user(u,_store_id) and not private.is_platform_admin_user(u) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if c not in ('pedidos','cardapio','entregas','financeiro','pagamentos','conta','integracoes','outro') then raise exception 'INVALID_CATEGORY' using errcode='22023'; end if;
 if s is null or char_length(s)<3 or char_length(s)>160 then raise exception 'INVALID_SUBJECT' using errcode='22023'; end if;
 if m is null or char_length(m)>4000 then raise exception 'INVALID_MESSAGE' using errcode='22023'; end if;
 insert into public.store_support_tickets(store_id,created_by,category,subject,status,priority,last_message_at) values(_store_id,u,c,s,'aberto','normal',now()) returning * into t;
 insert into public.store_support_messages(ticket_id,store_id,author_user_id,author_kind,body) values(t.id,_store_id,u,'loja',m);
 insert into public.audit_logs(store_id,actor_user_id,actor_kind,action,entity,entity_id,context) values(_store_id,u,'loja','store.support.opened','store_support_tickets',t.id,jsonb_build_object('category',c));
 return jsonb_build_object('id',t.id,'status',t.status,'createdAt',t.created_at);
end$$;

create or replace function public.get_my_store_support_center(_store_id uuid,_limit integer default 100,_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','public','private' as $$
declare u uuid:=auth.uid(); items jsonb; total int; active int;
begin
 if not private.is_store_manager_user(u,_store_id) and not private.is_platform_admin_user(u) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select count(*),count(*) filter(where status not in ('resolvido','fechado')) into total,active from public.store_support_tickets where store_id=_store_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'category',x.category,'subject',x.subject,'status',x.status,'priority',x.priority,'lastMessageAt',x.last_message_at,'resolvedAt',x.resolved_at,'createdAt',x.created_at,'updatedAt',x.updated_at,'messageCount',x.message_count) order by x.last_message_at desc),'[]'::jsonb) into items from (select t.*,(select count(*) from public.store_support_messages m where m.ticket_id=t.id)::int as message_count from public.store_support_tickets t where t.store_id=_store_id order by t.last_message_at desc limit least(greatest(coalesce(_limit,100),1),200) offset greatest(coalesce(_offset,0),0)) x;
 return jsonb_build_object('summary',jsonb_build_object('total',total,'active',active,'resolved',total-active),'items',items,'generatedAt',now());
end$$;

create or replace function public.get_my_store_support_ticket(_store_id uuid,_ticket_id uuid)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','public','private' as $$
declare u uuid:=auth.uid(); t public.store_support_tickets%rowtype; msgs jsonb;
begin
 if not private.is_store_manager_user(u,_store_id) and not private.is_platform_admin_user(u) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into t from public.store_support_tickets where id=_ticket_id and store_id=_store_id;
 if not found then raise exception 'TICKET_NOT_FOUND' using errcode='P0001'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'authorKind',m.author_kind,'body',m.body,'createdAt',m.created_at) order by m.created_at),'[]'::jsonb) into msgs from public.store_support_messages m where m.ticket_id=t.id and m.store_id=_store_id;
 return jsonb_build_object('ticket',jsonb_build_object('id',t.id,'category',t.category,'subject',t.subject,'status',t.status,'priority',t.priority,'createdAt',t.created_at,'updatedAt',t.updated_at,'resolvedAt',t.resolved_at),'messages',msgs);
end$$;

create or replace function public.reply_my_store_support_ticket(_store_id uuid,_ticket_id uuid,_message text)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare u uuid:=auth.uid(); m text:=nullif(btrim(coalesce(_message,'')),''); t public.store_support_tickets%rowtype;
begin
 if not private.is_store_manager_user(u,_store_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if m is null or char_length(m)>4000 then raise exception 'INVALID_MESSAGE' using errcode='22023'; end if;
 select * into t from public.store_support_tickets where id=_ticket_id and store_id=_store_id for update;
 if not found then raise exception 'TICKET_NOT_FOUND' using errcode='P0001'; end if;
 if t.status='fechado' then raise exception 'TICKET_CLOSED' using errcode='22023'; end if;
 insert into public.store_support_messages(ticket_id,store_id,author_user_id,author_kind,body) values(t.id,_store_id,u,'loja',m);
 update public.store_support_tickets set status=case when status='aguardando_loja' then 'em_atendimento' else status end,last_message_at=now(),updated_at=now(),resolved_at=null where id=t.id returning * into t;
 return jsonb_build_object('ok',true,'ticketId',t.id,'status',t.status,'updatedAt',t.updated_at);
end$$;

create or replace function public.close_my_store_support_ticket(_store_id uuid,_ticket_id uuid)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare u uuid:=auth.uid(); t public.store_support_tickets%rowtype;
begin
 if not private.is_store_manager_user(u,_store_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 update public.store_support_tickets set status='fechado',resolved_at=coalesce(resolved_at,now()),updated_at=now() where id=_ticket_id and store_id=_store_id returning * into t;
 if not found then raise exception 'TICKET_NOT_FOUND' using errcode='P0001'; end if;
 return jsonb_build_object('ok',true,'ticketId',t.id,'status',t.status);
end$$;

create or replace function public.admin_list_store_support_tickets(_status text default null,_limit integer default 100,_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','public','private' as $$
declare u uuid:=auth.uid(); items jsonb; total int;
begin
 if not private.is_platform_admin_user(u) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select count(*) into total from public.store_support_tickets t where _status is null or t.status=_status;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'storeId',x.store_id,'storeName',x.store_name,'category',x.category,'subject',x.subject,'status',x.status,'priority',x.priority,'lastMessageAt',x.last_message_at,'createdAt',x.created_at,'messageCount',x.message_count) order by x.last_message_at desc),'[]'::jsonb) into items from (select t.*,s.name as store_name,(select count(*) from public.store_support_messages m where m.ticket_id=t.id)::int as message_count from public.store_support_tickets t join public.stores s on s.id=t.store_id where _status is null or t.status=_status order by t.last_message_at desc limit least(greatest(coalesce(_limit,100),1),200) offset greatest(coalesce(_offset,0),0)) x;
 return jsonb_build_object('total',total,'items',items);
end$$;

create or replace function public.admin_get_store_support_ticket(_ticket_id uuid)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','public','private' as $$
declare u uuid:=auth.uid(); t record; msgs jsonb;
begin
 if not private.is_platform_admin_user(u) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select st.*,s.name as store_name into t from public.store_support_tickets st join public.stores s on s.id=st.store_id where st.id=_ticket_id;
 if not found then raise exception 'TICKET_NOT_FOUND' using errcode='P0001'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'authorKind',m.author_kind,'body',m.body,'createdAt',m.created_at) order by m.created_at),'[]'::jsonb) into msgs from public.store_support_messages m where m.ticket_id=_ticket_id;
 return jsonb_build_object('ticket',jsonb_build_object('id',t.id,'storeId',t.store_id,'storeName',t.store_name,'category',t.category,'subject',t.subject,'status',t.status,'priority',t.priority,'createdAt',t.created_at,'updatedAt',t.updated_at),'messages',msgs);
end$$;

create or replace function public.admin_reply_store_support_ticket(_ticket_id uuid,_message text,_status text default 'aguardando_loja')
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare u uuid:=auth.uid(); m text:=nullif(btrim(coalesce(_message,'')),''); st text:=lower(btrim(coalesce(_status,''))); t public.store_support_tickets%rowtype;
begin
 if not private.is_platform_admin_user(u) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if m is null or char_length(m)>4000 then raise exception 'INVALID_MESSAGE' using errcode='22023'; end if;
 if st not in ('em_atendimento','aguardando_loja','resolvido','fechado') then raise exception 'INVALID_STATUS' using errcode='22023'; end if;
 select * into t from public.store_support_tickets where id=_ticket_id for update;
 if not found then raise exception 'TICKET_NOT_FOUND' using errcode='P0001'; end if;
 insert into public.store_support_messages(ticket_id,store_id,author_user_id,author_kind,body) values(t.id,t.store_id,u,'admin',m);
 update public.store_support_tickets set status=st,last_message_at=now(),updated_at=now(),resolved_at=case when st in ('resolvido','fechado') then now() else null end where id=t.id returning * into t;
 insert into public.audit_logs(store_id,actor_user_id,actor_kind,action,entity,entity_id,context) values(t.store_id,u,'admin','store.support.admin_replied','store_support_tickets',t.id,jsonb_build_object('status',st));
 return jsonb_build_object('ok',true,'ticketId',t.id,'status',t.status,'updatedAt',t.updated_at);
end$$;

revoke all on function public.open_my_store_support_ticket(uuid,text,text,text) from public,anon;
revoke all on function public.get_my_store_support_center(uuid,integer,integer) from public,anon;
revoke all on function public.get_my_store_support_ticket(uuid,uuid) from public,anon;
revoke all on function public.reply_my_store_support_ticket(uuid,uuid,text) from public,anon;
revoke all on function public.close_my_store_support_ticket(uuid,uuid) from public,anon;
revoke all on function public.admin_list_store_support_tickets(text,integer,integer) from public,anon;
revoke all on function public.admin_get_store_support_ticket(uuid) from public,anon;
revoke all on function public.admin_reply_store_support_ticket(uuid,text,text) from public,anon;
grant execute on function public.open_my_store_support_ticket(uuid,text,text,text) to authenticated,service_role;
grant execute on function public.get_my_store_support_center(uuid,integer,integer) to authenticated,service_role;
grant execute on function public.get_my_store_support_ticket(uuid,uuid) to authenticated,service_role;
grant execute on function public.reply_my_store_support_ticket(uuid,uuid,text) to authenticated,service_role;
grant execute on function public.close_my_store_support_ticket(uuid,uuid) to authenticated,service_role;
grant execute on function public.admin_list_store_support_tickets(text,integer,integer) to authenticated,service_role;
grant execute on function public.admin_get_store_support_ticket(uuid) to authenticated,service_role;
grant execute on function public.admin_reply_store_support_ticket(uuid,text,text) to authenticated,service_role;
