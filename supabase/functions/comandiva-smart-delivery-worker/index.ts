import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const PROVIDER = "openrouteservice";
const ORS_BASE = "https://api.heigit.org";
const BATCH_SIZE = 10;
const PROVIDER_TIMEOUT_MS = 8_000;

type JsonRecord = Record<string, unknown>;
type ClaimedJob = {
  id: string;
  store_id: string;
  job_type: "geocode_address" | "compute_delivery_route";
  address_id?: string | null;
  delivery_id?: string | null;
  attempts: number;
  max_attempts: number;
  metadata?: JsonRecord;
};

function obj(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}
function str(value: unknown, max = 512): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = String(value).trim();
  return parsed ? parsed.slice(0, max) : null;
}
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function validCoordinate(latitude: number, longitude: number) {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
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
function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const modern = parseKeys(Deno.env.get("SUPABASE_SECRET_KEYS"));
  const key = modern.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  if (!url || !key) throw new Error("backend_configuration_missing");
  return createClient(url, key, {
    global: { fetch: keyAwareFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
function orsApiKey() {
  return Deno.env.get("OPENROUTESERVICE_API_KEY")?.trim() ?? "";
}
function retryAfterSeconds(headers: Headers): number | null {
  const raw = headers.get("retry-after")?.trim();
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const target = Date.parse(raw);
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.ceil((target - Date.now()) / 1000));
}
function retryDelay(attempt: number, headers?: Headers) {
  const header = headers ? retryAfterSeconds(headers) : null;
  if (header !== null) return Math.max(15, Math.min(header, 3600));
  return Math.min(900, 30 * Math.pow(2, Math.max(0, attempt - 1)));
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
    const payload = obj(await response.json().catch(() => ({})));
    return { response, payload };
  } finally {
    clearTimeout(timer);
  }
}
function classifyProviderFailure(status: number, payload: JsonRecord, headers: Headers) {
  const nested = obj(payload.error);
  const code = str(nested.code, 120) ?? str(payload.code, 120) ?? `HTTP_${status}`;
  const message = str(nested.message, 500) ?? str(payload.message, 500) ?? `OpenRouteService request failed with HTTP ${status}`;
  const retryable = status === 408 || status === 429 || status >= 500;
  return { code: `ORS_${code}`.slice(0, 120), message, retryable, retryAfter: retryDelay(1, headers) };
}
async function verifyWorkerSecret(candidate: string) {
  if (!candidate) return false;
  const admin = adminClient();
  const { data, error } = await admin.rpc("backend_verify_smart_delivery_worker_secret", { _candidate: candidate } as never);
  return !error && data === true;
}
async function consumeRateLimit(
  admin: ReturnType<typeof adminClient>,
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const { data, error } = await admin.rpc("consume_edge_rate_limit", {
    _key: key,
    _limit: limit,
    _window_seconds: windowSeconds,
  } as never);
  return !error && data === true;
}
async function providerBudgetAllowed(
  admin: ReturnType<typeof adminClient>,
  storeId: string,
  kind: "route" | "geocode",
) {
  const rules = kind === "route"
    ? [
      [`smart-delivery:ors:routes:global:minute`, 30, 60],
      [`smart-delivery:ors:routes:global:day`, 1800, 86400],
      [`smart-delivery:ors:routes:store:${storeId}:minute`, 10, 60],
    ] as const
    : [
      [`smart-delivery:ors:geocode:global:minute`, 20, 60],
      [`smart-delivery:ors:geocode:global:day`, 900, 86400],
      [`smart-delivery:ors:geocode:store:${storeId}:minute`, 5, 60],
    ] as const;
  for (const [key, limit, seconds] of rules) {
    if (!(await consumeRateLimit(admin, key, limit, seconds))) return false;
  }
  return true;
}
async function failJob(
  admin: ReturnType<typeof adminClient>,
  job: ClaimedJob,
  workerId: string,
  code: string,
  message: string,
  retryable: boolean,
  retryAfter?: number | null,
) {
  await admin.rpc("backend_fail_smart_delivery_job", {
    _job_id: job.id,
    _worker_id: workerId,
    _error_code: code.slice(0, 120),
    _error_message: message.slice(0, 500),
    _retriable: retryable,
    _retry_after_seconds: retryAfter ?? retryDelay(job.attempts),
  } as never);
}
async function cancelJob(admin: ReturnType<typeof adminClient>, job: ClaimedJob, workerId: string, reason: string) {
  await admin.rpc("backend_cancel_smart_delivery_job", {
    _job_id: job.id,
    _worker_id: workerId,
    _reason: reason.slice(0, 500),
  } as never);
}
async function recordHealth(
  admin: ReturnType<typeof adminClient>,
  apiKeyConfigured: boolean,
  routesEnabled: boolean,
  geocodingEnabled: boolean,
  killSwitch: boolean,
  errorCode: string | null,
  errorDetail: string | null,
) {
  const result = await admin.rpc("backend_record_smart_delivery_provider_health", {
    _api_key_configured: apiKeyConfigured,
    _routes_api_enabled: routesEnabled,
    _geocoding_api_enabled: geocodingEnabled,
    _kill_switch_enabled: killSwitch,
    _error_code: errorCode,
    _error_detail: errorDetail,
  } as never);
  return !result.error;
}
async function probeProvider(admin: ReturnType<typeof adminClient>, apiKey: string) {
  if (!(await consumeRateLimit(admin, "smart-delivery:ors:health:hour", 4, 3600))) {
    return json({ ok: false, provider: PROVIDER, error: "health_probe_rate_limited" }, 429);
  }
  if (!apiKey) {
    await recordHealth(
      admin, false, false, false, true,
      "OPENROUTESERVICE_API_KEY_MISSING",
      "OPENROUTESERVICE_API_KEY is not available to the Edge Function runtime.",
    );
    return json({ ok: false, provider: PROVIDER, keyConfigured: false, routes: false, geocoding: false }, 503);
  }

  let geocodingOk = false;
  let routesOk = false;
  let geocodingStatus: number | null = null;
  let routesStatus: number | null = null;
  let detail: string | null = null;

  try {
    const geocodeUrl = new URL(`${ORS_BASE}/pelias/v1/search`);
    geocodeUrl.searchParams.set("text", "Limeira do Oeste, Minas Gerais, Brasil");
    geocodeUrl.searchParams.set("boundary.country", "BR");
    geocodeUrl.searchParams.set("size", "1");
    const geocode = await providerRequest(geocodeUrl.toString(), {
      method: "GET",
      headers: { Authorization: apiKey, Accept: "application/json" },
    });
    geocodingStatus = geocode.response.status;
    const features = Array.isArray(geocode.payload.features) ? geocode.payload.features.map(obj) : [];
    const geometry = features[0] ? obj(features[0].geometry) : {};
    const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    geocodingOk = geocode.response.ok
      && typeof coordinates[0] === "number"
      && typeof coordinates[1] === "number";
    if (!geocodingOk) detail = `geocoding_http_${geocodingStatus ?? "unknown"}`;
  } catch (error) {
    detail = error instanceof DOMException && error.name === "AbortError" ? "geocoding_timeout" : "geocoding_network_error";
  }

  try {
    const route = await providerRequest(`${ORS_BASE}/openrouteservice/v2/directions/driving-car/json`, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "content-type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        coordinates: [[8.681495, 49.41461], [8.686507, 49.41943]],
      }),
    });
    routesStatus = route.response.status;
    const routes = Array.isArray(route.payload.routes) ? route.payload.routes.map(obj) : [];
    const summary = routes[0] ? obj(routes[0].summary) : {};
    routesOk = route.response.ok && num(summary.distance) !== null && num(summary.duration) !== null;
    if (!routesOk) detail = [detail, `routes_http_${routesStatus ?? "unknown"}`].filter(Boolean).join("; ").slice(0, 500);
  } catch (error) {
    const routeDetail = error instanceof DOMException && error.name === "AbortError" ? "routes_timeout" : "routes_network_error";
    detail = [detail, routeDetail].filter(Boolean).join("; ").slice(0, 500);
  }

  const ready = geocodingOk && routesOk;
  const persisted = await recordHealth(
    admin,
    true,
    routesOk,
    geocodingOk,
    !ready,
    ready ? null : "ORS_HEALTH_PARTIAL",
    ready ? null : detail ?? "OpenRouteService health probe did not validate all required capabilities.",
  );
  return json({
    ok: ready && persisted,
    provider: PROVIDER,
    keyConfigured: true,
    routes: routesOk,
    routesStatus,
    geocoding: geocodingOk,
    geocodingStatus,
    killSwitchEnabled: !ready,
    healthPersisted: persisted,
  }, ready && persisted ? 200 : 503);
}

