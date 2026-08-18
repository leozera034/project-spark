# Pediu Aqui — External Supabase Foundation Status

Date: 2026-08-18

## Decision that supersedes the earlier migration assumption

The legacy Lovable-managed Supabase project (`ifbjwguffmuwxsxzotmr`) contains QA/demo/mock data only. No legacy Auth user, store, order, courier, catalog item, payment, file, or historical event is considered production data.

Therefore the production strategy is **not** a state migration. The approved strategy is a clean production foundation on external Supabase project `ypgteuxzgqmkkkpvibhi`, followed by creation of real production tenants from zero.

## External foundation state

Expected business state before the first real signup:

- Auth users: 0
- Stores: 0
- Orders: 0
- Products: 0
- Storage objects: 0
- Commercial plans: 0 until real pricing is approved
- System category profiles: 9
- System order transition reasons: 8

The category profiles and order transition reasons are deterministic product foundation data, not legacy tenant data.

## Runtime architecture

- Browser Auth/Data target: external Supabase `ypgteuxzgqmkkkpvibhi` only.
- Auth middleware validates Bearer tokens against the external Auth service only.
- The Lovable runtime does **not** consume a Supabase service-role/secret key.
- Privileged operations execute only inside narrow Supabase Edge Functions.
- `pediu-backend-api` handles the operational allowlist: public storefront RPCs, public asset signing, store onboarding, courier provisioning and courier access reset.
- `pediu-public-support` handles the support allowlist: active commercial plans, active public store slugs and sanitized client error ingestion.
- The old `spark-storage-migrate-once` endpoint is retired as a JWT-protected HTTP 410 tombstone and performs no database, Storage or secret access.

## Security properties already enforced

- RLS enabled on every public table.
- Public schema default privileges hardened.
- Server-only rate-limit table with no anon/authenticated access.
- Edge RPC/action allowlists fail closed.
- Storefront asset signing only signs paths currently referenced by public/active entities.
- Store onboarding and public order submission have database-backed distributed rate limits.
- Courier privileged actions revalidate the external user JWT inside Supabase before tenant authorization.
- QA/demo runtime route and QA preview secrets were removed.

## Intentionally not copied from QA

- Auth users and identities
- Sessions and refresh tokens
- Stores and memberships
- Catalog and inventory
- Orders, customers and deliveries
- Couriers
- Subscription/payment history
- Storage objects
- QA/demo accounts and preview sessions

## Commercial data

The historical R$99/R$189/R$299 plans are not seeded into production because their original migration explicitly described them as development validation data. Store provisioning works without a commercial plan and skips subscription creation until real pricing is approved.

## Remaining pre-launch P1 items

1. Verify/configure external Supabase Auth settings that are not exposed by the current connector: production Site URL, redirect allowlist, custom SMTP, email verification policy and CAPTCHA/Turnstile policy.
2. Complete the formal per-RPC authorization matrix for authenticated SECURITY DEFINER functions. Initial static/manual review found tenant permission/current-courier guards in sampled wrappers.
3. Obtain observable CI proof for GitHub push runs. The repository Quality Gate includes build/typecheck/lint and real external Edge contract tests, but the current GitHub connector does not expose private push workflow runs reliably.
4. Run a controlled first-real-tenant E2E: signup -> login -> store -> catalog -> public storefront -> checkout -> order operations -> courier -> tracking -> multi-tenant isolation.
5. Define real production pricing before enabling billing/subscriptions.

## Production-readiness status

External backend foundation: **Approved with reservations**.

Broad commercial launch: **Not yet approved** until P1 Auth configuration and first-real-tenant E2E are completed.
