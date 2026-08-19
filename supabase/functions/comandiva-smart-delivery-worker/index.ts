import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const PROVIDER = "google_maps";
const BATCH_SIZE = 10;
const GOOGLE_TIMEOUT_MS = 8_000;
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
function googleApiKey() {
  return Deno.env.get("GOOGLE_MAPS_SERVER_API_KEY")?.trim() ?? "";
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
function parseDurationSeconds(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?s$/.test(value)) return null;
  const seconds = Number(value.slice(0, -1));
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null;
}
function googleTravelMode(mode: string) {
  if (mode === "drive") return "DRIVE";
  if (mode === "two_wheeler") return "TWO_WHEELER";
  if (mode === "bicycle") return "BICYCLE";
  if (mode === "walk") return "WALK";
  return null;
}
async function googleRequest(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = obj(await response.json().catch(() => ({})));
    return { response, payload };
  } finally {
    clearTimeout(timer);
  }
}
function classifyGoogleFailure(status: number, payload: JsonRecord, headers: Headers) {
  const error = obj(payload.error);
  const code = str(error.status, 120) ?? `HTTP_${status}`;
  const message = str(error.message, 500) ?? `Google Maps request failed with HTTP ${status}`;
  const retryable = status === 408 || status === 429 || status >= 500;
  return { code, message, retryable, retryAfter: retryDelay(1, headers) };
}
async function verifyWorkerSecret(candidate: string) {
  if (!candidate) return false;
  const admin = adminClient();
  const { data, error } = await admin.rpc("backend_verify_smart_delivery_worker_secret", { _candidate: candidate } as never);
  return !error && data === true;
}
async function consumeWorkerRateLimit() {
  const admin = adminClient();
  const { data, error } = await admin.rpc("consume_edge_rate_limit", {
    _key: "smart-delivery:google:worker:minute",
    _limit: 120,
    _window_seconds: 60,
  } as never);
  return !error && data === true;
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

  try {
    const endpoint = new URL(`https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(addressText)}`);
    endpoint.searchParams.set("regionCode", "BR");
    endpoint.searchParams.set("languageCode", "pt-BR");
    const { response, payload } = await googleRequest(endpoint.toString(), {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "results.placeId,results.location,results.granularity",
      },
    });
    if (!response.ok) {
      const failure = classifyGoogleFailure(response.status, payload, response.headers);
      await failJob(admin, job, workerId, failure.code, failure.message, failure.retryable, retryDelay(job.attempts, response.headers));
      return "failed" as const;
    }

    const rows = Array.isArray(payload.results) ? payload.results.map(obj) : [];
    const first = rows[0];
    if (!first) {
      await failJob(admin, job, workerId, "GEOCODE_NOT_FOUND", "No geocoding result matched the saved address.", false);
      return "failed" as const;
    }
    const location = obj(first.location);
    const latitude = num(location.latitude);
    const longitude = num(location.longitude);
    if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      await failJob(admin, job, workerId, "GEOCODE_RESPONSE_INVALID", "Google Geocoding returned an invalid location.", false);
      return "failed" as const;
    }
    const requestId = crypto.randomUUID();
    const completion = await admin.rpc("backend_complete_smart_delivery_geocode_job", {
      _job_id: job.id,
      _worker_id: workerId,
      _latitude: latitude,
      _longitude: longitude,
      _place_id: str(first.placeId, 256),
      _precision: str(first.granularity, 80),
      _request_id: requestId,
    } as never);
    if (completion.error || completion.data !== true) {
      await failJob(admin, job, workerId, "GEOCODE_PERSIST_FAILED", "Could not persist the geocoding result.", true);
      return "failed" as const;
    }
    return "completed" as const;
  } catch (error) {
    const code = error instanceof DOMException && error.name === "AbortError" ? "GOOGLE_TIMEOUT" : "GOOGLE_NETWORK_ERROR";
    await failJob(admin, job, workerId, code, error instanceof Error ? error.message : "Google network error", true);
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
  const providerMode = googleTravelMode(travelMode);
  if (
    originLatitude === null || originLongitude === null || destinationLatitude === null || destinationLongitude === null || !providerMode
    || originLatitude < -90 || originLatitude > 90 || destinationLatitude < -90 || destinationLatitude > 90
    || originLongitude < -180 || originLongitude > 180 || destinationLongitude < -180 || destinationLongitude > 180
  ) {
    await cancelJob(admin, job, workerId, "route_context_invalid");
    return "cancelled" as const;
  }

  try {
    const { response, payload } = await googleRequest("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: originLatitude, longitude: originLongitude } } },
        destination: { location: { latLng: { latitude: destinationLatitude, longitude: destinationLongitude } } },
        travelMode: providerMode,
        computeAlternativeRoutes: false,
        languageCode: "pt-BR",
        units: "METRIC",
      }),
    });
    if (!response.ok) {
      const failure = classifyGoogleFailure(response.status, payload, response.headers);
      await failJob(admin, job, workerId, failure.code, failure.message, failure.retryable, retryDelay(job.attempts, response.headers));
      return "failed" as const;
    }

    const routes = Array.isArray(payload.routes) ? payload.routes.map(obj) : [];
    const route = routes[0];
    const distanceMeters = route ? num(route.distanceMeters) : null;
    const durationSeconds = route ? parseDurationSeconds(route.duration) : null;
    if (distanceMeters === null || distanceMeters < 0 || durationSeconds === null) {
      await failJob(admin, job, workerId, "ROUTE_RESPONSE_INVALID", "Google Routes returned no usable route.", false);
      return "failed" as const;
    }
    const requestId = crypto.randomUUID();
    const completion = await admin.rpc("backend_complete_smart_delivery_route_job", {
      _job_id: job.id,
      _worker_id: workerId,
      _distance_meters: Math.round(distanceMeters),
      _duration_seconds: durationSeconds,
      _travel_mode: travelMode,
      _request_id: requestId,
    } as never);
    if (completion.error || completion.data !== true) {
      await failJob(admin, job, workerId, "ROUTE_PERSIST_FAILED", "Could not persist the route estimate.", true);
      return "failed" as const;
    }
    return "completed" as const;
  } catch (error) {
    const code = error instanceof DOMException && error.name === "AbortError" ? "GOOGLE_TIMEOUT" : "GOOGLE_NETWORK_ERROR";
    await failJob(admin, job, workerId, code, error instanceof Error ? error.message : "Google network error", true);
    return "failed" as const;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const workerSecret = req.headers.get("x-comandiva-worker-secret")?.trim() ?? "";
  if (!(await verifyWorkerSecret(workerSecret))) return json({ ok: false, error: "unauthorized" }, 401);
  if (!(await consumeWorkerRateLimit())) return json({ ok: false, error: "rate_limited" }, 429);

  const apiKey = googleApiKey();
  if (!apiKey) return json({ ok: false, processed: 0, error: "GOOGLE_MAPS_SERVER_API_KEY_MISSING" }, 503);

  const admin = adminClient();
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
    const contextResult = await admin.rpc("backend_get_smart_delivery_job_context", { _job_id: jobId, _worker_id: workerId } as never);
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
