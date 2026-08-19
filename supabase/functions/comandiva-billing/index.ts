import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const MP_API = "https://api.mercadopago.com";
const APP_ORIGIN = "https://shark-cardapio.lovable.app";
const PROVIDER_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 32 * 1024;
const ENVIRONMENT = "production";

type JsonRecord = Record<string, unknown>;
type AuthenticatedUser = { id: string; email: string | null };

type PriceSyncContext = {
  price_id: string;
  addon_id: string;
  addon_code: string;
  addon_name: string;
  billing_interval: "monthly" | "annual";
  amount_cents: number;
  currency: string;
  trial_days: number;
  provider_plan_id: string | null;
  provider_status: string | null;
};

type CheckoutStart = {
  reused: boolean;
  attempt_id: string;
  attempt_status: string;
  subscription_id: string;
  addon_code?: string;
  addon_name?: string;
  provider_plan_id: string;
  provider_status: string | null;
  provider_subscription_id: string | null;
  checkout_url: string | null;
  external_reference: string;
  amount_cents: number;
  currency: string;
  trial_days: number;
  billing_interval: "monthly" | "annual";
  failure_code?: string | null;
};

function parseKeys(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function keyAwareFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (apiKey.startsWith("sb_") && headers.get("Authorization") === `Bearer ${apiKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const modern = parseKeys(Deno.env.get("SUPABASE_SECRET_KEYS"));
  const key = modern.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("backend_configuration_missing");
  return createClient(url, key, {
    global: { fetch: keyAwareFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function allowedOrigin(req: Request): string {
  const origin = req.headers.get("origin") ?? "";
  if (origin === APP_ORIGIN) return origin;
  if (/^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(origin)) return origin;
  return APP_ORIGIN;
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": allowedOrigin(req),
      "access-control-allow-headers": "content-type, authorization, apikey, x-idempotency-key",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      vary: "Origin",
    },
  });
}

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function intValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value);
  return null;
}

function moneyToCents(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const raw = String(value).trim().replace(",", ".");
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) return null;
  const whole = Number(match[2]);
  if (!Number.isSafeInteger(whole)) return null;
  const fractionRaw = match[3] ?? "";
  const firstTwo = (fractionRaw + "00").slice(0, 2);
  const remainder = fractionRaw.slice(2);
  let cents = whole * 100 + Number(firstTwo);
  if (remainder && Number(`0.${remainder}`) >= 0.5) cents += 1;
  return match[1] === "-" ? -cents : cents;
}

async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const admin = adminClient();
  const { data, error } = await admin.rpc("consume_edge_rate_limit", {
    _key: key,
    _limit: limit,
    _window_seconds: windowSeconds,
  } as never);
  return !error && data === true;
}

function mercadoPagoToken(): string | null {
  return Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_PROD")?.trim() || null;
}

function mercadoPagoNotificationUrl(): string | null {
  const raw = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  if (!raw) return null;
  try {
    const base = new URL(raw);
    if (base.protocol !== "https:") return null;
    return `${base.origin}/functions/v1/comandiva-mercadopago-webhook?source_news=webhooks`;
  } catch {
    return null;
  }
}

async function authenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  const raw = req.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(raw);
  if (!match) return null;
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(match[1]);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email?.trim().toLowerCase() || null };
}

async function readBody(req: Request): Promise<JsonRecord | null> {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return null;
  try {
    const value = await req.json();
    return objectValue(value);
  } catch {
    return null;
  }
}

async function mpRequest(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: JsonRecord }> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetch(`${MP_API}${path}`, { ...init, headers, signal: controller.signal });
    const body = objectValue(await response.json().catch(() => ({})));
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function expectedFrequency(interval: "monthly" | "annual"): number {
  return interval === "monthly" ? 1 : 12;
}

function canonicalRecurring(
  interval: "monthly" | "annual",
  amountCents: number,
  currency: string,
  trialDays: number,
): JsonRecord {
  const recurring: JsonRecord = {
    frequency: expectedFrequency(interval),
    frequency_type: "months",
    transaction_amount: amountCents / 100,
    currency_id: currency,
  };
  if (trialDays > 0) {
    recurring.free_trial = { frequency: trialDays, frequency_type: "days" };
  }
  return recurring;
}

function recurringMatches(
  raw: JsonRecord,
  interval: "monthly" | "annual",
  amountCents: number,
  currency: string,
  trialDays: number,
): boolean {
  const recurring = objectValue(raw.auto_recurring);
  const providerAmount = moneyToCents(recurring.transaction_amount);
  const frequency = intValue(recurring.frequency);
  const frequencyType = stringValue(recurring.frequency_type)?.toLowerCase();
  const currencyId = stringValue(recurring.currency_id)?.toUpperCase();
  if (
    providerAmount !== amountCents ||
    frequency !== expectedFrequency(interval) ||
    frequencyType !== "months" ||
    currencyId !== currency.toUpperCase()
  ) return false;

  const freeTrial = objectValue(recurring.free_trial);
  const trialFrequency = intValue(freeTrial.frequency);
  const trialType = stringValue(freeTrial.frequency_type)?.toLowerCase() ?? null;
  if (trialDays <= 0) return trialFrequency == null || trialFrequency === 0;
  return trialFrequency === trialDays && trialType === "days";
}

function planMatches(raw: JsonRecord, context: PriceSyncContext): boolean {
  return stringValue(raw.status)?.toLowerCase() === "active" && recurringMatches(
    raw,
    context.billing_interval,
    context.amount_cents,
    context.currency,
    context.trial_days,
  );
}

function checkoutPreapprovalMatches(raw: JsonRecord, checkout: CheckoutStart): boolean {
  return stringValue(raw.external_reference) === checkout.external_reference && recurringMatches(
    raw,
    checkout.billing_interval,
    checkout.amount_cents,
    checkout.currency,
    checkout.trial_days,
  );
}

function sanitizedProviderFailure(body: JsonRecord): string {
  const message = stringValue(body.message) ?? stringValue(body.error) ?? "provider_request_failed";
  return message.slice(0, 240);
}

async function providerHealth(req: Request): Promise<Response> {
  if (!(await rateLimit("billing:mercadopago:health:minute", 10, 60))) {
    return json(req, { ok: false, error: "rate_limited" }, 429);
  }

  const token = mercadoPagoToken();
  if (!token) {
    return json(req, {
      ok: false,
      provider: "mercado_pago",
      environment: ENVIRONMENT,
      configured: false,
    }, 503);
  }

  try {
    const upstream = await mpRequest(token, "/preapproval/search?limit=1&offset=0", { method: "GET" });
    return json(req, {
      ok: upstream.ok,
      provider: "mercado_pago",
      environment: ENVIRONMENT,
      configured: true,
      connected: upstream.ok,
      upstreamStatus: upstream.status,
    }, upstream.ok ? 200 : 502);
  } catch (error) {
    console.error("[comandiva-billing] provider health failed", error instanceof Error ? error.message : "unknown");
    return json(req, {
      ok: false,
      provider: "mercado_pago",
      environment: ENVIRONMENT,
      configured: true,
      connected: false,
      error: "provider_unreachable",
    }, 502);
  }
}

async function syncAddonPrice(req: Request): Promise<Response> {
  const user = await authenticatedUser(req);
  if (!user) return json(req, { ok: false, error: "unauthorized" }, 401);
  if (!(await rateLimit(`billing:price-sync:${user.id}:minute`, 10, 60))) {
    return json(req, { ok: false, error: "rate_limited" }, 429);
  }

  const body = await readBody(req);
  const addonPriceId = stringValue(body?.addonPriceId);
  if (!addonPriceId || !/^[0-9a-f-]{36}$/i.test(addonPriceId)) {
    return json(req, { ok: false, error: "invalid_addon_price_id" }, 400);
  }
  const token = mercadoPagoToken();
  if (!token) return json(req, { ok: false, error: "provider_not_configured" }, 503);

  const admin = adminClient();
  const { data, error } = await admin.rpc("billing_get_addon_price_sync_context", {
    _actor_user_id: user.id,
    _addon_price_id: addonPriceId,
  } as never);
  if (error) {
    const forbidden = error.code === "42501";
    return json(req, { ok: false, error: forbidden ? "forbidden" : "price_sync_context_failed" }, forbidden ? 403 : 409);
  }
  const context = data as unknown as PriceSyncContext;
  const reason = `Comandiva · ${context.addon_name} · ${context.billing_interval === "monthly" ? "mensal" : "anual"}`.slice(0, 120);
  const planBody: JsonRecord = {
    reason,
    auto_recurring: canonicalRecurring(context.billing_interval, context.amount_cents, context.currency, context.trial_days),
    back_url: `${APP_ORIGIN}/admin/modulos?billing=return`,
  };

  try {
    let plan: JsonRecord | null = null;
    let created = false;

    if (context.provider_plan_id) {
      const current = await mpRequest(token, `/preapproval_plan/${encodeURIComponent(context.provider_plan_id)}`, { method: "GET" });
      if (current.ok && stringValue(current.body.status)?.toLowerCase() === "active") {
        if (planMatches(current.body, context)) {
          plan = current.body;
        } else {
          const updated = await mpRequest(token, `/preapproval_plan/${encodeURIComponent(context.provider_plan_id)}`, {
            method: "PUT",
            body: JSON.stringify(planBody),
          });
          if (!updated.ok) {
            return json(req, { ok: false, error: "provider_plan_update_failed", upstreamStatus: updated.status }, 502);
          }
          plan = planMatches(updated.body, context) ? updated.body : null;
        }
      }
    }

    if (!plan) {
      const search = await mpRequest(
        token,
        `/preapproval_plan/search?status=active&q=${encodeURIComponent(reason)}&limit=50&offset=0`,
        { method: "GET" },
      );
      if (search.ok) {
        const results = Array.isArray(search.body.results) ? search.body.results : [];
        const recovered = results
          .map((item) => objectValue(item))
          .find((item) => stringValue(item.reason) === reason && planMatches(item, context));
        if (recovered) plan = recovered;
      }
    }

    if (!plan) {
      const createdPlan = await mpRequest(token, "/preapproval_plan", {
        method: "POST",
        headers: { "X-Idempotency-Key": `comandiva-price-${context.price_id}` },
        body: JSON.stringify(planBody),
      });
      if (!createdPlan.ok) {
        return json(req, {
          ok: false,
          error: "provider_plan_create_failed",
          upstreamStatus: createdPlan.status,
          providerMessage: sanitizedProviderFailure(createdPlan.body),
        }, createdPlan.status >= 500 ? 502 : 409);
      }
      plan = createdPlan.body;
      created = true;
    }

    const planId = stringValue(plan.id);
    if (!planId || !planMatches(plan, context)) {
      return json(req, { ok: false, error: "provider_plan_validation_failed" }, 409);
    }

    const { data: mapped, error: mapError } = await admin.rpc("billing_upsert_addon_provider_price_ref", {
      _actor_user_id: user.id,
      _addon_price_id: context.price_id,
      _provider_plan_id: planId,
      _provider_status: stringValue(plan.status) ?? "active",
      _metadata: {
        environment: ENVIRONMENT,
        init_point: stringValue(plan.init_point),
        synced_at: new Date().toISOString(),
      },
    } as never);
    if (mapError) return json(req, { ok: false, error: "provider_mapping_failed" }, 500);

    return json(req, {
      ok: true,
      environment: ENVIRONMENT,
      provider: "mercado_pago",
      created,
      plan: {
        id: planId,
        status: stringValue(plan.status),
        initPoint: stringValue(plan.init_point),
      },
      mapping: mapped,
    });
  } catch (providerError) {
    console.error("[comandiva-billing] price sync provider failure", providerError instanceof Error ? providerError.message : "unknown");
    return json(req, { ok: false, error: "provider_unreachable" }, 502);
  }
}

async function findExistingPreapproval(
  token: string,
  payerEmail: string,
  externalReference: string,
): Promise<JsonRecord | null> {
  const search = await mpRequest(
    token,
    `/preapproval/search?payer_email=${encodeURIComponent(payerEmail)}&limit=50&offset=0`,
    { method: "GET" },
  );
  if (!search.ok) return null;
  const results = Array.isArray(search.body.results) ? search.body.results : [];
  const found = results
    .map((item) => objectValue(item))
    .find((item) => stringValue(item.external_reference) === externalReference);
  return found ?? null;
}

async function createAddonCheckout(req: Request): Promise<Response> {
  const user = await authenticatedUser(req);
  if (!user) return json(req, { ok: false, error: "unauthorized" }, 401);
  if (!user.email) return json(req, { ok: false, error: "account_email_required" }, 409);

  const body = await readBody(req);
  const storeId = stringValue(body?.storeId);
  const addonCode = stringValue(body?.addonCode);
  const billingInterval = stringValue(body?.billingInterval) ?? "monthly";
  const idempotencyKey = req.headers.get("x-idempotency-key")?.trim() ?? "";
  if (!storeId || !/^[0-9a-f-]{36}$/i.test(storeId) || !addonCode || !/^[a-z0-9_]+$/.test(addonCode)) {
    return json(req, { ok: false, error: "invalid_checkout_request" }, 400);
  }
  if (billingInterval !== "monthly" && billingInterval !== "annual") {
    return json(req, { ok: false, error: "invalid_billing_interval" }, 400);
  }
  if (idempotencyKey.length < 8 || idempotencyKey.length > 160) {
    return json(req, { ok: false, error: "idempotency_key_required" }, 400);
  }
  if (!(await rateLimit(`billing:addon-checkout:${user.id}:${storeId}:minute`, 8, 60))) {
    return json(req, { ok: false, error: "rate_limited" }, 429);
  }
  const token = mercadoPagoToken();
  if (!token) return json(req, { ok: false, error: "provider_not_configured" }, 503);
  const notificationUrl = mercadoPagoNotificationUrl();
  if (!notificationUrl) return json(req, { ok: false, error: "webhook_url_not_configured" }, 503);

  const admin = adminClient();
  const { data: startData, error: startError } = await admin.rpc("billing_begin_addon_checkout", {
    _actor_user_id: user.id,
    _store_id: storeId,
    _addon_code: addonCode,
    _billing_interval: billingInterval,
    _idempotency_key: idempotencyKey,
  } as never);
  if (startError) {
    const forbidden = startError.code === "42501";
    return json(req, {
      ok: false,
      error: forbidden ? "forbidden" : "addon_purchase_not_ready",
      detail: forbidden ? undefined : startError.details ?? null,
    }, forbidden ? 403 : 409);
  }

  const checkout = startData as unknown as CheckoutStart;
  if (checkout.checkout_url && checkout.provider_subscription_id) {
    return json(req, {
      ok: true,
      reused: true,
      environment: ENVIRONMENT,
      provider: "mercado_pago",
      attemptId: checkout.attempt_id,
      status: checkout.provider_status ?? "pending",
      checkoutUrl: checkout.checkout_url,
    });
  }

  const { data: claimData, error: claimError } = await admin.rpc("billing_claim_addon_checkout_provider_create", {
    _actor_user_id: user.id,
    _attempt_id: checkout.attempt_id,
  } as never);
  if (claimError) return json(req, { ok: false, error: "checkout_claim_failed" }, 500);
  const claim = objectValue(claimData);
  if (claim.claimed !== true) {
    if (stringValue(claim.checkout_url)) {
      return json(req, {
        ok: true,
        reused: true,
        environment: ENVIRONMENT,
        provider: "mercado_pago",
        attemptId: checkout.attempt_id,
        status: stringValue(claim.attempt_status) ?? "pending",
        checkoutUrl: stringValue(claim.checkout_url),
      });
    }
    return json(req, { ok: false, error: "checkout_in_progress", retryable: true }, 409);
  }

  try {
    const plan = await mpRequest(token, `/preapproval_plan/${encodeURIComponent(checkout.provider_plan_id)}`, { method: "GET" });
    const planContext: PriceSyncContext = {
      price_id: "",
      addon_id: "",
      addon_code: addonCode,
      addon_name: addonCode,
      billing_interval: checkout.billing_interval,
      amount_cents: checkout.amount_cents,
      currency: checkout.currency,
      trial_days: checkout.trial_days,
      provider_plan_id: checkout.provider_plan_id,
      provider_status: checkout.provider_status,
    };

    if (!plan.ok || !planMatches(plan.body, planContext)) {
      const { data: subscriptionRow } = await admin
        .from("store_addon_subscriptions")
        .select("addon_price_id")
        .eq("id", checkout.subscription_id)
        .maybeSingle();
      const priceId = stringValue(subscriptionRow?.addon_price_id);
      if (priceId) {
        await admin.rpc("billing_mark_addon_provider_price_stale", {
          _addon_price_id: priceId,
          _reason: !plan.ok ? `provider_plan_lookup_${plan.status}` : "provider_plan_mismatch",
        } as never);
      }
      await admin.rpc("billing_mark_addon_checkout_error", {
        _actor_user_id: user.id,
        _attempt_id: checkout.attempt_id,
        _failure_code: "provider_plan_stale",
        _last_error: "Provider plan no longer matches canonical Comandiva price.",
        _definitive: true,
      } as never);
      return json(req, { ok: false, error: "provider_price_requires_resync" }, 409);
    }

    let preapproval = await findExistingPreapproval(token, user.email, checkout.external_reference);
    if (preapproval && !checkoutPreapprovalMatches(preapproval, checkout)) {
      await admin.rpc("billing_mark_addon_checkout_error", {
        _actor_user_id: user.id,
        _attempt_id: checkout.attempt_id,
        _failure_code: "provider_recovery_mismatch",
        _last_error: "Recovered provider subscription does not match canonical checkout.",
        _definitive: true,
      } as never);
      return json(req, { ok: false, error: "provider_recovery_mismatch" }, 409);
    }

    if (!preapproval) {
      const createBody: JsonRecord = {
        reason: `Comandiva · ${addonCode}`.slice(0, 120),
        external_reference: checkout.external_reference,
        payer_email: user.email,
        auto_recurring: canonicalRecurring(
          checkout.billing_interval,
          checkout.amount_cents,
          checkout.currency,
          checkout.trial_days,
        ),
        back_url: `${APP_ORIGIN}/app/loja/modulos?billing=return`,
        notification_url: notificationUrl,
        status: "pending",
      };
      const created = await mpRequest(token, "/preapproval", {
        method: "POST",
        headers: { "X-Idempotency-Key": checkout.attempt_id },
        body: JSON.stringify(createBody),
      });
      if (!created.ok) {
        const definitive = created.status >= 400 && created.status < 500;
        await admin.rpc("billing_mark_addon_checkout_error", {
          _actor_user_id: user.id,
          _attempt_id: checkout.attempt_id,
          _failure_code: `provider_create_${created.status}`,
          _last_error: sanitizedProviderFailure(created.body),
          _definitive: definitive,
        } as never);
        return json(req, {
          ok: false,
          error: definitive ? "provider_checkout_rejected" : "provider_unavailable",
          upstreamStatus: created.status,
        }, definitive ? 409 : 502);
      }
      preapproval = created.body;
    }

    const providerSubscriptionId = stringValue(preapproval.id);
    const checkoutUrl = stringValue(preapproval.init_point);
    const providerStatus = stringValue(preapproval.status) ?? "pending";
    if (!providerSubscriptionId || !checkoutUrl || !checkoutPreapprovalMatches(preapproval, checkout)) {
      await admin.rpc("billing_mark_addon_checkout_error", {
        _actor_user_id: user.id,
        _attempt_id: checkout.attempt_id,
        _failure_code: "provider_checkout_validation_failed",
        _last_error: "Provider checkout response failed canonical validation.",
        _definitive: true,
      } as never);
      return json(req, { ok: false, error: "provider_checkout_validation_failed" }, 409);
    }

    const { data: completed, error: completeError } = await admin.rpc("billing_complete_addon_checkout_provider_create", {
      _actor_user_id: user.id,
      _attempt_id: checkout.attempt_id,
      _provider_subscription_id: providerSubscriptionId,
      _provider_status: providerStatus,
      _checkout_url: checkoutUrl,
    } as never);
    if (completeError) {
      console.error("[comandiva-billing] checkout attach failed", completeError.code ?? "unknown");
      return json(req, { ok: false, error: "checkout_attach_failed", retryable: true }, 500);
    }

    return json(req, {
      ok: true,
      reused: checkout.reused,
      environment: ENVIRONMENT,
      provider: "mercado_pago",
      attemptId: checkout.attempt_id,
      status: providerStatus,
      checkoutUrl,
      checkout: completed,
    });
  } catch (providerError) {
    console.error("[comandiva-billing] checkout provider failure", providerError instanceof Error ? providerError.message : "unknown");
    await admin.rpc("billing_mark_addon_checkout_error", {
      _actor_user_id: user.id,
      _attempt_id: checkout.attempt_id,
      _failure_code: "provider_unreachable",
      _last_error: providerError instanceof Error ? providerError.message.slice(0, 300) : "provider_unreachable",
      _definitive: false,
    } as never);
    return json(req, { ok: false, error: "provider_unreachable", retryable: true }, 502);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(req, { ok: true });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (req.method === "GET" && action === "provider_health") return providerHealth(req);
  if (req.method === "POST" && action === "sync_addon_price") return syncAddonPrice(req);
  if (req.method === "POST" && action === "create_addon_checkout") return createAddonCheckout(req);

  if (
    action === "public_config" ||
    action === "create_test_subscription" ||
    action === "create_pending_test_subscription"
  ) {
    return json(req, { ok: false, error: "endpoint_retired_checkout_not_enabled" }, 410);
  }

  return json(req, { ok: false, error: "action_not_allowed" }, 403);
});