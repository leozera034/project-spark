import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const MP_API = "https://api.mercadopago.com";
const MAX_BODY_BYTES = 64 * 1024;
const SIGNATURE_TOLERANCE_SECONDS = 600;
const PROCESSABLE_EVENT_TYPES = new Set([
  "subscription_preapproval",
  "subscription_authorized_payment",
  "payment",
]);
const IGNORED_EVENT_TYPES = new Set(["subscription_preapproval_plan"]);

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

function payloadDataId(payload: Record<string, unknown>): string {
  const data = payload.data;
  if (!data || typeof data !== "object") return "";
  const value = (data as Record<string, unknown>).id;
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

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function sanitizedSnapshot(eventType: string, raw: Record<string, unknown>) {
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

async function finalizeEvent(
  admin: ReturnType<typeof adminClient>,
  providerEventKey: string,
  processingStatus: "processed" | "ignored" | "failed",
  providerSnapshot: Record<string, unknown> | null,
  lastError: string | null,
) {
  const { data, error } = await admin.rpc("finalize_mercado_pago_webhook_event", {
    p_provider_event_key: providerEventKey,
    p_processing_status: processingStatus,
    p_provider_snapshot: providerSnapshot,
    p_last_error: lastError,
  });
  if (error || data !== true) {
    console.error(
      "[comandiva-mercadopago-webhook] finalize failed",
      error?.code ?? "event_not_found",
    );
    return false;
  }
  return true;
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

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return response(400, { ok: false, error: "invalid_json" });
  }

  if (payload.live_mode === true) {
    return response(403, { ok: false, error: "live_event_rejected_in_test" });
  }

  const eventType = typeof payload.type === "string" ? payload.type.slice(0, 120) : "unknown";
  const action = typeof payload.action === "string" ? payload.action.slice(0, 160) : "unknown";
  const notificationId = typeof payload.id === "string" || typeof payload.id === "number"
    ? String(payload.id)
    : "";
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
    p_payload: payload,
  });

  if (error) {
    console.error("[comandiva-mercadopago-webhook] claim failed", error.code ?? "unknown");
    return response(500, { ok: false, error: "event_claim_failed" });
  }

  if (claim === "duplicate") {
    return response(200, { ok: true, duplicate: true });
  }
  if (claim !== "process") {
    return response(500, { ok: false, error: "event_claim_failed" });
  }

  if (IGNORED_EVENT_TYPES.has(eventType) || !PROCESSABLE_EVENT_TYPES.has(eventType)) {
    const finalized = await finalizeEvent(admin, providerEventKey, "ignored", null, null);
    return finalized
      ? response(200, { ok: true, ignored: true })
      : response(500, { ok: false, error: "event_finalize_failed" });
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
    const upstream = await fetch(resourceUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const raw = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
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

    const snapshot = sanitizedSnapshot(eventType, raw);
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
