import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { GoogleAuth } from "npm:google-auth-library@9.15.1";

const PROVIDER = "fcm";
const ENVIRONMENT = "production";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const TIMEOUT_MS = 10_000;

type JsonRecord = Record<string, unknown>;

type ServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
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

async function persist(input: {
  projectId: string | null;
  credentialsConfigured: boolean;
  apiEnabled: boolean;
  validateOnlyVerified: boolean;
  errorCode: string | null;
  errorDetail: string | null;
}) {
  const admin = adminClient();
  const { data, error } = await admin.rpc("backend_record_push_provider_runtime_health", {
    _provider: PROVIDER,
    _environment: ENVIRONMENT,
    _project_id: input.projectId,
    _credentials_configured: input.credentialsConfigured,
    _cloud_messaging_api_enabled: input.apiEnabled,
    _validate_only_verified: input.validateOnlyVerified,
    _error_code: input.errorCode,
    _error_detail: input.errorDetail,
  } as never);
  if (error) {
    console.error("[comandiva-push-readiness] persist failed", error.code ?? "unknown");
    return null;
  }
  return objectValue(data);
}

async function consumeRateLimit() {
  const admin = adminClient();
  const { data, error } = await admin.rpc("consume_edge_rate_limit", {
    _key: "push:fcm:readiness:minute",
    _limit: 20,
    _window_seconds: 60,
  } as never);
  return !error && data === true;
}

async function accessToken(credentials: ServiceAccount): Promise<string> {
  const auth = new GoogleAuth({ credentials, scopes: [FCM_SCOPE] });
  const client = await auth.getClient();
  const tokenResult = await client.getAccessToken();
  const token = typeof tokenResult === "string" ? tokenResult : tokenResult?.token;
  if (!token) throw new Error("oauth_access_token_missing");
  return token;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST" && req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!(await consumeRateLimit())) return json({ ok: false, error: "rate_limited" }, 429);

  const configuredProjectId = Deno.env.get("FIREBASE_PROJECT_ID")?.trim() ?? "";
  const rawCredentials = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")?.trim() ?? "";
  const credentials = rawCredentials ? parseServiceAccount(rawCredentials) : null;
  const credentialProjectId = credentials?.project_id?.trim() ?? "";
  const credentialsComplete = Boolean(credentials?.client_email && credentials?.private_key && credentialProjectId);

  if (!configuredProjectId || !credentialsComplete) {
    await persist({
      projectId: configuredProjectId || credentialProjectId || null,
      credentialsConfigured: false,
      apiEnabled: false,
      validateOnlyVerified: false,
      errorCode: !configuredProjectId ? "FIREBASE_PROJECT_ID_MISSING" : "FIREBASE_CREDENTIALS_MISSING",
      errorDetail: null,
    });
    return json({
      ok: false,
      provider: PROVIDER,
      projectId: configuredProjectId || credentialProjectId || null,
      credentialsConfigured: false,
      cloudMessagingApiEnabled: false,
      validateOnlyVerified: false,
      readyForSend: false,
      error: !configuredProjectId ? "FIREBASE_PROJECT_ID_MISSING" : "FIREBASE_CREDENTIALS_MISSING",
    }, 503);
  }

  if (credentialProjectId !== configuredProjectId) {
    await persist({
      projectId: configuredProjectId,
      credentialsConfigured: true,
      apiEnabled: false,
      validateOnlyVerified: false,
      errorCode: "FIREBASE_PROJECT_MISMATCH",
      errorDetail: null,
    });
    return json({ ok: false, provider: PROVIDER, projectId: configuredProjectId, readyForSend: false, error: "FIREBASE_PROJECT_MISMATCH" }, 409);
  }

  try {
    const token = await accessToken(credentials!);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let upstream: Response;
    try {
      upstream = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(configuredProjectId)}/messages:send`, {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          validate_only: true,
          message: {
            topic: "comandiva-readiness-probe",
            data: { probe: "validate-only" },
          },
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    const payload = objectValue(await upstream.json().catch(() => ({})));
    if (!upstream.ok) {
      const error = objectValue(payload.error);
      const status = stringValue(error.status) ?? `HTTP_${upstream.status}`;
      const detail = stringValue(error.message);
      const apiEnabled = !["PERMISSION_DENIED", "UNAUTHENTICATED", "NOT_FOUND"].includes(status);
      await persist({
        projectId: configuredProjectId,
        credentialsConfigured: true,
        apiEnabled,
        validateOnlyVerified: false,
        errorCode: status,
        errorDetail: detail,
      });
      return json({
        ok: false,
        provider: PROVIDER,
        projectId: configuredProjectId,
        credentialsConfigured: true,
        cloudMessagingApiEnabled: apiEnabled,
        validateOnlyVerified: false,
        readyForSend: false,
        upstreamStatus: upstream.status,
        error: status,
      }, 502);
    }

    const stored = await persist({
      projectId: configuredProjectId,
      credentialsConfigured: true,
      apiEnabled: true,
      validateOnlyVerified: true,
      errorCode: null,
      errorDetail: null,
    });

    return json({
      ok: true,
      provider: PROVIDER,
      projectId: configuredProjectId,
      credentialsConfigured: true,
      cloudMessagingApiEnabled: true,
      validateOnlyVerified: true,
      readyForSend: stored?.ready_for_send === true,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown";
    await persist({
      projectId: configuredProjectId,
      credentialsConfigured: true,
      apiEnabled: false,
      validateOnlyVerified: false,
      errorCode: "FCM_READINESS_FAILED",
      errorDetail: detail,
    });
    return json({ ok: false, provider: PROVIDER, projectId: configuredProjectId, readyForSend: false, error: "FCM_READINESS_FAILED" }, 502);
  }
});
