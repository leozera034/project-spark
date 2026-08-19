import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const MP_API = "https://api.mercadopago.com";
const MAX_BODY_BYTES = 64 * 1024;
const SIGNATURE_TOLERANCE_SECONDS = 600;
const PROVIDER_TIMEOUT_MS = 8_000;
const PROCESSABLE_EVENT_TYPES = new Set([
  "subscription_preapproval",
  "subscription_authorized_payment",
  "payment",
]);
const IGNORED_EVENT_TYPES = new Set(["subscription_preapproval_plan"]);

type JsonRecord = Record<string, unknown>;

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

function response(status: number, body: unknown = { ok: true }): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function parseSignature(raw: string): { ts?: string; v1?: string } {
  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of raw.split(",")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (key === "ts") ts = value;
    if (key === "v1") v1 = value;
  }
  return { ts, v1 };
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeHexEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function normalizeDataId(value: string): string {
  const trimmed = value.trim();
  return /^[a-z0-9]+$/i.test(trimmed) ? trimmed.toLowerCase() : trimmed;
}

async function validSignature(req: Request, dataIdRaw: string, secret: string): Promise<boolean> {
  const xSignature = req.headers.get("x-signature")?.trim() ?? "";
  const xRequestId = req.headers.get("x-request-id")?.trim() ?? "";
  if (!xSignature) return false;

  const { ts, v1 } = parseSignature(xSignature);
  if (!ts || !v1 || !/^\d+$/.test(ts)) return false;

  const tsNumber = Number(ts);
  const tsMs = tsNumber > 10_000_000_000 ? tsNumber : tsNumber * 1000;
  const drift = Math.abs(Date.now() - tsMs) / 1000;
  if (!Number.isFinite(drift) || drift > SIGNATURE_TOLERANCE_SECONDS) return false;

  const parts: string[] = [];
  const dataId = normalizeDataId(dataIdRaw);
  if (dataId) parts.push(`id:${dataId}`);
  if (xRequestId) parts.push(`request-id:${xRequestId}`);
  parts.push(`ts:${ts}`);
  const manifest = `${parts.join(";")};`;

  const computed = await hmacSha256Hex(secret, manifest);
  return constantTimeHexEquals(computed, v1);
}

function payloadDataId(payload: JsonRecord): string {
  const data = payload.data;
  if (!data || typeof data !== "object") return "";
  const value = (data as JsonRecord).id;
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function providerResourceUrl(eventType: string, resourceId: string): string | null {
  const id = encodeURIComponent(resourceId);
  if (eventType === "subscription_preapproval") return `${MP_API}/preapproval/${id}`;
  if (eventType === "subscription_authorized_payment") return `${MP_API}/authorized_payments/${id}`;
  if (eventType === "payment") return `${MP_API}/v1/payments/${id}`;
  return null;
}

function scalar(value: unknown): string | number | boolean | null {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? value
    : null;
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

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function sanitizedNotification(payload: JsonRecord) {
  const data = objectValue(payload.data);
  return {
    id: scalar(payload.id),
    live_mode: scalar(payload.live_mode),
    type: scalar(payload.type),
    action: scalar(payload.action),
    date_created: scalar(payload.date_created),
    api_version: scalar(payload.api_version),
    data: { id: scalar(data.id) },
  };
}

function sanitizedSnapshot(eventType: string, raw: JsonRecord) {
  if (eventType === "subscription_preapproval") {
    const recurring = objectValue(raw.auto_recurring);
    const freeTrial = objectValue(recurring.free_trial);
    return {
      id: scalar(raw.id),
      status: scalar(raw.status),
      external_reference: scalar(raw.external_reference),
      preapproval_plan_id: scalar(raw.preapproval_plan_id),
      reason: scalar(raw.reason),
      date_created: scalar(raw.date_created),
      last_modified: scalar(raw.last_modified),
      next_payment_date: scalar(raw.next_payment_date),
      auto_recurring: {
        frequency: scalar(recurring.frequency),
        frequency_type: scalar(recurring.frequency_type),
        transaction_amount: scalar(recurring.transaction_amount),
        currency_id: scalar(recurring.currency_id),
        start_date: scalar(recurring.start_date),
        end_date: scalar(recurring.end_date),
        free_trial: {
          frequency: scalar(freeTrial.frequency),
          frequency_type: scalar(freeTrial.frequency_type),
        },
      },
    };
  }

  if (eventType === "subscription_authorized_payment") {
    return {
      id: scalar(raw.id),
      status: scalar(raw.status),
      preapproval_id: scalar(raw.preapproval_id),
      payment_id: scalar(raw.payment_id),
      transaction_amount: scalar(raw.transaction_amount),
      currency_id: scalar(raw.currency_id),
      debit_date: scalar(raw.debit_date),
      date_created: scalar(raw.date_created),
      last_modified: scalar(raw.last_modified),
    };
  }

  return {
    id: scalar(raw.id),
    status: scalar(raw.status),
    status_detail: scalar(raw.status_detail),
    transaction_amount: scalar(raw.transaction_amount),
    currency_id: scalar(raw.currency_id),
    external_reference: scalar(raw.external_reference),
    date_created: scalar(raw.date_created),
    date_approved: scalar(raw.date_approved),
    date_last_updated: scalar(raw.date_last_updated),
  };
}

async function fetchProviderJson(accessToken: string, url: string): Promise<{ ok: boolean; status: number; body: JsonRecord }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    return { ok: upstream.ok, status: upstream.status, body: objectValue(await upstream.json().catch(() => ({}))) };
  } finally {
    clearTimeout(timer);
  }
}

