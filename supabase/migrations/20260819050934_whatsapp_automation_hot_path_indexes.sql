create index if not exists customer_channel_consents_customer_idx
  on private.customer_channel_consents(customer_id);

create index if not exists outbound_messages_customer_idx
  on private.outbound_messages(customer_id)
  where customer_id is not null;

create index if not exists outbound_messages_campaign_idx
  on private.outbound_messages(campaign_id)
  where campaign_id is not null;

create index if not exists outbound_messages_template_idx
  on private.outbound_messages(template_id)
  where template_id is not null;

create index if not exists outbound_messages_automation_job_idx
  on private.outbound_messages(automation_job_id)
  where automation_job_id is not null;

create index if not exists orders_store_customer_completed_idx
  on public.orders(store_id,customer_id,created_at desc)
  where customer_id is not null
    and status in ('entregue'::public.order_status,'retirado'::public.order_status);
