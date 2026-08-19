import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const MP_API = "https://api.mercadopago.com";
const PROVIDER = "mercado_pago";
const ENVIRONMENT = "test";
const PROVIDER_TIMEOUT_MS = 8_000;

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

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function rateLimit(): Promise<boolean> {
  const admin = adminClient();
  const { data, error } = await admin.rpc("consume_edge_rate_limit", {
    _key: "billing:mercadopago:runtime-readiness:minute",
    _limit: 20,
    _window_seconds: 60,
  } as never);
  return !error && data === true;
}

async function providerLookup(token: string): Promise<{ ok: boolean; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${MP_API}/preapproval/search?limit=1&offset=0`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    return { ok: upstream.ok, status: upstream.status };
  } finally {
    clearTimeout(timer);
  }
}

async function persistHealth(input: {
  tokenConfigured: boolean;
  tokenConnected: boolean;
  upstreamStatus: number | null;
  webhookSecretConfigured: boolean;
  webhookSecretFingerprint: string | null;
  lastError: string | null;
}): Promise<JsonRecord | null> {
  const admin = adminClient();
  const { data, error } = await admin.rpc("billing_record_provider_runtime_health", {
    _provider: PROVIDER,
    _environment: ENVIRONMENT,
    _token_configured: input.tokenConfigured,
    _token_connected: input.tokenConnected,
    _token_upstream_status: input.upstreamStatus,
    _webhook_secret_configured: input.webhookSecretConfigured,
    _webhook_secret_fingerprint: input.webhookSecretFingerprint,
    _last_error: input.lastError,
  } as never);
  if (error) {
    console.error("[comandiva-billing-readiness] persist failed", error.code ?? "unknown");
    return null;
  }
  return data && typeof data === "object" ? data as JsonRecord : null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return response({ ok: false, error: "method_not_allowed" }, 405);
  }
  if (!(await rateLimit())) return response({ ok: false, error: "rate_limited" }, 429);

  const token = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_TEST")?.trim() ?? "";
  const webhookSecret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET_TEST")?.trim() ?? "";
  const webhookSecretFingerprint = webhookSecret ? await sha256Hex(webhookSecret) : null;

  if (!token) {
    const stored = await persistHealth({
      tokenConfigured: false,
      tokenConnected: false,
      upstreamStatus: null,
      webhookSecretConfigured: Boolean(webhookSecret),
      webhookSecretFingerprint,
      lastError: "provider_token_missing",
    });
    return response({
      ok: false,
      provider: PROVIDER,
      environment: ENVIRONMENT,
      tokenConfigured: false,
      tokenConnected: false,
      webhookSecretConfigured: Boolean(webhookSecret),
      webhookDeliveryVerified: stored?.webhook_delivery_verified === true,
      readyForCheckout: false,
    }, 503);
  }

  try {
    const upstream = await providerLookup(token);
    const stored = await persistHealth({
      tokenConfigured: true,
      tokenConnected: upstream.ok,
      upstreamStatus: upstream.status,
      webhookSecretConfigured: Boolean(webhookSecret),
      webhookSecretFingerprint,
      lastError: upstream.ok ? null : `provider_lookup_${upstream.status}`,
    });

    return response({
      ok: upstream.ok,
      provider: PROVIDER,
      environment: ENVIRONMENT,
      tokenConfigured: true,
      tokenConnected: upstream.ok,
      upstreamStatus: upstream.status,
      webhookSecretConfigured: Boolean(webhookSecret),
      webhookDeliveryVerified: stored?.webhook_delivery_verified === true,
      readyForCheckout: stored?.ready_for_checkout === true,
    }, upstream.ok ? 200 : 502);
  } catch (error) {
    console.error(
      "[comandiva-billing-readiness] provider lookup failed",
      error instanceof Error ? error.message : "unknown",
    );
    const stored = await persistHealth({
      tokenConfigured: true,
      tokenConnected: false,
      upstreamStatus: null,
      webhookSecretConfigured: Boolean(webhookSecret),
      webhookSecretFingerprint,
      lastError: "provider_unreachable",
    });
    return response({
      ok: false,
      provider: PROVIDER,
      environment: ENVIRONMENT,
      tokenConfigured: true,
      tokenConnected: false,
      webhookSecretConfigured: Boolean(webhookSecret),
      webhookDeliveryVerified: stored?.webhook_delivery_verified === true,
      readyForCheckout: false,
      error: "provider_unreachable",
    }, 502);
  }
});
