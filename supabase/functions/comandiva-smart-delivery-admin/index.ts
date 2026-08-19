import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

type J = Record<string, unknown>;
const ORS_BASE = "https://api.heigit.org";
const TIMEOUT_MS = 8_000;

function obj(value: unknown): J {
  return value && typeof value === "object" && !Array.isArray(value) ? value as J : {};
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
function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
async function verifyWorkerSecret(candidate: string) {
  if (!candidate) return false;
  const admin = adminClient();
  const { data, error } = await admin.rpc("backend_verify_smart_delivery_worker_secret", { _candidate: candidate } as never);
  return !error && data === true;
}
async function consumeRateLimit(admin: ReturnType<typeof adminClient>, key: string, limit: number) {
  const { data, error } = await admin.rpc("consume_edge_rate_limit", {
    _key: key,
    _limit: limit,
    _window_seconds: 3600,
  } as never);
  return !error && data === true;
}
async function providerRequest(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = obj(await response.json().catch(() => ({})));
    return { response, payload };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const secret = req.headers.get("x-comandiva-worker-secret")?.trim() ?? "";
  if (!(await verifyWorkerSecret(secret))) return json({ ok: false, error: "unauthorized" }, 401);

  const admin = adminClient();
  let input: J;
  try {
    input = obj(await req.json());
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const action = str(input.action, 40) ?? "";
  const storeId = str(input.storeId, 80) ?? "";
  if (!validUuid(storeId)) return json({ ok: false, error: "invalid_store" }, 400);

  const apiKey = Deno.env.get("OPENROUTESERVICE_API_KEY")?.trim() ?? "";
  if (!apiKey) return json({ ok: false, error: "openrouteservice_secret_missing" }, 503);

  if (action === "preview_store_geocode") {
    if (!(await consumeRateLimit(admin, "smart-delivery:ors:admin-geocode:hour", 20))) {
      return json({ ok: false, error: "rate_limited" }, 429);
    }

    const { data: store, error: storeError } = await admin
      .from("stores")
      .select("id,name,street,address_number,neighborhood,city,state,postal_code,address_line")
      .eq("id", storeId)
      .maybeSingle();
    if (storeError || !store) return json({ ok: false, error: "store_not_found" }, 404);

    const parts = [
      str(store.street, 180),
      str(store.address_number, 40),
      str(store.neighborhood, 120),
      str(store.city, 120),
      str(store.state, 20),
      str(store.postal_code, 20),
      "Brasil",
    ].filter((value): value is string => Boolean(value));
    const address = parts.join(", ");
    if (address.length < 8) return json({ ok: false, error: "store_address_incomplete" }, 409);

    const endpoint = new URL(`${ORS_BASE}/pelias/v1/search`);
    endpoint.searchParams.set("text", address);
    endpoint.searchParams.set("boundary.country", "BR");
    endpoint.searchParams.set("size", "5");

    try {
      const { response, payload } = await providerRequest(endpoint.toString(), {
        method: "GET",
        headers: { Authorization: apiKey, Accept: "application/json" },
      });
      if (!response.ok) return json({ ok: false, error: "provider_failed", providerStatus: response.status }, 502);

      const features = Array.isArray(payload.features) ? payload.features.map(obj) : [];
      const candidates = features.map((feature) => {
        const geometry = obj(feature.geometry);
        const coords = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
        const properties = obj(feature.properties);
        return {
          latitude: num(coords[1]),
          longitude: num(coords[0]),
          label: str(properties.label, 500),
          confidence: num(properties.confidence),
          accuracy: str(properties.accuracy, 80),
          layer: str(properties.layer, 80),
          locality: str(properties.locality, 120),
          localadmin: str(properties.localadmin, 120),
          county: str(properties.county, 120),
          region: str(properties.region, 120),
          region_a: str(properties.region_a, 20),
          postalcode: str(properties.postalcode, 20),
          gid: str(properties.gid, 256) ?? str(properties.id, 256),
        };
      }).filter((candidate) => candidate.latitude !== null && candidate.longitude !== null);

      return json({ ok: true, provider: "openrouteservice", storeId, query: address, candidates });
    } catch (error) {
      const code = error instanceof DOMException && error.name === "AbortError" ? "provider_timeout" : "provider_network_error";
      return json({ ok: false, error: code }, 502);
    }
  }

  if (action === "preview_store_route") {
    if (!(await consumeRateLimit(admin, "smart-delivery:ors:admin-route:hour", 10))) {
      return json({ ok: false, error: "rate_limited" }, 429);
    }
    const destination = obj(input.destination);
    const destinationLatitude = num(destination.latitude);
    const destinationLongitude = num(destination.longitude);
    if (destinationLatitude === null || destinationLongitude === null || !validCoordinate(destinationLatitude, destinationLongitude)) {
      return json({ ok: false, error: "invalid_destination" }, 400);
    }

    const { data: store, error: storeError } = await admin
      .from("stores")
      .select("id,name,latitude,longitude")
      .eq("id", storeId)
      .maybeSingle();
    if (storeError || !store) return json({ ok: false, error: "store_not_found" }, 404);
    const originLatitude = num(store.latitude);
    const originLongitude = num(store.longitude);
    if (originLatitude === null || originLongitude === null || !validCoordinate(originLatitude, originLongitude)) {
      return json({ ok: false, error: "store_coordinates_missing" }, 409);
    }

    const usage = await admin.rpc("backend_check_smart_delivery_usage", {
      _store_id: storeId,
      _metric_code: "routes.compute",
      _quantity: 1,
    } as never);
    if (usage.error || usage.data !== true) return json({ ok: false, error: "smart_delivery_usage_limit" }, 429);

    try {
      const { response, payload } = await providerRequest(`${ORS_BASE}/openrouteservice/v2/directions/driving-car/json`, {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "content-type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ coordinates: [[originLongitude, originLatitude], [destinationLongitude, destinationLatitude]] }),
      });
      if (!response.ok) return json({ ok: false, error: "provider_failed", providerStatus: response.status }, 502);

      const routes = Array.isArray(payload.routes) ? payload.routes.map(obj) : [];
      const summary = routes[0] ? obj(routes[0].summary) : {};
      const distanceMeters = num(summary.distance);
      const durationSeconds = num(summary.duration);
      if (distanceMeters === null || durationSeconds === null || distanceMeters < 0 || durationSeconds < 0) {
        return json({ ok: false, error: "route_response_invalid" }, 502);
      }

      const requestId = crypto.randomUUID();
      const metering = await admin.rpc("backend_record_smart_delivery_usage", {
        _store_id: storeId,
        _metric_code: "routes.compute",
        _quantity: 1,
        _provider_cost_micros: 0,
        _customer_charge_micros: 0,
        _idempotency_key: `smart-delivery:qa-route:${requestId}`,
        _metadata: { qa_probe: true, travel_mode: "drive", provider_profile: "driving-car" },
      } as never);
      if (metering.error) return json({ ok: false, error: "usage_metering_failed" }, 503);

      return json({
        ok: true,
        provider: "openrouteservice",
        storeId,
        requestId,
        origin: { latitude: originLatitude, longitude: originLongitude },
        destination: { latitude: destinationLatitude, longitude: destinationLongitude },
        distanceMeters: Math.round(distanceMeters),
        durationSeconds: Math.ceil(durationSeconds),
        profile: "driving-car",
        metered: true,
      });
    } catch (error) {
      const code = error instanceof DOMException && error.name === "AbortError" ? "provider_timeout" : "provider_network_error";
      return json({ ok: false, error: code }, 502);
    }
  }

  return json({ ok: false, error: "action_not_allowed" }, 403);
});
