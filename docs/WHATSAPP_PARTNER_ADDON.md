# WhatsApp Add-on — self-hosted Evolution

## Product rule

WhatsApp automation is an optional store capability. The primary non-official transport is a Comandiva-operated Evolution API installation, shared across stores and isolated by one Evolution instance per `store_id`.

The merchant must never need an account, subscription, API key or configuration step on an external WhatsApp provider dashboard.

## Target flow

1. Store requests/activates the WhatsApp add-on inside Comandiva.
2. Billing confirms the commercial entitlement. Opening checkout alone is never enough.
3. The merchant opens **Central WhatsApp** inside Comandiva.
4. `comandiva-evolution-onboarding` creates or reuses the store's dedicated Evolution instance.
5. The QR Code is returned to Comandiva and rendered inside the merchant panel.
6. The merchant scans the QR from WhatsApp → Aparelhos conectados.
7. Comandiva polls the connection state and persists it in `private.integration_provider_accounts`.
8. The channel becomes `connected`; the merchant can send a manual test message immediately.
9. Automatic jobs continue through `comandiva-whatsapp-worker`, using the same Evolution runtime.
10. Suspension/cancellation blocks new automatic dispatches according to entitlement/billing rules.

No merchant-facing redirect to Evolution exists.

## State machine

Commercial provisioning keeps the existing model:

`awaiting_payment -> paid -> provisioning -> awaiting_customer -> active`

Exceptional states: `degraded`, `failed`, `suspended`, `cancelled`.

The Evolution account itself uses the provider-account states `pending`, `connected`, `degraded`, `disconnected` and `disabled`.

## Provider architecture

The Comandiva contract remains provider-agnostic even with Evolution as the primary engine.

Required capabilities:

- create/reuse one session per store;
- generate QR/pairing code;
- inspect connection status;
- send text/media through backend only;
- disconnect/reconnect;
- receive provider delivery/status events when enabled;
- preserve idempotency and store scoping;
- allow a future fallback provider without rewriting the merchant UI.

Current primary provider code: `evolution_api`.

Official Meta support can remain as a future/secondary transport; it is no longer required for the self-service QR onboarding path.

## Security rules

- Never expose the Evolution global API key to the browser.
- `EVOLUTION_API_BASE_URL` and `EVOLUTION_API_KEY` live only in Edge Function secrets/backend runtime.
- Instance names are internal identifiers and are never treated as authorization.
- Every user operation first proves store access through authenticated RPCs.
- Provider state mutations use service-role-only RPCs.
- Payment/provider callbacks and outbound sends remain idempotent where a retry could duplicate a message.
- Manual sends are recorded in the Comandiva outbound history and usage ledger.
- Do not silently retry an ambiguous send result.
- The browser receives only safe connection state, QR/pairing material and non-secret public metadata.

## Commercial rule

Self-hosting removes the dependency on a per-store monthly API-provider fee. It does **not** make infrastructure free: Comandiva still pays shared compute, database, bandwidth, monitoring and operations.

The add-on price remains a Comandiva commercial decision. Do not publish a price or mark the add-on as generally available until the unit economics and real-number homologation are complete.

## Existing reusable components

The existing Stripe add-on checkout, entitlement engine, provisioning state machine, automation queue, templates, consent checks, usage limits, idempotency, cron worker and provider-account abstraction are reused.

New self-service pieces:

- `comandiva-evolution-onboarding` Edge Function;
- `get_store_evolution_whatsapp_connection` RPC;
- secure provider-state persistence RPC;
- QR/pairing flow in the Central WhatsApp;
- manual send action with history/usage recording.

## Release gate

Do not advertise the Evolution path as production-homologated until all of these have passed with a dedicated test number:

- instance creation;
- QR scan;
- reconnect after service restart;
- manual outbound message;
- automatic transactional message;
- delivery/status reconciliation when enabled;
- disconnect/reconnect;
- billing suspension behavior;
- secret rotation procedure.
