import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { Resend } from "npm:resend";

const MAX_BODY_BYTES = 128 * 1024;
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
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
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

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstString(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const first = value.find((item) => typeof item === "string" && item.trim());
  return typeof first === "string" ? first.trim() : null;
}

function sanitizedPayload(event: JsonRecord): JsonRecord {
  const data = objectValue(event.data);
  return {
    type: stringValue(event.type),
    created_at: stringValue(event.created_at),
    data: {
      email_id: stringValue(data.email_id),
      domain_id: stringValue(data.id),
      name: stringValue(data.name),
      status: stringValue(data.status),
      to: Array.isArray(data.to) ? data.to.filter((item) => typeof item === "string").slice(0, 10) : [],
      subject: stringValue(data.subject),
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response({ ok: false, error: "method_not_allowed" }, 405);

  const length = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return response({ ok: false, error: "payload_too_large" }, 413);

  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET")?.trim() ?? "";
  if (!webhookSecret) return response({ ok: false, error: "webhook_not_configured" }, 503);

  const id = req.headers.get("svix-id")?.trim() ?? "";
  const timestamp = req.headers.get("svix-timestamp")?.trim() ?? "";
  const signature = req.headers.get("svix-signature")?.trim() ?? "";
  if (!id || !timestamp || !signature) return response({ ok: false, error: "missing_signature_headers" }, 400);

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return response({ ok: false, error: "payload_too_large" }, 413);
  }

  let verified: JsonRecord;
  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY")?.trim() || "re_webhook_verification_only");
    verified = objectValue(await resend.webhooks.verify({
      payload: rawBody,
      headers: { id, timestamp, signature },
      webhookSecret,
    }));
  } catch (error) {
    console.warn("[comandiva-resend-webhook] invalid signature", error instanceof Error ? error.message : "unknown");
    return response({ ok: false, error: "invalid_signature" }, 401);
  }

  const eventType = stringValue(verified.type) ?? "unknown";
  const data = objectValue(verified.data);
  const providerEmailId = stringValue(data.email_id);
  const recipientEmail = firstString(data.to);
  const domainName = eventType === "domain.updated" ? stringValue(data.name) : null;
  const domainStatus = eventType === "domain.updated" ? stringValue(data.status) : null;
  const bounce = objectValue(data.bounce);
  const reason = stringValue(data.error)
    ?? stringValue(data.reason)
    ?? stringValue(bounce.message)
    ?? stringValue(bounce.type);
  const occurredAt = stringValue(verified.created_at);

  const admin = adminClient();
  const { data: processed, error } = await admin.rpc("backend_process_resend_webhook_event", {
    _provider_event_id: id,
    _event_type: eventType,
    _provider_email_id: providerEmailId,
    _recipient_email: recipientEmail,
    _occurred_at: occurredAt,
    _reason: reason,
    _domain_name: domainName,
    _domain_status: domainStatus,
    _payload: sanitizedPayload(verified),
  } as never);

  if (error) {
    console.error("[comandiva-resend-webhook] processing failed", error.code ?? "unknown");
    return response({ ok: false, error: "webhook_processing_failed" }, 500);
  }

  return response({ ok: true, ...(objectValue(processed)) });
});
