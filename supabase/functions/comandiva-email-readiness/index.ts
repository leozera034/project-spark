import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const RESEND_API = "https://api.resend.com";
const PROVIDER = "resend";
const ENVIRONMENT = "production";
const PROVIDER_TIMEOUT_MS = 8_000;

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
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function rateLimit(): Promise<boolean> {
  const admin = adminClient();
  const { data, error } = await admin.rpc("consume_edge_rate_limit", {
    _key: "email:resend:runtime-readiness:minute",
    _limit: 20,
    _window_seconds: 60,
  } as never);
  return !error && data === true;
}

async function persist(input: {
  apiKeyConfigured: boolean;
  sendingDomain: string | null;
  domainVerified: boolean;
  webhookSecretConfigured: boolean;
  webhookSecretFingerprint: string | null;
  lastError: string | null;
}) {
  const admin = adminClient();
  const { data, error } = await admin.rpc("backend_record_email_provider_runtime_health", {
    _provider: PROVIDER,
    _environment: ENVIRONMENT,
    _api_key_configured: input.apiKeyConfigured,
    _sending_domain: input.sendingDomain,
    _domain_verified: input.domainVerified,
    _webhook_secret_configured: input.webhookSecretConfigured,
    _webhook_secret_fingerprint: input.webhookSecretFingerprint,
    _last_error: input.lastError,
  } as never);
  if (error) {
    console.error("[comandiva-email-readiness] persist failed", error.code ?? "unknown");
    return null;
  }
  return objectValue(data);
}

async function listDomains(apiKey: string): Promise<{ ok: boolean; status: number; body: JsonRecord }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const res = await fetch(`${RESEND_API}/domains?limit=100`, {
      method: "GET",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return { ok: res.ok, status: res.status, body: objectValue(await res.json().catch(() => ({}))) };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "POST") return response({ ok: false, error: "method_not_allowed" }, 405);
  if (!(await rateLimit())) return response({ ok: false, error: "rate_limited" }, 429);

  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  const sendingDomain = Deno.env.get("COMANDIVA_EMAIL_DOMAIN")?.trim().toLowerCase() ?? "";
  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET")?.trim() ?? "";
  const webhookFingerprint = webhookSecret ? await sha256Hex(webhookSecret) : null;

  if (!apiKey || !sendingDomain) {
    const stored = await persist({
      apiKeyConfigured: Boolean(apiKey),
      sendingDomain: sendingDomain || null,
      domainVerified: false,
      webhookSecretConfigured: Boolean(webhookSecret),
      webhookSecretFingerprint: webhookFingerprint,
      lastError: !apiKey ? "resend_api_key_missing" : "comandiva_email_domain_missing",
    });
    return response({
      ok: false,
      provider: PROVIDER,
      apiKeyConfigured: Boolean(apiKey),
      sendingDomain: sendingDomain || null,
      domainVerified: false,
      webhookSecretConfigured: Boolean(webhookSecret),
      webhookDeliveryVerified: stored?.webhook_delivery_verified === true,
      readyForSend: false,
      error: !apiKey ? "resend_api_key_missing" : "comandiva_email_domain_missing",
    }, 503);
  }

  try {
    const upstream = await listDomains(apiKey);
    if (!upstream.ok) {
      const stored = await persist({
        apiKeyConfigured: true,
        sendingDomain,
        domainVerified: false,
        webhookSecretConfigured: Boolean(webhookSecret),
        webhookSecretFingerprint: webhookFingerprint,
        lastError: `resend_domains_${upstream.status}`,
      });
      return response({
        ok: false,
        provider: PROVIDER,
        apiKeyConfigured: true,
        sendingDomain,
        domainVerified: false,
        webhookSecretConfigured: Boolean(webhookSecret),
        webhookDeliveryVerified: stored?.webhook_delivery_verified === true,
        readyForSend: false,
        upstreamStatus: upstream.status,
      }, 502);
    }

    const domains = Array.isArray(upstream.body.data) ? upstream.body.data : [];
    const domain = domains.map(objectValue).find((item) => stringValue(item.name)?.toLowerCase() === sendingDomain) ?? null;
    const capabilities = objectValue(domain?.capabilities);
    const domainVerified = stringValue(domain?.status)?.toLowerCase() === "verified"
      && stringValue(capabilities.sending)?.toLowerCase() === "enabled";
    const lastError = !domain ? "comandiva_domain_not_found_in_resend" : domainVerified ? null : "comandiva_domain_not_verified";

    const stored = await persist({
      apiKeyConfigured: true,
      sendingDomain,
      domainVerified,
      webhookSecretConfigured: Boolean(webhookSecret),
      webhookSecretFingerprint: webhookFingerprint,
      lastError,
    });

    return response({
      ok: domainVerified,
      provider: PROVIDER,
      apiKeyConfigured: true,
      sendingDomain,
      domainVerified,
      webhookSecretConfigured: Boolean(webhookSecret),
      webhookDeliveryVerified: stored?.webhook_delivery_verified === true,
      readyForSend: stored?.ready_for_send === true,
      upstreamStatus: upstream.status,
      error: lastError,
    }, domainVerified ? 200 : 409);
  } catch (error) {
    console.error("[comandiva-email-readiness] Resend health failed", error instanceof Error ? error.message : "unknown");
    const stored = await persist({
      apiKeyConfigured: true,
      sendingDomain,
      domainVerified: false,
      webhookSecretConfigured: Boolean(webhookSecret),
      webhookSecretFingerprint: webhookFingerprint,
      lastError: "resend_unreachable",
    });
    return response({
      ok: false,
      provider: PROVIDER,
      apiKeyConfigured: true,
      sendingDomain,
      domainVerified: false,
      webhookSecretConfigured: Boolean(webhookSecret),
      webhookDeliveryVerified: stored?.webhook_delivery_verified === true,
      readyForSend: false,
      error: "resend_unreachable",
    }, 502);
  }
});
