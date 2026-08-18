# Mercado Pago test integration proof — 2026-08-18

## Scope

This document records the non-secret proof of the Comandiva billing integration with Mercado Pago in the test environment.

## Verified

- Mercado Pago application configured for subscriptions.
- Test Access Token stored only as a Supabase Edge Function secret under `MERCADO_PAGO_ACCESS_TOKEN_TEST`.
- `comandiva-billing` Edge Function deployed on the external production-foundation Supabase project.
- Provider health probe reached Mercado Pago `/preapproval_plan/search` and returned HTTP 200.
- A test-only subscription plan was created successfully at R$ 1.00/month in the Mercado Pago test environment.
- The temporary bootstrap route used to create that plan was removed immediately after use.
- Final `comandiva-billing` deployment exposes only the provider health probe at this stage.
- `comandiva-mercadopago-webhook` Edge Function deployed with HMAC-SHA256 validation compatible with Mercado Pago's `x-signature` + `x-request-id` contract.
- The webhook rejects live events while configured for test mode.
- Webhook events are persisted idempotently into `private.billing_webhook_events` only after signature validation.
- No production commercial plan, price, subscription, customer, or payment was created in Comandiva's database.
- Temporary Postgres `http` extension used for the internal provider probe was removed after verification.

## Still required before subscription E2E

1. Configure the Mercado Pago application's TEST webhook URL to the deployed `comandiva-mercadopago-webhook` endpoint.
2. Enable subscription/payment topics needed by the billing state machine.
3. Save the generated test webhook secret in Supabase as `MERCADO_PAGO_WEBHOOK_SECRET_TEST`.
4. Trigger Mercado Pago's test notification and verify HMAC validation + idempotent persistence.
5. Only after webhook validation, execute a Buyer Test User subscription checkout using the test plan.

## Security notes

- No Mercado Pago credential is committed to GitHub.
- No Access Token is returned by an Edge Function.
- Billing provider identifiers remain gateway-agnostic in the database.
- Production credentials remain intentionally unconfigured.
