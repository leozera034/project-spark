alter table private.whatsapp_webhook_events enable row level security;
alter table private.whatsapp_pending_message_statuses enable row level security;

revoke all on table private.whatsapp_webhook_events from public, anon, authenticated;
revoke all on table private.whatsapp_pending_message_statuses from public, anon, authenticated;
