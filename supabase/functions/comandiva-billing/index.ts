import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const MP_API = "https://api.mercadopago.com";
const APP_ORIGIN = "https://shark-cardapio.lovable.app";
const TEST_AMOUNT_BRL = 1;
const TEST_PAYER_EMAIL = "test@testuser.com";

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
      "access-control-allow-headers": "content-type, authorization, apikey",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      vary: "Origin",
    },
  });
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

function clientAddress(req: Request): string | null {
  const candidate = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip");
  if (!candidate) return null;
  const value = candidate.trim();
  return value.length <= 64 && /^[0-9a-f:.]+$/i.test(value) ? value : null;
}

async function shortHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function mercadoPagoToken(): string | null {
  return Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_TEST")?.trim() || null;
}

function providerCauses(payload: unknown): Array<{ code?: string | number; description?: string }> {
  if (!payload || typeof payload !== "object" || !("cause" in payload)) return [];
  const cause = (payload as { cause?: unknown }).cause;
  if (!Array.isArray(cause)) return [];
  return cause.slice(0, 5).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const value = entry as { code?: unknown; description?: unknown };
    return [{
      code: typeof value.code === "string" || typeof value.code === "number" ? value.code : undefined,
      description: typeof value.description === "string" ? value.description.slice(0, 300) : undefined,
    }];
  });
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
      environment: "test",
      configured: false,
    }, 503);
  }

  try {
    const upstream = await fetch(`${MP_API}/preapproval/search?limit=1&offset=0`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    return json(req, {
      ok: upstream.ok,
      provider: "mercado_pago",
      environment: "test",
      configured: true,
      connected: upstream.ok,
      upstreamStatus: upstream.status,
    }, upstream.ok ? 200 : 502);
  } catch (error) {
    console.error(
      "[comandiva-billing] provider health failed",
      error instanceof Error ? error.message : "unknown",
    );
    return json(req, {
      ok: false,
      provider: "mercado_pago",
      environment: "test",
      configured: true,
      connected: false,
      error: "provider_unreachable",
    }, 502);
  }
}

async function createPendingTestSubscription(req: Request): Promise<Response> {
  const token = mercadoPagoToken();
  if (!token) return json(req, { ok: false, error: "provider_not_configured" }, 503);

  if (!(await rateLimit("billing:mercadopago:pending-test:global:minute", 20, 60))) {
    return json(req, { ok: false, error: "rate_limited" }, 429);
  }

  const ip = clientAddress(req);
  if (ip) {
    const ipKey = await shortHash(ip);
    if (!(await rateLimit(`billing:mercadopago:pending-test:ip:${ipKey}:hour`, 10, 3600))) {
      return json(req, { ok: false, error: "rate_limited" }, 429);
    }
  }

  const externalReference = `comandiva-pending-${crypto.randomUUID()}`;
  const requestBody = {
    reason: "Comandiva Sandbox Subscription",
    external_reference: externalReference,
    payer_email: TEST_PAYER_EMAIL,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: TEST_AMOUNT_BRL,
      currency_id: "BRL",
    },
    back_url: `${APP_ORIGIN}/integracao/mercado-pago?retorno=1`,
    status: "pending",
  };

  try {
    const upstream = await fetch(`${MP_API}/preapproval`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const payload = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
    if (!upstream.ok) {
      console.warn("[comandiva-billing] pending test subscription rejected", {
        status: upstream.status,
        message: typeof payload.message === "string" ? payload.message : "provider_rejected",
      });
      return json(req, {
        ok: false,
        error: "provider_rejected",
        upstreamStatus: upstream.status,
        providerMessage: typeof payload.message === "string" ? payload.message.slice(0, 300) : null,
        providerCauses: providerCauses(payload),
      }, 422);
    }

    const initPoint = typeof payload.init_point === "string" ? payload.init_point : "";
    if (!initPoint.startsWith("https://")) {
      return json(req, { ok: false, error: "provider_missing_checkout_url" }, 502);
    }

    return json(req, {
      ok: true,
      environment: "test",
      subscriptionId: typeof payload.id === "string" ? payload.id : null,
      status: typeof payload.status === "string" ? payload.status : null,
      initPoint,
      payerEmail: TEST_PAYER_EMAIL,
    });
  } catch (error) {
    console.error(
      "[comandiva-billing] pending test subscription request failed",
      error instanceof Error ? error.message : "unknown",
    );
    return json(req, { ok: false, error: "provider_unreachable" }, 502);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(req, { ok: true });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (req.method === "GET" && action === "provider_health") return providerHealth(req);
  if (req.method === "POST" && action === "create_pending_test_subscription") {
    return createPendingTestSubscription(req);
  }

  // Retired test-card endpoints. Keep explicit tombstones instead of silently accepting them.
  if (action === "public_config" || action === "create_test_subscription") {
    return json(req, { ok: false, error: "endpoint_retired_use_hosted_checkout" }, 410);
  }

  return json(req, { ok: false, error: "action_not_allowed" }, 403);
});
