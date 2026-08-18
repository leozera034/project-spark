import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const MP_API = "https://api.mercadopago.com";
const APP_ORIGIN = "https://shark-cardapio.lovable.app";

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
      "vary": "Origin",
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

async function providerHealth(req: Request): Promise<Response> {
  if (!(await rateLimit("billing:mercadopago:health:minute", 10, 60))) {
    return json(req, { ok: false, error: "rate_limited" }, 429);
  }

  const token = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_TEST");
  if (!token) {
    return json(req, { ok: false, provider: "mercado_pago", environment: "test", configured: false }, 503);
  }

  try {
    const upstream = await fetch(`${MP_API}/preapproval_plan/search?limit=1&offset=0`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
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
    console.error("[comandiva-billing] provider health failed", error instanceof Error ? error.message : "unknown");
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(req, { ok: true });
  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("action") === "provider_health") {
    return providerHealth(req);
  }
  return json(req, { ok: false, error: "action_not_allowed" }, 403);
});