async function finalizeEvent(
  admin: ReturnType<typeof adminClient>,
  providerEventKey: string,
  processingStatus: "processed" | "ignored" | "failed",
  providerSnapshot: JsonRecord | null,
  lastError: string | null,
) {
  const { data, error } = await admin.rpc("finalize_mercado_pago_webhook_event", {
    p_provider_event_key: providerEventKey,
    p_processing_status: processingStatus,
    p_provider_snapshot: providerSnapshot,
    p_last_error: lastError,
  });
  if (error || data !== true) {
    console.error("[comandiva-mercadopago-webhook] finalize failed", error?.code ?? "event_not_found");
    return false;
  }
  return true;
}

async function reconcileAddonPreapproval(
  admin: ReturnType<typeof adminClient>,
  raw: JsonRecord,
): Promise<{ relevant: boolean; ok: boolean; error?: string }> {
  const externalReference = stringValue(raw.external_reference);
  if (!externalReference?.startsWith("comandiva:addon:")) return { relevant: false, ok: true };

  const recurring = objectValue(raw.auto_recurring);
  const providerSubscriptionId = stringValue(raw.id);
  const providerStatus = stringValue(raw.status);
  const amountCents = moneyToCents(recurring.transaction_amount);
  const currency = stringValue(recurring.currency_id);
  const frequency = intValue(recurring.frequency);
  const frequencyType = stringValue(recurring.frequency_type);
  const nextPaymentDate = stringValue(raw.next_payment_date);

  if (!providerSubscriptionId || !providerStatus || amountCents == null || !currency || frequency == null || !frequencyType) {
    return { relevant: true, ok: false, error: "addon_preapproval_snapshot_incomplete" };
  }

  const { error } = await admin.rpc("billing_reconcile_mercado_pago_preapproval", {
    _provider_subscription_id: providerSubscriptionId,
    _provider_status: providerStatus,
    _external_reference: externalReference,
    _amount_cents: amountCents,
    _currency: currency,
    _frequency: frequency,
    _frequency_type: frequencyType,
    _next_payment_date: nextPaymentDate,
  } as never);

  if (error) {
    console.error("[comandiva-mercadopago-webhook] addon reconciliation rejected", error.code ?? "unknown");
    return { relevant: true, ok: false, error: `addon_reconcile_${error.message?.slice(0, 120) ?? error.code ?? "failed"}` };
  }
  return { relevant: true, ok: true };
}

