# External Supabase cutover — 2026-08-18

Target project: `ypgteuxzgqmkkkpvibhi` (`sa-east-1`).

## Migration status

- PostgreSQL schema and live migration history copied from the live Spark database.
- Auth users and identities copied with UUIDs and password hashes preserved.
- Public data copied and row/content parity validated.
- RLS flags, policies, grants, triggers, Realtime publication membership, views and routines reproduced from the live source catalog.
- Storage buckets and the existing object copied and validated.
- Temporary database bridge, migration role and temporary Storage access were removed after validation.
- The old source database remains available as a rollback source; it is not the runtime target of this branch.

## Required runtime configuration before merge/deploy

Browser-safe:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Server-only:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY` must never be exposed through a `VITE_` variable or committed to the repository.

## Cutover gates

- [x] Database structure migrated.
- [x] Public data parity checked.
- [x] Auth identities/hash preservation checked.
- [x] Storage parity checked.
- [x] Database security/catalog parity checked.
- [x] Old hard-coded Supabase fallback removed from application code.
- [ ] Runtime/deployment environment confirmed with external Supabase variables.
- [ ] External Supabase Auth project-level URL/redirect settings confirmed.
- [ ] CI/build checks green on the cutover branch.
- [ ] Post-deploy login and storefront smoke test completed.

## Expected session behavior

Existing sessions issued by the previous Supabase project are not portable to a project with a different JWT secret. Users should be expected to authenticate again after cutover; account UUIDs and password hashes were preserved.
