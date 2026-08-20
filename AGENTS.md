<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Comandiva — Persistent Agent Instructions

## Mandatory project continuity

For any task involving the SaaS owner/admin panel, stores, users, subscriptions, plans, billing, Stripe, Stripe Connect, payouts, payments, orders, deliveries, drivers, menus/catalogs, add-ons, support, platform health, webhooks, jobs, feature flags, global configuration or administrative security:

1. **Read `docs/OWNER_SAAS_CONTROL_PLANE_IMPLEMENTATION_PLAN.md` before implementing changes.**
2. Treat that file as the persistent implementation roadmap and current source of truth for the SaaS Owner Control Plane.
3. Inspect the real code/database state before creating new tables, functions, routes or components.
4. Prefer completing the next highest-priority unblocked item from the roadmap instead of creating unrelated admin features.
5. Do not mark an item complete merely because frontend UI exists. Completion requires the applicable backend, authorization, auditability, error handling and tests defined in the roadmap.
6. After completing or materially changing roadmap work, update `docs/OWNER_SAAS_CONTROL_PLANE_IMPLEMENTATION_PLAN.md` with status, relevant files, migrations/functions, evidence and newly discovered blockers.
7. Record architecture or business-rule decisions in `docs/DECISION_LOG.md` when they materially alter system behavior.
8. Never implement sensitive administrative operations as direct client-side database edits. Use authorized backend operations with audit trails.
9. Never implement arbitrary financial balance editing or fake payment-state mutation. Follow the financial rules and ledger requirements in the roadmap.
10. Preserve compatibility with the connected Lovable workflow and keep `main` in a working, syncable state.

If current code contradicts the roadmap, do not silently choose one. Inspect the implementation, determine whether the roadmap or code is stale, then update the documentation alongside the implementation so future agents inherit the corrected state.
