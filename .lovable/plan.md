# Backup audit — evidence collected (read-only)

The audit is done; nothing was edited, restored or changed. Findings are in the chat message.

## Optional next step (needs your approval)

The only thing not yet proven is an **actual restore**. If you want that evidence:

1. Create a throwaway PostgreSQL 17 instance (local/sandbox, never the production project).
2. Run `pg_restore` of the object into that scratch database with `--no-owner --no-privileges`, capturing the full error log.
3. Report: objects created, failed items (expected: Supabase-managed roles/extensions owned by `supabase_admin`), and row counts of `auth.users`, `public.stores`, `public.orders` compared to the archive.
4. Drop the scratch database. Production and the connected backend are never touched.

Say the word and I will run only that drill, still without touching this project's database or code.