Deno.serve(async (req: Request) => {
  const webhookSecret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET_TEST")?.trim() ?? "";
  const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_TEST")?.trim() ?? "";

  if (req.method === "GET") {
    return response(webhookSecret ? 200 : 503, {
      ok: Boolean(webhookSecret),
      provider: "mercado_pago",
      environment: "test",
      webhookConfigured: Boolean(webhookSecret),
      providerLookupConfigured: Boolean(accessToken),
    });
  }

  if (req.method !== "POST") return response(405, { ok: false, error: "method_not_allowed" });

  const length = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return response(413, { ok: false, error: "payload_too_large" });
  }
  if (!webhookSecret) return response(503, { ok: false, error: "webhook_not_configured" });

  const url = new URL(req.url);
  const signedDataId = (url.searchParams.get("data.id") ?? url.searchParams.get("data_id") ?? "").trim();
  if (!(await validSignature(req, signedDataId, webhookSecret))) {
    return response(401, { ok: false, error: "invalid_signature" });
  }

  let payload: JsonRecord;
  try {
    payload = objectValue(await req.json());
  } catch {
    return response(400, { ok: false, error: "invalid_json" });
  }
  if (payload.live_mode === true) return response(403, { ok: false, error: "live_event_rejected_in_test" });

  const eventType = typeof payload.type === "string" ? payload.type.slice(0, 120) : "unknown";
  const action = typeof payload.action === "string" ? payload.action.slice(0, 160) : "unknown";
  const notificationId = typeof payload.id === "string" || typeof payload.id === "number" ? String(payload.id) : "";
  const requestId = req.headers.get("x-request-id")?.trim() ?? "";
  const resourceId = signedDataId || payloadDataId(payload);
  const providerEventKey = notificationId
    ? `notification:${notificationId}`
    : `request:${requestId}:${eventType}:${action}:${resourceId}`;

  const admin = adminClient();
  const { data: claim, error } = await admin.rpc("claim_mercado_pago_webhook_event", {
    p_provider_event_key: providerEventKey,
    p_event_type: `${eventType}:${action}`.slice(0, 200),
    p_resource_id: resourceId || null,
    p_payload: sanitizedNotification(payload),
  });

  if (error) {
    console.error("[comandiva-mercadopago-webhook] claim failed", error.code ?? "unknown");
    return response(500, { ok: false, error: "event_claim_failed" });
  }
  if (claim === "duplicate") return response(200, { ok: true, duplicate: true });
  if (claim === "busy") return response(503, { ok: false, error: "event_in_progress" });
  if (claim !== "process") return response(500, { ok: false, error: "event_claim_failed" });

  if (IGNORED_EVENT_TYPES.has(eventType) || !PROCESSABLE_EVENT_TYPES.has(eventType)) {
    const finalized = await finalizeEvent(admin, providerEventKey, "ignored", null, null);
    return finalized ? response(200, { ok: true, ignored: true }) : response(500, { ok: false, error: "event_finalize_failed" });
  }

  if (!resourceId) {
    await finalizeEvent(admin, providerEventKey, "failed", null, "provider_resource_id_missing");
    return response(400, { ok: false, error: "provider_resource_id_missing" });
  }
  if (!accessToken) {
    await finalizeEvent(admin, providerEventKey, "failed", null, "provider_token_missing");
    return response(503, { ok: false, error: "provider_lookup_not_configured" });
  }

  const resourceUrl = providerResourceUrl(eventType, resourceId);
  if (!resourceUrl) {
    await finalizeEvent(admin, providerEventKey, "ignored", null, null);
    return response(200, { ok: true, ignored: true });
  }

  try {
    const upstream = await fetchProviderJson(accessToken, resourceUrl);
    if (!upstream.ok) {
      await finalizeEvent(
        admin,
        providerEventKey,
        "failed",
        { upstream_status: upstream.status },
        `provider_lookup_${upstream.status}`,
      );
      return response(502, { ok: false, error: "provider_lookup_failed" });
    }

    const snapshot = sanitizedSnapshot(eventType, upstream.body);

    if (eventType === "subscription_preapproval") {
      const reconciliation = await reconcileAddonPreapproval(admin, upstream.body);
      if (!reconciliation.ok) {
        await finalizeEvent(admin, providerEventKey, "failed", snapshot, reconciliation.error ?? "addon_reconcile_failed");
        return response(409, { ok: false, error: "addon_reconciliation_rejected" });
      }
    }

    if (eventType === "subscription_authorized_payment") {
      const preapprovalId = stringValue(upstream.body.preapproval_id);
      if (preapprovalId) {
        const preapproval = await fetchProviderJson(accessToken, `${MP_API}/preapproval/${encodeURIComponent(preapprovalId)}`);
        if (!preapproval.ok) {
          await finalizeEvent(
            admin,
            providerEventKey,
            "failed",
            snapshot,
            `provider_preapproval_lookup_${preapproval.status}`,
          );
          return response(502, { ok: false, error: "provider_preapproval_lookup_failed" });
        }
        const reconciliation = await reconcileAddonPreapproval(admin, preapproval.body);
        if (!reconciliation.ok) {
          await finalizeEvent(admin, providerEventKey, "failed", snapshot, reconciliation.error ?? "addon_reconcile_failed");
          return response(409, { ok: false, error: "addon_reconciliation_rejected" });
        }
      }
    }

    const finalized = await finalizeEvent(admin, providerEventKey, "processed", snapshot, null);
    if (!finalized) return response(500, { ok: false, error: "event_finalize_failed" });
    return response(200, { ok: true, verified: true });
  } catch (lookupError) {
    console.error(
      "[comandiva-mercadopago-webhook] provider lookup failed",
      lookupError instanceof Error ? lookupError.message : "unknown",
    );
    await finalizeEvent(admin, providerEventKey, "failed", null, "provider_unreachable");
    return response(502, { ok: false, error: "provider_unreachable" });
  }
});