async function processGeocode(
  admin: ReturnType<typeof adminClient>,
  job: ClaimedJob,
  workerId: string,
  context: JsonRecord,
  apiKey: string,
) {
  const address = obj(context.address);
  const parts = [
    str(address.street, 180),
    str(address.number, 40),
    str(address.neighborhood, 120),
    str(address.city, 120),
    str(address.state, 20),
    str(address.country, 40) ?? "Brasil",
  ].filter((value): value is string => Boolean(value));
  const addressText = parts.join(", ");
  if (addressText.length < 8 || addressText.length > 500) {
    await cancelJob(admin, job, workerId, "address_incomplete");
    return "cancelled" as const;
  }
  if (!(await providerBudgetAllowed(admin, job.store_id, "geocode"))) {
    await failJob(admin, job, workerId, "ORS_BUDGET_GUARD", "OpenRouteService geocoding safety budget reached.", true, 120);
    return "failed" as const;
  }

  try {
    const endpoint = new URL(`${ORS_BASE}/pelias/v1/search`);
    endpoint.searchParams.set("text", addressText);
    endpoint.searchParams.set("boundary.country", "BR");
    endpoint.searchParams.set("size", "1");
    const { response, payload } = await providerRequest(endpoint.toString(), {
      method: "GET",
      headers: { Authorization: apiKey, Accept: "application/json" },
    });
    if (!response.ok) {
      const failure = classifyProviderFailure(response.status, payload, response.headers);
      await failJob(admin, job, workerId, failure.code, failure.message, failure.retryable, retryDelay(job.attempts, response.headers));
      return "failed" as const;
    }

    const features = Array.isArray(payload.features) ? payload.features.map(obj) : [];
    const first = features[0];
    if (!first) {
      await failJob(admin, job, workerId, "ORS_GEOCODE_NOT_FOUND", "No geocoding result matched the saved address.", false);
      return "failed" as const;
    }
    const geometry = obj(first.geometry);
    const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const longitude = typeof coordinates[0] === "number" ? coordinates[0] : null;
    const latitude = typeof coordinates[1] === "number" ? coordinates[1] : null;
    if (latitude === null || longitude === null || !validCoordinate(latitude, longitude)) {
      await failJob(admin, job, workerId, "ORS_GEOCODE_RESPONSE_INVALID", "OpenRouteService returned an invalid location.", false);
      return "failed" as const;
    }
    const properties = obj(first.properties);
    const requestId = crypto.randomUUID();
    const completion = await admin.rpc("backend_complete_smart_delivery_geocode_job", {
      _job_id: job.id,
      _worker_id: workerId,
      _latitude: latitude,
      _longitude: longitude,
      _place_id: str(properties.gid, 256) ?? str(properties.id, 256),
      _precision: str(properties.accuracy, 80) ?? str(properties.layer, 80),
      _request_id: requestId,
    } as never);
    if (completion.error || completion.data !== true) {
      await failJob(admin, job, workerId, "ORS_GEOCODE_PERSIST_FAILED", "Could not persist the geocoding result.", true);
      return "failed" as const;
    }
    return "completed" as const;
  } catch (error) {
    const code = error instanceof DOMException && error.name === "AbortError" ? "ORS_TIMEOUT" : "ORS_NETWORK_ERROR";
    await failJob(admin, job, workerId, code, error instanceof Error ? error.message : "OpenRouteService network error", true);
    return "failed" as const;
  }
}

