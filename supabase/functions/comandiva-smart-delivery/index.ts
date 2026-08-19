import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const PROVIDER_TIMEOUT_MS = 8_000;
const PROVIDER = "openrouteservice";
const ORS_BASE = "https://api.heigit.org";
type J = Record<string, unknown>;

type StoreReadiness = {
  smart_delivery_entitled?: boolean;
  api_key_configured?: boolean;
  billing_confirmed?: boolean;
  routes_api_enabled?: boolean;
  geocoding_api_enabled?: boolean;
  kill_switch_enabled?: boolean;
  ready_for_smart_routes?: boolean;
};
type StoreConfig = {
  store?: {
    latitude?: number | null;
    longitude?: number | null;
    address_line?: string | null;
    street?: string | null;
    address_number?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
  };
};

function obj(value: unknown): J {
  return value && typeof value === "object" && !Array.isArray(value) ? value as J : {};
}
function str(value: unknown, max = 512): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = String(value).trim();
  return parsed ? parsed.slice(0, max) : null;
}
function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
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
    if (apiKey.startsWith("sb_") && headers.get("Authorization") === `Bearer ${apiKey}`) headers.delete("Authorization");
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}
function config() {
  const url = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const publishable = parseKeys(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")).default
    ?? Deno.env.get("SUPABASE_ANON_KEY")?.trim()
    ?? "";
  const secret = parseKeys(Deno.env.get("SUPABASE_SECRET_KEYS")).default
    ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()
    ?? "";
  if (!url || !publishable || !secret) throw new Error("backend_configuration_missing");
  return { url, publishable, secret };
}
function adminClient() {
  const cfg = config();
  return createClient(cfg.url, cfg.secret, {
    global: { fetch: keyAwareFetch(cfg.secret) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function actorClient(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (token.split(".").length !== 3) return null;
  const cfg = config();
  const client = createClient(cfg.url, cfg.publishable, {
    global: {
      fetch: keyAwareFetch(cfg.publishable),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return { client, userId: data.user.id };
}
function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function validCoordinate(latitude: number, longitude: number) {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}
function orsProfile(mode: string) {
  if (mode === "drive") return "driving-car";
  if (mode === "two_wheeler") return "driving-car";
  if (mode === "bicycle") return "cycling-regular";
  if (mode === "walk") return "foot-walking";
  return null;
}
async function providerRequest(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const data = obj(await response.json().catch(() => ({})));
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}
async function consumeRateLimit(
  admin: ReturnType<typeof adminClient>,
  key: string,
  limit: number,
  windowSeconds = 60,
) {
  const { data, error } = await admin.rpc("consume_edge_rate_limit", {
    _key: key,
    _limit: limit,
    _window_seconds: windowSeconds,
  } as never);
  return !error && data === true;
}
async function usageAllowed(admin: ReturnType<typeof adminClient>, storeId: string, metric: string) {
  const { data, error } = await admin.rpc("backend_check_smart_delivery_usage", {
    _store_id: storeId,
    _metric_code: metric,
    _quantity: 1,
  } as never);
  return !error && data === true;
}
async function recordUsage(
  admin: ReturnType<typeof adminClient>,
  storeId: string,
  metric: string,
  requestId: string,
  metadata: J,
) {
  const args = {
    _store_id: storeId,
    _metric_code: metric,
    _quantity: 1,
    _provider_cost_micros: 0,
    _customer_charge_micros: 0,
    _idempotency_key: `${metric}:${requestId}`,
    _metadata: {
      ...metadata,
      provider_cost_reconciliation_pending: false,
    },
  };
  let result = await admin.rpc("backend_record_smart_delivery_usage", args as never);
  if (result.error) result = await admin.rpc("backend_record_smart_delivery_usage", args as never);
  return !result.error;
}
async function loadStoreContext(actor: Awaited<ReturnType<typeof actorClient>>, storeId: string) {
  if (!actor) throw new Error("unauthorized");
  const readinessResult = await actor.client.rpc("get_my_store_smart_delivery_readiness", { _store_id: storeId } as never);
  if (readinessResult.error) throw new Error("forbidden");
  const configResult = await actor.client.rpc("get_my_store_configuration", { _store_id: storeId } as never);
  if (configResult.error) throw new Error("forbidden");
  return {
    readiness: obj(readinessResult.data) as StoreReadiness,
    configuration: obj(configResult.data) as StoreConfig,
  };
}
function providerKey() {
  return Deno.env.get("OPENROUTESERVICE_API_KEY")?.trim() ?? "";
}
async function interactiveBudgetAllowed(
  admin: ReturnType<typeof adminClient>,
  storeId: string,
  userId: string,
  kind: "route" | "geocode",
) {
  const rules = kind === "route"
    ? [
      [`smart-delivery:ors:routes:global:minute`, 30, 60],
      [`smart-delivery:ors:routes:global:day`, 1800, 86400],
      [`smart-delivery:ors:routes:store:${storeId}:minute`, 10, 60],
      [`smart-delivery:ors:routes:user:${userId}:minute`, 8, 60],
    ] as const
    : [
      [`smart-delivery:ors:geocode:global:minute`, 20, 60],
      [`smart-delivery:ors:geocode:global:day`, 900, 86400],
      [`smart-delivery:ors:geocode:store:${storeId}:minute`, 5, 60],
      [`smart-delivery:ors:geocode:user:${userId}:minute`, 4, 60],
    ] as const;
  for (const [key, limit, seconds] of rules) {
    if (!(await consumeRateLimit(admin, key, limit, seconds))) return false;
  }
  return true;
}

async function computeRoute(
  admin: ReturnType<typeof adminClient>,
  actor: NonNullable<Awaited<ReturnType<typeof actorClient>>>,
  storeId: string,
  input: J,
) {
  const { readiness, configuration } = await loadStoreContext(actor, storeId);
  if (readiness.ready_for_smart_routes !== true) {
    return json(409, { ok: false, error: "smart_routes_not_ready", fallback: "local_or_neighborhood" });
  }

  const destination = obj(input.destination);
  const destinationLatitude = numberValue(destination.latitude);
  const destinationLongitude = numberValue(destination.longitude);
  const travelMode = str(input.travelMode, 32) ?? "two_wheeler";
  const profile = orsProfile(travelMode);
  const originLatitude = numberValue(configuration.store?.latitude);
  const originLongitude = numberValue(configuration.store?.longitude);
  if (
    originLatitude == null || originLongitude == null
    || destinationLatitude == null || destinationLongitude == null
    || !validCoordinate(originLatitude, originLongitude)
    || !validCoordinate(destinationLatitude, destinationLongitude)
    || !profile
  ) {
    return json(400, { ok: false, error: "invalid_route_request" });
  }

  if (!(await usageAllowed(admin, storeId, "routes.compute"))) {
    return json(429, { ok: false, error: "smart_delivery_usage_limit" });
  }
  if (!(await interactiveBudgetAllowed(admin, storeId, actor.userId, "route"))) {
    return json(429, { ok: false, error: "provider_budget_guard" });
  }

  const apiKey = providerKey();
  if (!apiKey) return json(503, { ok: false, error: "openrouteservice_secret_missing" });

  const requestIdInput = str(input.requestId, 64);
  const requestId = requestIdInput && validUuid(requestIdInput) ? requestIdInput : crypto.randomUUID();
  const upstream = await providerRequest(`${ORS_BASE}/openrouteservice/v2/directions/${profile}/json`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "content-type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      coordinates: [[originLongitude, originLatitude], [destinationLongitude, destinationLatitude]],
    }),
  });

  if (!upstream.ok) {
    const error = obj(upstream.data.error);
    console.error("[comandiva-smart-delivery] routes failed", upstream.status, str(error.code, 80));
    return json(upstream.status === 429 ? 429 : 502, {
      ok: false,
      error: "openrouteservice_routes_failed",
      providerStatus: upstream.status,
      fallback: "local_or_neighborhood",
    });
  }

  const routes = Array.isArray(upstream.data.routes) ? upstream.data.routes.map(obj) : [];
  const summary = routes[0] ? obj(routes[0].summary) : {};
  const distanceMeters = numberValue(summary.distance);
  const durationSeconds = numberValue(summary.duration);
  if (distanceMeters == null || distanceMeters < 0 || durationSeconds == null || durationSeconds < 0) {
    return json(502, {
      ok: false,
      error: "openrouteservice_routes_response_invalid",
      fallback: "local_or_neighborhood",
    });
  }

  const meteringPersisted = await recordUsage(admin, storeId, "routes.compute", requestId, {
    travel_mode: travelMode,
    provider_profile: profile,
    traffic_aware: false,
  });
  if (!meteringPersisted) {
    console.error("[comandiva-smart-delivery] route metering persistence failed", requestId);
    return json(503, {
      ok: false,
      error: "usage_metering_failed",
      requestId,
      fallback: "local_or_neighborhood",
    });
  }

  return json(200, {
    ok: true,
    requestId,
    provider: PROVIDER,
    attribution: "openrouteservice / OpenStreetMap contributors",
    travelMode,
    providerProfile: profile,
    distanceMeters: Math.round(distanceMeters),
    durationSeconds: Math.ceil(durationSeconds),
    approximate: false,
    cached: false,
    trafficAware: false,
  });
}

async function geocodeStore(
  admin: ReturnType<typeof adminClient>,
  actor: NonNullable<Awaited<ReturnType<typeof actorClient>>>,
  storeId: string,
  input: J,
) {
  const { readiness, configuration } = await loadStoreContext(actor, storeId);
  const geocodingReady = readiness.smart_delivery_entitled === true
    && readiness.api_key_configured === true
    && readiness.geocoding_api_enabled === true
    && readiness.kill_switch_enabled === false;
  if (!geocodingReady) return json(409, { ok: false, error: "smart_geocoding_not_ready" });

  if (!(await usageAllowed(admin, storeId, "geocoding.address"))) {
    return json(429, { ok: false, error: "smart_delivery_usage_limit" });
  }
  if (!(await interactiveBudgetAllowed(admin, storeId, actor.userId, "geocode"))) {
    return json(429, { ok: false, error: "provider_budget_guard" });
  }

  const store = configuration.store ?? {};
  const address = [
    store.street,
    store.address_number,
    store.neighborhood,
    store.city,
    store.state,
    store.postal_code,
    "Brasil",
  ].filter((value) => typeof value === "string" && value.trim()).join(", ");
  if (address.length < 8 || address.length > 500) {
    return json(409, { ok: false, error: "store_address_incomplete" });
  }

  const apiKey = providerKey();
  if (!apiKey) return json(503, { ok: false, error: "openrouteservice_secret_missing" });

  const requestIdInput = str(input.requestId, 64);
  const requestId = requestIdInput && validUuid(requestIdInput) ? requestIdInput : crypto.randomUUID();
  const endpoint = new URL(`${ORS_BASE}/pelias/v1/search`);
  endpoint.searchParams.set("text", address);
  endpoint.searchParams.set("boundary.country", "BR");
  endpoint.searchParams.set("size", "1");

  const upstream = await providerRequest(endpoint.toString(), {
    method: "GET",
    headers: { Authorization: apiKey, Accept: "application/json" },
  });
  if (!upstream.ok) {
    const error = obj(upstream.data.error);
    console.error("[comandiva-smart-delivery] geocode failed", upstream.status, str(error.code, 80));
    return json(upstream.status === 429 ? 429 : 502, {
      ok: false,
      error: "openrouteservice_geocoding_failed",
      providerStatus: upstream.status,
    });
  }

  const features = Array.isArray(upstream.data.features) ? upstream.data.features.map(obj) : [];
  const first = features[0] ?? {};
  const geometry = obj(first.geometry);
  const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
  const longitude = typeof coordinates[0] === "number" ? coordinates[0] : null;
  const latitude = typeof coordinates[1] === "number" ? coordinates[1] : null;
  if (latitude == null || longitude == null || !validCoordinate(latitude, longitude)) {
    return json(404, { ok: false, error: "geocode_not_found" });
  }
  const properties = obj(first.properties);
  const placeId = str(properties.gid, 256) ?? str(properties.id, 256);
  const granularity = str(properties.accuracy, 80) ?? str(properties.layer, 80);
  const formattedAddress = str(properties.label, 500);

  const meteringPersisted = await recordUsage(admin, storeId, "geocoding.address", requestId, {
    granularity,
    provider_layer: str(properties.layer, 80),
  });
  if (!meteringPersisted) {
    console.error("[comandiva-smart-delivery] geocode metering persistence failed", requestId);
    return json(503, { ok: false, error: "usage_metering_failed", requestId });
  }

  return json(200, {
    ok: true,
    requestId,
    provider: PROVIDER,
    attribution: "openrouteservice / OpenStreetMap contributors",
    placeId,
    latitude,
    longitude,
    granularity,
    formattedAddress,
    persisted: false,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return json(200, {
      ok: true,
      service: "comandiva-smart-delivery",
      provider: PROVIDER,
      providerSecretConfigured: Boolean(providerKey()),
      providerContentCacheEnabled: false,
    });
  }
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const actor = await actorClient(req);
  if (!actor) return json(401, { ok: false, error: "unauthorized" });

  let input: J;
  try {
    input = obj(await req.json());
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  const action = str(input.action, 40) ?? "";
  const storeId = str(input.storeId, 80) ?? "";
  if (!validUuid(storeId)) return json(400, { ok: false, error: "invalid_store" });

  const admin = adminClient();
  try {
    if (action === "compute_route") return await computeRoute(admin, actor, storeId, input);
    if (action === "geocode_store") return await geocodeStore(admin, actor, storeId, input);
    return json(403, { ok: false, error: "action_not_allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "smart_delivery_unavailable";
    return json(message === "forbidden" ? 403 : 500, {
      ok: false,
      error: message === "forbidden" ? "forbidden" : "smart_delivery_unavailable",
    });
  }
});
