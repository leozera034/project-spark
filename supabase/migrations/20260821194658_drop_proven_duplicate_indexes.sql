-- Keep constraint-backed/most recent unique indexes and remove only exact
-- duplicates reported by the database advisor.

drop index if exists private.financial_journals_event_key_uidx;
drop index if exists public.user_roles_store_unique_idx;
