import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const MAX_BODY_BYTES = 64 * 1024;
const SIGNATURE_TOLERANCE_SECONDS = 600;

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
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (apiKey.startsWith("sb_") && headers.get("Authorization") === `Bearer ${apiKey}`) headers.delete("Authorization");
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
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
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
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeHexEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function validSignature(req: Request, dataId: string, secret: string): Promise<boolean> {
  const xSignature = req.headers.get("x-signature")?.trim() ?? "";
  const xRequestId = req.headers.get("x-request-id")?.trim() ?? "";
  if (!xSignature || !xRequestId || !dataId) return false;

  const { ts, v1 } = parseSignature(xSignature);
  if (!ts || !v1 || !/^\d+$/.test(ts)) return false;
  const drift = Math.abs(Date.now() - Number(ts) * 1000) / 1000;
  if (!Number.isFinite(drift) || drift > SIGNATURE_TOLERANCE_SECONDS) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const computed = await hmacSha256Hex(secret, manifest);
  return constantTimeHexEquals(computed, v1);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response(405, { ok: false, error: "method_not_allowed" });

  const length = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return response(413, { ok: false, error: "payload_too_large" });
  }

  const secret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET_TEST");
  if (!secret) return response(503, { ok: false, error: "webhook_not_configured" });

  const url = new URL(req.url);
  const dataId = (url.searchParams.get("data.id") ?? url.searchParams.get("data_id") ?? "").trim();
  if (!(await validSignature(req, dataId, secret))) {
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
  const notificationId = typeof payload.id === "string" || typeof payload.id === "number" ? String(payload.id) : "";
  const requestId = req.headers.get("x-request-id")?.trim() ?? "";
  const providerEventKey = notificationId ? `notification:${notificationId}` : `request:${requestId}:${eventType}:${action}:${dataId}`;

  const admin = adminClient();
  const { error } = await admin.from("billing_webhook_events").insert({
    provider: "mercado_pago",
    provider_event_key: providerEventKey,
    event_type: `${eventType}:${action}`.slice(0, 200),
    resource_id: dataId || null,
    signature_valid: true,
    processing_status: "received",
    payload,
  } as never);

  if (error) {
    if (error.code === "23505") return response(200, { ok: true, duplicate: true });
    console.error("[comandiva-mercadopago-webhook] insert failed", error.code ?? "unknown");
    return response(500, { ok: false, error: "event_persist_failed" });
  }

  return response(200, { ok: true });
});
