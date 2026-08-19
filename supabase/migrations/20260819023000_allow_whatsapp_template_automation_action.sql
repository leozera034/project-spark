alter table public.store_automation_rules
  drop constraint if exists store_automation_rules_action_code_check;

alter table public.store_automation_rules
  add constraint store_automation_rules_action_code_check
  check (action_code in ('sugerir_whatsapp','criar_tarefa','send_whatsapp_template'));
