# Mercado Pago test integration proof — 2026-08-18

## Scope

This document records the non-secret proof of the Comandiva billing integration with Mercado Pago in the test environment.

## Verified

- Mercado Pago application configured for subscriptions.
- Test Access Token stored only as a Supabase Edge Function secret under `MERCADO_PAGO_ACCESS_TOKEN_TEST`.
- `comandiva-billing` Edge Function deployed on the external production-foundation Supabase project.
- Provider health probe reached Mercado Pago successfully in the test environment.
- A temporary R$ 1.00/month sandbox subscription artifact was created only for provider connectivity testing.
- Public/temporary sandbox subscription bootstrap actions are retired; the billing function no longer exposes an unauthenticated subscription-creation route.
- `comandiva-mercadopago-webhook` validates Mercado Pago HMAC-SHA256 notifications using `x-signature`, `x-request-id` and the signed `data.id` query parameter.
- The webhook rejects live events while configured for test mode.
- Webhook events are persisted idempotently into `private.billing_webhook_events` only after signature validation.
- Processable subscription/payment notifications are re-fetched from Mercado Pago before being finalized as verified.
- Only a sanitized provider snapshot is persisted; payer e-mail, card data and unrelated provider payload fields are not copied into the billing inbox.
- Unknown event types and provider-plan notifications are retained auditably as ignored instead of mutating canonical billing state.
- Provider lookup failures remain marked as failed and return a retryable non-2xx response.
- No webhook event is currently allowed to mutate `store_subscriptions` or `subscription_payments`; canonical state changes remain disabled until the real webhook path is validated end-to-end.
- No production commercial subscription or payment was created by this hardening block.

## Still required before subscription E2E

1. Configure the Mercado Pago application's TEST webhook URL to the deployed `comandiva-mercadopago-webhook` endpoint.
2. Enable at least the subscription/payment topics required by the integration: `subscription_preapproval`, `subscription_authorized_payment` and `payment`.
3. Save the generated TEST webhook secret in Supabase as `MERCADO_PAGO_WEBHOOK_SECRET_TEST`.
4. Trigger Mercado Pago's test notification and verify: HMAC accepted, duplicate delivery idempotent, provider resource lookup successful, event finalized as `processed`.
5. Only after that validation, implement the authenticated/store-scoped checkout intent and canonical state application.
6. Execute the first Buyer Test User subscription checkout only after the checkout endpoint is idempotent and the webhook path is green.

## Security notes

- No Mercado Pago credential is committed to GitHub.
- No Access Token or webhook secret is returned by an Edge Function.
- Billing provider identifiers remain gateway-agnostic in the database.
- Production credentials remain intentionally unconfigured.
- Production billing must not be enabled by merely changing an environment variable; the state-application and checkout blocks require their own review and validation.
