import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { GoogleAuth } from "npm:google-auth-library@9.15.1";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const BATCH_SIZE = 10;
const SEND_TIMEOUT_MS = 10_000;

type JsonRecord = Record<string, unknown>;
type ServiceAccount = { project_id?: string; client_email?: string; private_key?: string };

type ClaimedPush = {
  id: string;
  registration_token: string;
  event_code: string;
  title: string;
  body: string;
  data: JsonRecord;
};

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
  const url = Deno.env.get("SUPABASE_URL");
  const modern = parseKeys(Deno.env.get("SUPABASE_SECRET_KEYS"));
  const key = modern.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseServiceAccount(raw: string): ServiceAccount | null {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as ServiceAccount : null;
  } catch {
    return null;
  }
}

async function accessToken(credentials: ServiceAccount): Promise<string> {
  const auth = new GoogleAuth({ credentials, scopes: [FCM_SCOPE] });
  const client = await auth.getClient();
  const result = await client.getAccessToken();
  const token = typeof result === "string" ? result : result?.token;
  if (!token) throw new Error("oauth_access_token_missing");
  return token;
}

function normalizeData(data: JsonRecord): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(key)) continue;
    if (value === null || value === undefined) continue;
    normalized[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return normalized;
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

function fcmSpecificError(payload: JsonRecord): string | null {
  const error = objectValue(payload.error);
  const details = Array.isArray(error.details) ? error.details : [];
  for (const item of details) {
    const detail = objectValue(item);
    const type = stringValue(detail["@type"]);
    if (type?.includes("google.firebase.fcm.v1.FcmError")) {
      return stringValue(detail.errorCode);
    }
  }
  return null;
}

function classifyFailure(statusCode: number, payload: JsonRecord, headers: Headers) {
  const error = objectValue(payload.error);
  const status = stringValue(error.status) ?? `HTTP_${statusCode}`;
  const message = stringValue(error.message) ?? "FCM request failed";
  const fcmCode = fcmSpecificError(payload);
  const retryAfter = retryAfterSeconds(headers);

  if (fcmCode === "UNREGISTERED" || status === "NOT_FOUND") {
    return { code: fcmCode ?? status, detail: message, retryable: false, deactivateToken: true, retryAfter: null };
  }
  if (fcmCode === "SENDER_ID_MISMATCH") {
    return { code: fcmCode, detail: message, retryable: false, deactivateToken: true, retryAfter: null };
  }
  if (status === "INVALID_ARGUMENT" && /registration token/i.test(message)) {
    return { code: fcmCode ?? status, detail: message, retryable: false, deactivateToken: true, retryAfter: null };
  }
  if (status === "QUOTA_EXCEEDED" || statusCode === 429) {
    return { code: status, detail: message, retryable: true, deactivateToken: false, retryAfter: Math.max(60, retryAfter ?? 60) };
  }
  if (status === "UNAVAILABLE" || status === "INTERNAL" || statusCode === 500 || statusCode === 503) {
    return { code: status, detail: message, retryable: true, deactivateToken: false, retryAfter };
  }
  return { code: fcmCode ?? status, detail: message, retryable: false, deactivateToken: false, retryAfter: null };
}

async function verifyWorkerSecret(candidate: string) {
  if (!candidate) return false;
  const admin = adminClient();
  const { data, error } = await admin.rpc("backend_verify_push_worker_secret", { _candidate: candidate } as never);
  return !error && data === true;
}

async function consumeRateLimit() {
  const admin = adminClient();
  const { data, error } = await admin.rpc("consume_edge_rate_limit", {
    _key: "push:fcm:worker:minute",
    _limit: 120,
    _window_seconds: 60,
  } as never);
  return !error && data === true;
}

async function markProviderUnhealthy(projectId: string | null, code: string, detail: string | null) {
  const admin = adminClient();
  await admin.rpc("backend_record_push_provider_runtime_health", {
    _provider: "fcm",
    _environment: "production",
    _project_id: projectId,
    _credentials_configured: Boolean(projectId),
    _cloud_messaging_api_enabled: false,
    _validate_only_verified: false,
    _error_code: code,
    _error_detail: detail,
  } as never);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const workerSecret = req.headers.get("x-comandiva-worker-secret")?.trim() ?? "";
  if (!(await verifyWorkerSecret(workerSecret))) return json({ ok: false, error: "unauthorized" }, 401);
  if (!(await consumeRateLimit())) return json({ ok: false, error: "rate_limited" }, 429);

  const projectId = Deno.env.get("FIREBASE_PROJECT_ID")?.trim() ?? "";
  const rawCredentials = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")?.trim() ?? "";
  const credentials = rawCredentials ? parseServiceAccount(rawCredentials) : null;
  const credentialProjectId = credentials?.project_id?.trim() ?? "";

  if (!projectId || !credentials?.client_email || !credentials?.private_key || !credentialProjectId) {
    await markProviderUnhealthy(projectId || credentialProjectId || null, "FIREBASE_CREDENTIALS_MISSING", null);
    return json({ ok: false, processed: 0, error: "FIREBASE_CREDENTIALS_MISSING" }, 503);
  }
  if (credentialProjectId !== projectId) {
    await markProviderUnhealthy(projectId, "FIREBASE_PROJECT_MISMATCH", null);
    return json({ ok: false, processed: 0, error: "FIREBASE_PROJECT_MISMATCH" }, 409);
  }

  let oauthToken: string;
  try {
    oauthToken = await accessToken(credentials);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown";
    await markProviderUnhealthy(projectId, "FCM_OAUTH_FAILED", detail);
    return json({ ok: false, processed: 0, error: "FCM_OAUTH_FAILED" }, 502);
  }

  const admin = adminClient();
  let processed = 0;
  let sent = 0;
  let failed = 0;
  let deactivatedTokens = 0;

  for (let index = 0; index < BATCH_SIZE; index += 1) {
    const claim = await admin.rpc("backend_claim_next_push_message", { _provider: "fcm" } as never);
    if (claim.error) {
      console.error("[comandiva-push-worker] claim failed", claim.error.code ?? "unknown");
      break;
    }
    if (!claim.data) break;

    const item = objectValue(claim.data) as unknown as ClaimedPush;
    const messageId = stringValue(item.id);
    const registrationToken = stringValue(item.registration_token);
    if (!messageId || !registrationToken) {
      console.error("[comandiva-push-worker] invalid claimed row");
      break;
    }

    processed += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

    try {
      const upstream = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${oauthToken}`, "content-type": "application/json" },
        body: JSON.stringify({
          message: {
            token: registrationToken,
            notification: { title: item.title, body: item.body },
            data: normalizeData(objectValue(item.data)),
            android: { priority: "high", ttl: "300s" },
          },
        }),
      });

      const payload = objectValue(await upstream.json().catch(() => ({})));
      if (upstream.ok) {
        const providerMessageId = stringValue(payload.name);
        if (!providerMessageId) {
          await admin.rpc("backend_fail_push_message", {
            _message_id: messageId,
            _error_code: "FCM_RESPONSE_MISSING_MESSAGE_ID",
            _error_detail: "FCM returned success without a message name.",
            _retryable: true,
            _retry_after_seconds: null,
            _deactivate_token: false,
          } as never);
          failed += 1;
        } else {
          await admin.rpc("backend_complete_push_message", { _message_id: messageId, _provider_message_id: providerMessageId } as never);
          sent += 1;
        }
        continue;
      }

      const classified = classifyFailure(upstream.status, payload, upstream.headers);
      await admin.rpc("backend_fail_push_message", {
        _message_id: messageId,
        _error_code: classified.code,
        _error_detail: classified.detail,
        _retryable: classified.retryable,
        _retry_after_seconds: classified.retryAfter,
        _deactivate_token: classified.deactivateToken,
      } as never);
      if (classified.deactivateToken) deactivatedTokens += 1;
      failed += 1;

      if (["UNAUTHENTICATED", "PERMISSION_DENIED"].includes(classified.code)) {
        await markProviderUnhealthy(projectId, classified.code, classified.detail);
        break;
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown";
      await admin.rpc("backend_fail_push_message", {
        _message_id: messageId,
        _error_code: "FCM_NETWORK_ERROR",
        _error_detail: detail,
        _retryable: true,
        _retry_after_seconds: null,
        _deactivate_token: false,
      } as never);
      failed += 1;
    } finally {
      clearTimeout(timer);
    }
  }

  return json({ ok: true, processed, sent, failed, deactivatedTokens });
});
