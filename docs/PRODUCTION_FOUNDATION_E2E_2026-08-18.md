# Production Foundation E2E — 2026-08-18

## Status

**Aprovada com ressalvas.** The clean external Supabase foundation passed the first disposable end-to-end operational validation against the published Lovable app.

## Environment under test

- GitHub source of truth: `leozera034/project-spark`, branch `main`
- Lovable public app: `shark-cardapio.lovable.app`
- External Supabase project: `ypgteuxzgqmkkkpvibhi`
- Lovable runtime has no service-role capability; privileged work is isolated inside Supabase Edge Functions.

## Defects found and fixed during the E2E

### 1. Restricted Supabase facade was accidentally thenable-hostile

Server modules return the restricted facade through `async` helpers. Promise resolution inspects a returned object's `.then` property. The facade proxy treated that introspection as a forbidden privileged operation and threw before the storefront RPC could execute, causing HTTP 500 on `/loja/:slug`.

Fixed in commit `95294c8af96fad9c723fc8d4a3871ec5deb13cd2` by making the restricted proxy explicitly non-thenable (`then -> undefined`) while keeping unsupported Supabase operations fail-closed.

### 2. Public-domain triggers were omitted by the external schema clone

The external target had all managed Storage triggers but zero user/domain triggers in `public`. This broke tracking-token hashing and would also have affected `updated_at`, archive timestamps, inventory reservation/release and catalog/variant integrity.

Restored in migration `20260818185549_restore_public_domain_triggers`, committed as `64116ece69738cbf477319ff76d277a36a0918b8`.

Trigger parity after restoration:

- Origin public user triggers: **45**
- External public user triggers: **45**
- Origin trigger-definition checksum: `72991748432df408598662011f8de158`
- External trigger-definition checksum: `72991748432df408598662011f8de158`

## E2E coverage proven

The disposable test created two independent tenants and validated:

1. Two owner accounts/stores provisioned through the external Edge onboarding flow.
2. Owner login through external Supabase Auth.
3. Store-scoped authorization context.
4. Tenant A denied reading tenant B configuration.
5. Tenant A denied writing catalog data into tenant B.
6. Authenticated category/product creation for tenant A.
7. Published public storefront route and public catalog loading.
8. Public pickup checkout and full store lifecycle through `retirado`.
9. Courier provisioning through the tenant-authorized Edge action.
10. Tenant B denied resetting tenant A courier credentials.
11. Courier login, mandatory initial password rotation and online presence.
12. Public delivery checkout, store accept/preparation/ready flow, courier assignment and courier lifecycle through final order status `entregue`.
13. Public tracking returned a successful final `delivered` state with items, totals and complete timeline.

The final external probe returned HTTP 200 with all 13 steps passed.

## Cleanup proof

After each disposable run, the external foundation returned to:

- `auth.users = 0`
- `stores = 0`
- `orders = 0`
- `products = 0`
- `couriers = 0`
- `customers = 0`
- `deliveries = 0`
- `user_profiles = 0`
- `user_roles = 0`

`http` and `pg_net` were removed after the probe. Temporary E2E Edge executors were replaced with JWT-protected HTTP 410 tombstones because the available Supabase connector does not expose Edge Function deletion.

The temporary GitHub PR #29 was closed without merge. GitHub Actions jobs failed before any runner step started, so the workflow infrastructure issue is separate from the application E2E result.

## Security verification after E2E

- Public tables without RLS: none.
- Unexpected anonymous SECURITY DEFINER exposure: none beyond the reviewed public slug checker.
- Store provisioning RPC remains unavailable directly to `authenticated`.
- Edge rate limiter remains unavailable to `anon` and `authenticated`.
- Security contract: `security_contract_passed`.

## Remaining P1 launch blockers

1. Verify/configure external Supabase Auth production settings: SMTP provider, email confirmation policy, redirect URLs, CAPTCHA/bot protection and password policy behavior.
2. Define the real commercial plan catalog/billing model before inserting production plans; old R$99/R$189/R$299 values came from a migration explicitly marked development-only and were intentionally not seeded.
3. Repair GitHub Actions runner/workflow infrastructure: the temporary PR run terminated before any step started and produced no job logs.
4. Run visual/browser UX regression on real mobile/desktop surfaces after Auth settings are finalized.

No QA/mock tenant data was migrated into the production foundation.
