import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const GOOGLE_TIMEOUT_MS = 8_000;
const PROVIDER = "google_maps";
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

function googleTravelMode(mode: string) {
  if (mode === "drive") return "DRIVE";
  if (mode === "two_wheeler") return "TWO_WHEELER";
  if (mode === "bicycle") return "BICYCLE";
  if (mode === "walk") return "WALK";
  return null;
}

function parseGoogleDuration(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?s$/.test(value)) return null;
  const seconds = Number(value.slice(0, -1));
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null;
}

async function googleRequest(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const data = obj(await response.json().catch(() => ({})));
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

async function consumeRateLimit(admin: ReturnType<typeof adminClient>, key: string, limit: number) {
  const { data, error } = await admin.rpc("consume_edge_rate_limit", {
    _key: key,
    _limit: limit,
    _window_seconds: 60,
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
      provider_cost_reconciliation_pending: true,
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

function googleKey() {
  return Deno.env.get("GOOGLE_MAPS_SERVER_API_KEY")?.trim() ?? "";
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
  const googleMode = googleTravelMode(travelMode);
  const originLatitude = numberValue(configuration.store?.latitude);
  const originLongitude = numberValue(configuration.store?.longitude);
  if (
    originLatitude == null || originLongitude == null
    || destinationLatitude == null || destinationLongitude == null
    || !validCoordinate(originLatitude, originLongitude)
    || !validCoordinate(destinationLatitude, destinationLongitude)
    || !googleMode
  ) {
    return json(400, { ok: false, error: "invalid_route_request" });
  }

  if (!(await usageAllowed(admin, storeId, "routes.compute"))) {
    return json(429, { ok: false, error: "smart_delivery_usage_limit" });
  }
  if (!(await consumeRateLimit(admin, `smart-delivery:routes:${storeId}:${actor.userId}`, 60))) {
    return json(429, { ok: false, error: "rate_limited" });
  }

  const apiKey = googleKey();
  if (!apiKey) return json(503, { ok: false, error: "google_maps_secret_missing" });

  const requestIdInput = str(input.requestId, 64);
  const requestId = requestIdInput && validUuid(requestIdInput) ? requestIdInput : crypto.randomUUID();
  const upstream = await googleRequest("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: originLatitude, longitude: originLongitude } } },
      destination: { location: { latLng: { latitude: destinationLatitude, longitude: destinationLongitude } } },
      travelMode: googleMode,
      computeAlternativeRoutes: false,
      languageCode: "pt-BR",
      units: "METRIC",
    }),
  });

  if (!upstream.ok) {
    const googleError = obj(upstream.data.error);
    console.error("[comandiva-smart-delivery] routes failed", upstream.status, str(googleError.status, 80));
    return json(upstream.status === 429 ? 429 : 502, {
      ok: false,
      error: "google_routes_failed",
      providerStatus: str(googleError.status, 80),
      fallback: "local_or_neighborhood",
    });
  }

  const routes = Array.isArray(upstream.data.routes) ? upstream.data.routes.map(obj) : [];
  const route = routes[0] ?? {};
  const distanceMeters = numberValue(route.distanceMeters);
  const durationSeconds = parseGoogleDuration(route.duration);
  if (distanceMeters == null || distanceMeters < 0 || durationSeconds == null) {
    return json(502, { ok: false, error: "google_routes_response_invalid", fallback: "local_or_neighborhood" });
  }

  const meteringPersisted = await recordUsage(admin, storeId, "routes.compute", requestId, {
    travel_mode: travelMode,
    response_fields: ["distanceMeters", "duration"],
  });
  if (!meteringPersisted) {
    console.error("[comandiva-smart-delivery] route metering persistence failed", requestId);
    return json(503, { ok: false, error: "usage_metering_failed", requestId, fallback: "local_or_neighborhood" });
  }

  return json(200, {
    ok: true,
    requestId,
    provider: PROVIDER,
    attribution: "Google Maps",
    travelMode,
    distanceMeters,
    durationSeconds,
    approximate: false,
    cached: false,
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
    && readiness.billing_confirmed === true
    && readiness.geocoding_api_enabled === true
    && readiness.kill_switch_enabled === false;
  if (!geocodingReady) return json(409, { ok: false, error: "smart_geocoding_not_ready" });

  if (!(await usageAllowed(admin, storeId, "geocoding.address"))) {
    return json(429, { ok: false, error: "smart_delivery_usage_limit" });
  }
  if (!(await consumeRateLimit(admin, `smart-delivery:geocode:${storeId}:${actor.userId}`, 10))) {
    return json(429, { ok: false, error: "rate_limited" });
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
  if (address.length < 8 || address.length > 500) return json(409, { ok: false, error: "store_address_incomplete" });

  const apiKey = googleKey();
  if (!apiKey) return json(503, { ok: false, error: "google_maps_secret_missing" });
  const requestIdInput = str(input.requestId, 64);
  const requestId = requestIdInput && validUuid(requestIdInput) ? requestIdInput : crypto.randomUUID();

  const endpoint = `https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(address)}`;
  const upstream = await googleRequest(endpoint, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "results.placeId,results.location,results.granularity,results.formattedAddress",
    },
  });
  if (!upstream.ok) {
    const googleError = obj(upstream.data.error);
    console.error("[comandiva-smart-delivery] geocode failed", upstream.status, str(googleError.status, 80));
    return json(upstream.status === 429 ? 429 : 502, {
      ok: false,
      error: "google_geocoding_failed",
      providerStatus: str(googleError.status, 80),
    });
  }

  const results = Array.isArray(upstream.data.results) ? upstream.data.results.map(obj) : [];
  const first = results[0] ?? {};
  const location = obj(first.location);
  const latitude = numberValue(location.latitude);
  const longitude = numberValue(location.longitude);
  if (latitude == null || longitude == null || !validCoordinate(latitude, longitude)) {
    return json(404, { ok: false, error: "geocode_not_found" });
  }

  const meteringPersisted = await recordUsage(admin, storeId, "geocoding.address", requestId, {
    granularity: str(first.granularity, 80),
    response_fields: ["placeId", "location", "granularity", "formattedAddress"],
  });
  if (!meteringPersisted) {
    console.error("[comandiva-smart-delivery] geocode metering persistence failed", requestId);
    return json(503, { ok: false, error: "usage_metering_failed", requestId });
  }

  return json(200, {
    ok: true,
    requestId,
    provider: PROVIDER,
    attribution: "Google Maps",
    placeId: str(first.placeId, 256),
    latitude,
    longitude,
    granularity: str(first.granularity, 80),
    formattedAddress: str(first.formattedAddress, 500),
    persisted: false,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return json(200, {
      ok: true,
      service: "comandiva-smart-delivery",
      provider: PROVIDER,
      googleSecretConfigured: Boolean(googleKey()),
      googleContentCacheEnabled: false,
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
