# WhatsApp Partner Add-on

## Product rule
WhatsApp automation is an optional paid add-on. Comandiva must not purchase or provision provider infrastructure before the store payment is confirmed.

## Target flow
1. Store requests WhatsApp add-on.
2. Billing creates/identifies the add-on charge.
3. Payment webhook marks provisioning request `paid`.
4. Backend selects the configured partner/BSP and starts provisioning.
5. Store completes provider Embedded Signup/onboarding when required.
6. Provider webhook confirms the WhatsApp channel.
7. Backend stores provider identifiers and credential references server-side only.
8. Provider account becomes `connected`; provisioning becomes `active`.
9. Entitlement `whatsapp_automation` is enabled only after payment + successful provisioning.
10. Cancellation/non-payment transitions to `suspended`/`cancelled` and blocks new dispatches.

## State machine
`awaiting_payment -> paid -> provisioning -> awaiting_customer -> active`

Exceptional states: `degraded`, `failed`, `suspended`, `cancelled`.

## Provider contract
A production partner adapter must support, where the provider exposes it:
- create/provision customer/channel by API;
- Embedded Signup or secure onboarding URL;
- provider account/channel status lookup;
- outbound message API;
- inbound/status webhooks;
- cancellation/suspension;
- usage/metering identifiers;
- credential rotation.

## Security rules
- Never expose provider API keys to the browser.
- Secrets live in Supabase Vault/Edge Function secrets; database rows store only credential references.
- Webhooks must be authenticated before mutating business data.
- Every payment/provider callback must be idempotent.
- Store scoping is mandatory for every user-facing operation.
- Do not enable the entitlement merely because checkout was opened.
- Do not auto-retry ambiguous provider sends that could duplicate a WhatsApp message.

## Commercial rule
Provider selection is deliberately deferred. A provider is approved only after unit economics and partner API capabilities are verified. Fixed platform fees must not be introduced merely to run QA.

## Existing reusable components
The existing automation queue, templates, consent checks, usage limits, idempotency, worker secret, cron worker and provider-account abstraction remain reusable. Provider-specific transport belongs behind the worker adapter.
