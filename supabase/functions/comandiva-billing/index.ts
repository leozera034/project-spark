import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const MP_API = "https://api.mercadopago.com";
const APP_ORIGIN = "https://shark-cardapio.lovable.app";
const MP_TEST_PLAN_ID = "dab2d8e59a1b4400945919a7ed516b8c";
const TEST_AMOUNT_BRL = 1;

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
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function mercadoPagoToken(): string | null {
  const token = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_TEST")?.trim();
  return token || null;
}

function mercadoPagoPublicKey(): string | null {
  const key =
    Deno.env.get("MERCADO_PAGO_PUBLIC_KEY_TEST")?.trim() ??
    Deno.env.get("VITE_MERCADO_PAGO_PUBLIC_KEY_TEST")?.trim();
  return key || null;
}

async function publicConfig(req: Request): Promise<Response> {
  if (!(await rateLimit("billing:mercadopago:public-config:minute", 120, 60))) {
    return json(req, { ok: false, error: "rate_limited" }, 429);
  }

  const publicKey = mercadoPagoPublicKey();
  if (!publicKey) {
    return json(
      req,
      {
        ok: false,
        environment: "test",
        provider: "mercado_pago",
        configured: false,
        error: "public_key_not_configured",
      },
      503,
    );
  }

  return json(req, {
    ok: true,
    environment: "test",
    provider: "mercado_pago",
    configured: true,
    publicKey,
    amount: TEST_AMOUNT_BRL,
    currency: "BRL",
  });
}

async function providerHealth(req: Request): Promise<Response> {
  if (!(await rateLimit("billing:mercadopago:health:minute", 10, 60))) {
    return json(req, { ok: false, error: "rate_limited" }, 429);
  }

  const token = mercadoPagoToken();
  if (!token) {
    return json(
      req,
      { ok: false, provider: "mercado_pago", environment: "test", configured: false },
      503,
    );
  }

  try {
    const upstream = await fetch(`${MP_API}/preapproval_plan/search?limit=1&offset=0`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    return json(
      req,
      {
        ok: upstream.ok,
        provider: "mercado_pago",
        environment: "test",
        configured: true,
        connected: upstream.ok,
        upstreamStatus: upstream.status,
      },
      upstream.ok ? 200 : 502,
    );
  } catch (error) {
    console.error(
      "[comandiva-billing] provider health failed",
      error instanceof Error ? error.message : "unknown",
    );
    return json(
      req,
      {
        ok: false,
        provider: "mercado_pago",
        environment: "test",
        configured: true,
        connected: false,
        error: "provider_unreachable",
      },
      502,
    );
  }
}

function providerCauses(payload: unknown): Array<{ code?: string | number; description?: string }> {
  if (!payload || typeof payload !== "object" || !("cause" in payload)) return [];
  const cause = (payload as { cause?: unknown }).cause;
  if (!Array.isArray(cause)) return [];
  return cause.slice(0, 5).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const value = entry as { code?: unknown; description?: unknown };
    return [
      {
        code:
          typeof value.code === "string" || typeof value.code === "number"
            ? value.code
            : undefined,
        description: typeof value.description === "string" ? value.description.slice(0, 300) : undefined,
      },
    ];
  });
}

async function createTestSubscription(req: Request): Promise<Response> {
  const token = mercadoPagoToken();
  if (!token) return json(req, { ok: false, error: "provider_not_configured" }, 503);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(req, { ok: false, error: "invalid_json" }, 400);
  }

  if (!body || typeof body !== "object") {
    return json(req, { ok: false, error: "invalid_body" }, 400);
  }

  const input = body as { cardTokenId?: unknown; payerEmail?: unknown };
  const cardTokenId = typeof input.cardTokenId === "string" ? input.cardTokenId.trim() : "";
  const payerEmail =
    typeof input.payerEmail === "string" ? input.payerEmail.trim().toLowerCase() : "";

  if (cardTokenId.length < 10 || cardTokenId.length > 500) {
    return json(req, { ok: false, error: "invalid_card_token" }, 400);
  }
  if (!/^[^\s@]+@testuser\.com$/i.test(payerEmail) || payerEmail.length > 254) {
    return json(req, { ok: false, error: "test_email_required" }, 400);
  }

  if (!(await rateLimit("billing:mercadopago:test-subscription:global:minute", 20, 60))) {
    return json(req, { ok: false, error: "rate_limited" }, 429);
  }

  const emailKey = await shortHash(payerEmail);
  if (!(await rateLimit(`billing:mercadopago:test-subscription:email:${emailKey}:hour`, 5, 3600))) {
    return json(req, { ok: false, error: "rate_limited" }, 429);
  }

  const ip = clientAddress(req);
  if (ip) {
    const ipKey = await shortHash(ip);
    if (!(await rateLimit(`billing:mercadopago:test-subscription:ip:${ipKey}:hour`, 10, 3600))) {
      return json(req, { ok: false, error: "rate_limited" }, 429);
    }
  }

  const externalReference = `comandiva-integration-${crypto.randomUUID()}`;
  const requestBody = {
    preapproval_plan_id: MP_TEST_PLAN_ID,
    reason: "Comandiva Integration Test",
    external_reference: externalReference,
    payer_email: payerEmail,
    card_token_id: cardTokenId,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: TEST_AMOUNT_BRL,
      currency_id: "BRL",
    },
    back_url: `${APP_ORIGIN}/integracao/mercado-pago`,
    status: "authorized",
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
      console.warn("[comandiva-billing] test subscription rejected", {
        status: upstream.status,
        message: typeof payload.message === "string" ? payload.message : "provider_rejected",
      });
      return json(
        req,
        {
          ok: false,
          error: "provider_rejected",
          upstreamStatus: upstream.status,
          providerMessage:
            typeof payload.message === "string" ? payload.message.slice(0, 300) : null,
          providerCauses: providerCauses(payload),
        },
        422,
      );
    }

    return json(req, {
      ok: true,
      environment: "test",
      subscriptionId: typeof payload.id === "string" ? payload.id : null,
      status: typeof payload.status === "string" ? payload.status : null,
      nextPaymentDate:
        typeof payload.next_payment_date === "string" ? payload.next_payment_date : null,
    });
  } catch (error) {
    console.error(
      "[comandiva-billing] test subscription request failed",
      error instanceof Error ? error.message : "unknown",
    );
    return json(req, { ok: false, error: "provider_unreachable" }, 502);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(req, { ok: true });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (req.method === "GET" && action === "public_config") {
    return publicConfig(req);
  }
  if (req.method === "GET" && action === "provider_health") {
    return providerHealth(req);
  }
  if (req.method === "POST" && action === "create_test_subscription") {
    return createTestSubscription(req);
  }

  return json(req, { ok: false, error: "action_not_allowed" }, 403);
});
