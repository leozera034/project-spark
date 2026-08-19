import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const MAX_BODY_BYTES = 256 * 1024;
const MESSAGE_STATUSES = new Set(["sent", "delivered", "read", "failed"]);
const TEMPLATE_EVENTS = new Set([
  "APPROVED",
  "REJECTED",
  "PENDING",
  "PAUSED",
  "DISABLED",
  "IN_APPEAL",
  "REINSTATED",
]);

type JsonRecord = Record<string, unknown>;

function parseKeys(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as Record<string, string> : {};
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

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function scalarString(value: unknown, max = 512): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function unixTimestamp(value: unknown): string {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return new Date().toISOString();
  return new Date(seconds * 1000).toISOString();
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

async function validMetaSignature(rawBody: string, signatureHeader: string, appSecret: string): Promise<boolean> {
  const match = /^sha256=([0-9a-f]{64})$/i.exec(signatureHeader.trim());
  if (!match) return false;
  const computed = await hmacSha256Hex(appSecret, rawBody);
  return constantTimeHexEquals(computed.toLowerCase(), match[1].toLowerCase());
}

function statusError(status: JsonRecord): { code: string | null; message: string | null } {
  const errors = Array.isArray(status.errors) ? status.errors : [];
  const first = objectValue(errors[0]);
  const code = scalarString(first.code, 120);
  const title = scalarString(first.title, 250);
  const message = scalarString(first.message, 500);
  return {
    code: code ? `META_${code}`.slice(0, 120) : null,
    message: (message ?? title)?.slice(0, 500) ?? null,
  };
}

function safeStatusMetadata(status: JsonRecord): JsonRecord {
  const conversation = objectValue(status.conversation);
  const pricing = objectValue(status.pricing);
  const metadata: JsonRecord = {};
  const conversationId = scalarString(conversation.id, 256);
  const pricingCategory = scalarString(pricing.category, 80);
  const pricingType = scalarString(pricing.pricing_model, 80);
  if (conversationId) metadata.conversation_id = conversationId;
  if (pricingCategory) metadata.pricing_category = pricingCategory;
  if (pricingType) metadata.pricing_model = pricingType;
  return metadata;
}

async function claimEvent(
  admin: ReturnType<typeof adminClient>,
  eventKey: string,
  eventType: string,
  externalId: string | null,
  summary: JsonRecord,
): Promise<"process" | "duplicate" | "busy" | "error"> {
  const result = await admin.rpc("claim_meta_whatsapp_webhook_event", {
    _event_key: eventKey,
    _event_type: eventType,
    _external_id: externalId,
    _payload_summary: summary,
  });
  if (result.error) return "error";
  return result.data === "process" || result.data === "duplicate" || result.data === "busy"
    ? result.data
    : "error";
}

async function finalizeEvent(
  admin: ReturnType<typeof adminClient>,
  eventKey: string,
  status: "processed" | "ignored" | "failed",
  error: string | null = null,
): Promise<boolean> {
  const result = await admin.rpc("finalize_meta_whatsapp_webhook_event", {
    _event_key: eventKey,
    _status: status,
    _last_error: error,
  });
  return !result.error && result.data === true;
}

async function processMessageStatuses(
  admin: ReturnType<typeof adminClient>,
  statuses: unknown[],
): Promise<boolean> {
  let ok = true;

  for (const rawStatus of statuses) {
    const status = objectValue(rawStatus);
    const providerMessageId = scalarString(status.id, 512);
    const state = scalarString(status.status, 40)?.toLowerCase() ?? "";
    const timestampRaw = scalarString(status.timestamp, 32) ?? "0";
    if (!providerMessageId || !MESSAGE_STATUSES.has(state)) continue;

    const eventKey = `status:${providerMessageId}:${state}:${timestampRaw}`.slice(0, 512);
    const summary = { status: state, timestamp: timestampRaw };
    const claim = await claimEvent(admin, eventKey, "message_status", providerMessageId, summary);
    if (claim === "duplicate" || claim === "busy") continue;
    if (claim !== "process") {
      ok = false;
      continue;
    }

    const error = state === "failed" ? statusError(status) : { code: null, message: null };
    const applied = await admin.rpc("apply_meta_whatsapp_message_status", {
      _provider_message_id: providerMessageId,
      _status: state,
      _event_at: unixTimestamp(status.timestamp),
      _error_code: error.code,
      _error_message: error.message,
      _metadata: safeStatusMetadata(status),
    });

    if (applied.error || applied.data !== true) {
      await finalizeEvent(admin, eventKey, "failed", applied.error?.code ?? "status_apply_failed");
      ok = false;
      continue;
    }

    if (!(await finalizeEvent(admin, eventKey, "processed"))) ok = false;
  }

  return ok;
}

async function processTemplateStatus(
  admin: ReturnType<typeof adminClient>,
  wabaId: string,
  entryTime: unknown,
  value: JsonRecord,
): Promise<boolean> {
  const event = scalarString(value.event, 80)?.toUpperCase() ?? "";
  if (!TEMPLATE_EVENTS.has(event)) return true;

  const templateId = scalarString(value.message_template_id, 256);
  const templateName = scalarString(value.message_template_name, 512);
  const language = scalarString(value.message_template_language, 40);
  const reason = scalarString(value.reason, 500);
  if (!templateName || !language) return true;

  const eventKey = `template:${wabaId}:${templateId ?? templateName}:${event}:${scalarString(entryTime, 32) ?? "0"}`.slice(0, 512);
  const claim = await claimEvent(admin, eventKey, "template_status", templateId ?? templateName, {
    waba_id: wabaId,
    template_id: templateId,
    template_name: templateName,
    language,
    event,
  });
  if (claim === "duplicate" || claim === "busy") return true;
  if (claim !== "process") return false;

  const applied = await admin.rpc("apply_meta_whatsapp_template_status", {
    _waba_id: wabaId,
    _provider_template_id: templateId,
    _template_name: templateName,
    _language: language,
    _event: event,
    _reason: reason,
  });
  if (applied.error) {
    await finalizeEvent(admin, eventKey, "failed", applied.error.code ?? "template_status_apply_failed");
    return false;
  }

  const updated = Number(applied.data ?? 0);
  return finalizeEvent(admin, eventKey, updated > 0 ? "processed" : "ignored");
}

Deno.serve(async (req: Request) => {
  const verifyToken = Deno.env.get("META_WHATSAPP_VERIFY_TOKEN")?.trim() ?? "";
  const appSecret = Deno.env.get("META_WHATSAPP_APP_SECRET")?.trim() ?? "";

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode") ?? "";
    const suppliedToken = url.searchParams.get("hub.verify_token") ?? "";
    const challenge = url.searchParams.get("hub.challenge") ?? "";

    if (!mode && !suppliedToken && !challenge) {
      return json(verifyToken && appSecret ? 200 : 503, {
        ok: Boolean(verifyToken && appSecret),
        service: "comandiva-meta-whatsapp-webhook",
        verificationConfigured: Boolean(verifyToken),
        signatureConfigured: Boolean(appSecret),
      });
    }

    if (!verifyToken) return json(503, { ok: false, error: "verification_not_configured" });
    if (mode !== "subscribe" || !suppliedToken || suppliedToken !== verifyToken) {
      return json(403, { ok: false, error: "verification_failed" });
    }
    return new Response(challenge, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  if (!appSecret) return json(503, { ok: false, error: "signature_not_configured" });

  const length = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json(413, { ok: false, error: "payload_too_large" });

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: "payload_too_large" });
  }

  const signature = req.headers.get("x-hub-signature-256") ?? "";
  if (!(await validMetaSignature(rawBody, signature, appSecret))) {
    return json(401, { ok: false, error: "invalid_signature" });
  }

  let payload: JsonRecord;
  try {
    payload = objectValue(JSON.parse(rawBody));
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  if (payload.object !== "whatsapp_business_account") return json(200, { ok: true, ignored: true });

  const admin = adminClient();
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  let allProcessed = true;

  for (const rawEntry of entries) {
    const entry = objectValue(rawEntry);
    const wabaId = scalarString(entry.id, 256) ?? "";
    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    for (const rawChange of changes) {
      const change = objectValue(rawChange);
      const field = scalarString(change.field, 120) ?? "";
      const value = objectValue(change.value);

      if (field === "messages") {
        const statuses = Array.isArray(value.statuses) ? value.statuses : [];
        if (!(await processMessageStatuses(admin, statuses))) allProcessed = false;
        // Incoming customer messages are intentionally ignored in this stage.
        continue;
      }

      if (field === "message_template_status_update" && wabaId) {
        if (!(await processTemplateStatus(admin, wabaId, entry.time, value))) allProcessed = false;
      }
    }
  }

  return allProcessed
    ? json(200, { ok: true })
    : json(500, { ok: false, error: "webhook_processing_failed" });
});