async function processRoute(
  admin: ReturnType<typeof adminClient>,
  job: ClaimedJob,
  workerId: string,
  context: JsonRecord,
  apiKey: string,
) {
  const origin = obj(context.origin);
  const destination = obj(context.destination);
  const originLatitude = num(origin.latitude);
  const originLongitude = num(origin.longitude);
  const destinationLatitude = num(destination.latitude);
  const destinationLongitude = num(destination.longitude);
  const travelMode = str(context.travelMode, 32) ?? "two_wheeler";
  const profile = orsProfile(travelMode);
  if (
    originLatitude === null || originLongitude === null || destinationLatitude === null || destinationLongitude === null || !profile
    || !validCoordinate(originLatitude, originLongitude)
    || !validCoordinate(destinationLatitude, destinationLongitude)
  ) {
    await cancelJob(admin, job, workerId, "route_context_invalid");
    return "cancelled" as const;
  }
  if (!(await providerBudgetAllowed(admin, job.store_id, "route"))) {
    await failJob(admin, job, workerId, "ORS_BUDGET_GUARD", "OpenRouteService directions safety budget reached.", true, 120);
    return "failed" as const;
  }

  try {
    const { response, payload } = await providerRequest(`${ORS_BASE}/openrouteservice/v2/directions/${profile}/json`, {
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
    if (!response.ok) {
      const failure = classifyProviderFailure(response.status, payload, response.headers);
      await failJob(admin, job, workerId, failure.code, failure.message, failure.retryable, retryDelay(job.attempts, response.headers));
      return "failed" as const;
    }

    const routes = Array.isArray(payload.routes) ? payload.routes.map(obj) : [];
    const summary = routes[0] ? obj(routes[0].summary) : {};
    const distanceMeters = num(summary.distance);
    const durationSeconds = num(summary.duration);
    if (distanceMeters === null || distanceMeters < 0 || durationSeconds === null || durationSeconds < 0) {
      await failJob(admin, job, workerId, "ORS_ROUTE_RESPONSE_INVALID", "OpenRouteService returned no usable route.", false);
      return "failed" as const;
    }
    const requestId = crypto.randomUUID();
    const completion = await admin.rpc("backend_complete_smart_delivery_route_job", {
      _job_id: job.id,
      _worker_id: workerId,
      _distance_meters: Math.round(distanceMeters),
      _duration_seconds: Math.ceil(durationSeconds),
      _travel_mode: travelMode,
      _request_id: requestId,
    } as never);
    if (completion.error || completion.data !== true) {
      await failJob(admin, job, workerId, "ORS_ROUTE_PERSIST_FAILED", "Could not persist the route estimate.", true);
      return "failed" as const;
    }
    return "completed" as const;
  } catch (error) {
    const code = error instanceof DOMException && error.name === "AbortError" ? "ORS_TIMEOUT" : "ORS_NETWORK_ERROR";
    await failJob(admin, job, workerId, code, error instanceof Error ? error.message : "OpenRouteService network error", true);
    return "failed" as const;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const workerSecret = req.headers.get("x-comandiva-worker-secret")?.trim() ?? "";
  if (!(await verifyWorkerSecret(workerSecret))) return json({ ok: false, error: "unauthorized" }, 401);

  const admin = adminClient();
  if (!(await consumeRateLimit(admin, "smart-delivery:ors:worker:minute", 60, 60))) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  let input: JsonRecord = {};
  try {
    input = obj(await req.json());
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const apiKey = orsApiKey();
  if (str(input.action, 40) === "health_probe") {
    return await probeProvider(admin, apiKey);
  }
  if (!apiKey) {
    await recordHealth(
      admin, false, false, false, true,
      "OPENROUTESERVICE_API_KEY_MISSING",
      "OPENROUTESERVICE_API_KEY is not available to the Edge Function runtime.",
    );
    return json({ ok: false, processed: 0, error: "OPENROUTESERVICE_API_KEY_MISSING" }, 503);
  }

  const workerId = `smart-delivery:${Deno.env.get("SB_EXECUTION_ID")?.trim() || crypto.randomUUID()}`.slice(0, 180);
  const claim = await admin.rpc("backend_claim_smart_delivery_jobs", { _worker_id: workerId, _limit: BATCH_SIZE } as never);
  if (claim.error) {
    console.error("[comandiva-smart-delivery-worker] claim failed", claim.error.code ?? "unknown");
    return json({ ok: false, processed: 0, error: "claim_failed" }, 500);
  }

  const jobs = Array.isArray(claim.data) ? claim.data.map(obj) as unknown as ClaimedJob[] : [];
  let completed = 0;
  let failed = 0;
  let cancelled = 0;

  for (const job of jobs) {
    const jobId = str(job.id, 80);
    if (!jobId) continue;
    const contextResult = await admin.rpc("backend_get_smart_delivery_job_context", {
      _job_id: jobId,
      _worker_id: workerId,
    } as never);
    if (contextResult.error) {
      await failJob(admin, job, workerId, "JOB_CONTEXT_FAILED", "Could not load the smart delivery job context.", true);
      failed += 1;
      continue;
    }
    const context = obj(contextResult.data);
    if (context.ready !== true) {
      await cancelJob(admin, job, workerId, str(context.reason, 160) ?? "no_longer_needed");
      cancelled += 1;
      continue;
    }

    const result = job.job_type === "geocode_address"
      ? await processGeocode(admin, job, workerId, context, apiKey)
      : await processRoute(admin, job, workerId, context, apiKey);
    if (result === "completed") completed += 1;
    else if (result === "cancelled") cancelled += 1;
    else failed += 1;
  }

  return json({ ok: true, provider: PROVIDER, processed: jobs.length, completed, failed, cancelled });
});
