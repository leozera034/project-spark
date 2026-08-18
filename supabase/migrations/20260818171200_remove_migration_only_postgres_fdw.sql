-- postgres_fdw was enabled temporarily while evaluating migration options.
-- No foreign server or user mapping is part of the production architecture.
-- Remove the extension so the external Supabase foundation contains only required capabilities.

drop extension if exists postgres_fdw;
