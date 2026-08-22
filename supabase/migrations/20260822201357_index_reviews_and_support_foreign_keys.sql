create index if not exists idx_store_reviews_customer_id_fk on public.store_reviews(customer_id) where customer_id is not null;
create index if not exists idx_store_reviews_replied_by_fk on public.store_reviews(replied_by) where replied_by is not null;
create index if not exists idx_store_support_tickets_created_by_fk on public.store_support_tickets(created_by) where created_by is not null;
create index if not exists idx_store_support_messages_store_id_fk on public.store_support_messages(store_id);
create index if not exists idx_store_support_messages_author_user_id_fk on public.store_support_messages(author_user_id) where author_user_id is not null;
