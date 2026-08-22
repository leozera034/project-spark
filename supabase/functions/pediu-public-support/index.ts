import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { z } from "npm:zod@3.24.2";

const MAX_BODY_BYTES = 16 * 1024;

const errorSchema = z.object({
  message: z.string().trim().min(1).max(500),
  stack: z.string().max(4000).optional(),
  route: z.string().max(300).optional(),
  source: z.string().max(120).optional(),
  boundary: z.string().max(120).optional(),
  userAgent: z.string().max(500).optional(),
});

const slugSchema = z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/i);
const fulfillmentSchema = z.object({
  slug: slugSchema,
});
const fulfillmentValidateSchema = z.object({
  slug: slugSchema,
  fulfillmentType: z.enum(["entrega", "retirada"]),
  deliveryAreaId: z.string().uuid().nullable().optional(),
  configurationVersion: z.string().trim().max(128).nullable().optional(),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
});

function parseKeyDictionary(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function knownPublishableKey(req: Request): boolean {
  const supplied = req.headers.get("apikey") ?? "";
  if (!supplied) return false;
  const modern = Object.values(parseKeyDictionary(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")));
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  return modern.includes(supplied) || (Boolean(legacy) && supplied === legacy);
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
  const modern = parseKeyDictionary(Deno.env.get("SUPABASE_SECRET_KEYS"));
  const key = modern.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("backend_configuration_missing");
  return createClient(url, key, {
    global: { fetch: keyAwareFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function allowedOrigin(req: Request): string {
  const origin = req.headers.get("origin") ?? "";
  if (origin === "https://shark-cardapio.lovable.app") return origin;
  if (/^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(origin)) return origin;
  return "https://shark-cardapio.lovable.app";
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": allowedOrigin(req),
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
      vary: "Origin",
    },
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function consumeRateLimit(
  admin: ReturnType<typeof adminClient>,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await admin.rpc("consume_edge_rate_limit", {
    _key: key,
    _limit: limit,
    _window_seconds: windowSeconds,
  } as never);
  if (error || data !== true) return false;
  return true;
}

function sanitize(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/gi, "sb_[redacted]")
    .replace(/[A-Fa-f0-9]{32,}/g, "[redacted]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email-redacted]");
}

async function listPlans(req: Request) {
  const admin = adminClient();
  const { data: plans, error } = await admin
    .from("plans")
    .select("id,code,name,description,monthly_price,max_orders_month,max_team_members,max_couriers,features")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(20);
  if (error) return json(req, { ok: false, error: "plans_unavailable" }, 502);

  const planIds = (plans ?? []).map((plan) => plan.id);
  const { data: prices, error: pricesError } = planIds.length
    ? await admin
        .from("plan_prices")
        .select("plan_id,billing_interval,amount_cents,currency,trial_days")
        .in("plan_id", planIds)
        .eq("is_active", true)
        .order("billing_interval", { ascending: true })
    : { data: [], error: null };
  if (pricesError) return json(req, { ok: false, error: "plan_prices_unavailable" }, 502);

  const byPlan = new Map<string, Array<Record<string, unknown>>>();
  for (const price of prices ?? []) {
    const items = byPlan.get(price.plan_id) ?? [];
    items.push({
      billing_interval: price.billing_interval,
      amount_cents: price.amount_cents,
      currency: price.currency,
      trial_days: price.trial_days,
    });
    byPlan.set(price.plan_id, items);
  }

  return json(req, {
    ok: true,
    data: (plans ?? []).map(({ id, ...plan }) => ({
      ...plan,
      prices: byPlan.get(id) ?? [],
    })),
  });
}

async function listStoreSlugs(req: Request) {
  const admin = adminClient();
  const { data, error } = await admin
    .from("stores")
    .select("slug")
    .eq("status", "ativa")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return json(req, { ok: false, error: "stores_unavailable" }, 502);
  return json(req, {
    ok: true,
    data: (data ?? []).map((row) => row.slug).filter((slug): slug is string => typeof slug === "string" && slug.length > 0),
  });
}

async function storefrontFulfillment(req: Request, payload: Record<string, unknown>) {
  const parsed = fulfillmentSchema.safeParse(payload.input);
  if (!parsed.success) return json(req, { ok: false, error: "invalid_input" }, 400);
  const admin = adminClient();
  const { data, error } = await admin.rpc("storefront_fulfillment", { _slug: parsed.data.slug } as never);
  if (error) {
    console.error("[pediu-public-support] fulfillment", error.code ?? "unknown");
    return json(req, { ok: false, error: "fulfillment_unavailable" }, 502);
  }
  if (data == null) return json(req, { ok: false, error: "store_not_found" }, 404);
  return json(req, { ok: true, data });
}

async function storefrontFulfillmentValidate(req: Request, payload: Record<string, unknown>) {
  const parsed = fulfillmentValidateSchema.safeParse(payload.input);
  if (!parsed.success) return json(req, { ok: false, error: "invalid_input" }, 400);
  const input = parsed.data;
  const admin = adminClient();
  const { data, error } = await admin.rpc("storefront_validate_fulfillment_v2", {
    _slug: input.slug,
    _fulfillment_type: input.fulfillmentType,
    _delivery_area_id: input.deliveryAreaId ?? null,
    _configuration_version: input.configurationVersion ?? null,
    _latitude: input.latitude ?? null,
    _longitude: input.longitude ?? null,
  } as never);
  if (error) {
    console.error("[pediu-public-support] fulfillment_validate", error.code ?? "unknown");
    return json(req, { ok: false, error: "fulfillment_validation_unavailable" }, 502);
  }
  if (data == null) return json(req, { ok: false, error: "store_not_found" }, 404);
  return json(req, { ok: true, data });
}

async function recordClientError(req: Request, payload: Record<string, unknown>) {
  const parsed = errorSchema.safeParse(payload.input);
  if (!parsed.success) return json(req, { ok: false, error: "invalid_input" }, 400);
  const input = parsed.data;
  const admin = adminClient();
  const bucketHash = (await sha256(`${input.source ?? "client"}:${input.route ?? "unknown"}`)).slice(0, 24);
  const [globalOk, bucketOk] = await Promise.all([
    consumeRateLimit(admin, "observability:global:minute", 120, 60),
    consumeRateLimit(admin, `observability:${bucketHash}:minute`, 20, 60),
  ]);
  if (!globalOk || !bucketOk) return json(req, { ok: false, error: "rate_limited" }, 429);

  const { error } = await admin.from("audit_logs").insert({
    actor_kind: "sistema",
    action: "app.error",
    entity: "application",
    context: {
      message: sanitize(input.message),
      stack: sanitize(input.stack),
      route: input.route,
      source: input.source,
      boundary: input.boundary,
      userAgent: sanitize(input.userAgent),
    },
  });
  if (error) return json(req, { ok: false, error: "storage_failed" }, 502);
  return json(req, { ok: true, data: { accepted: true } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(req, { ok: true });
  if (req.method !== "POST") return json(req, { ok: false, error: "method_not_allowed" }, 405);
  if (!knownPublishableKey(req)) return json(req, { ok: false, error: "invalid_api_key" }, 401);

  const length = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return json(req, { ok: false, error: "payload_too_large" }, 413);
  }

  try {
    const payload = (await req.json()) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "";
    if (action === "plans") return await listPlans(req);
    if (action === "store_slugs") return await listStoreSlugs(req);
    if (action === "storefront_fulfillment") return await storefrontFulfillment(req, payload);
    if (action === "storefront_fulfillment_validate") return await storefrontFulfillmentValidate(req, payload);
    if (action === "record_client_error") return await recordClientError(req, payload);
    return json(req, { ok: false, error: "action_not_allowed" }, 403);
  } catch (error) {
    console.error("[pediu-public-support] unhandled", error instanceof Error ? error.message : "unknown");
    return json(req, { ok: false, error: "internal_error" }, 500);
  }
});
