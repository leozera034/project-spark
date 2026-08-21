import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const MAX_BODY_BYTES = 32 * 1024;
const GOOGLE_TIMEOUT_MS = 15_000;
const BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ACCOUNTS_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20";

type JsonRecord = Record<string, unknown>;
type SupabaseClient = ReturnType<typeof createClient>;
type UserContext = { client: SupabaseClient; userId: string };
type GoogleRuntime = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  appReturnUrl: string;
};

type GoogleTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  token_type?: unknown;
};

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function safeString(value: unknown, max = 1024): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function validUuid(value: unknown): string | null {
  const text = safeString(value, 80) ?? "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
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

function supabaseConfig() {
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

function adminClient(): SupabaseClient {
  const { url, secret } = supabaseConfig();
  return createClient(url, secret, {
    global: { fetch: keyAwareFetch(secret) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authenticatedContext(req: Request): Promise<UserContext | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  if (!token || token.split(".").length !== 3) return null;
  const { url, publishable } = supabaseConfig();
  const client = createClient(url, publishable, {
    global: {
      fetch: keyAwareFetch(publishable),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return { client, userId: data.user.id };
}

function googleRuntime(): GoogleRuntime | null {
  const clientId = Deno.env.get("GOOGLE_BUSINESS_CLIENT_ID")?.trim() ?? "";
  const clientSecret = Deno.env.get("GOOGLE_BUSINESS_CLIENT_SECRET")?.trim() ?? "";
  const redirectUri = Deno.env.get("GOOGLE_BUSINESS_REDIRECT_URI")?.trim() ?? "";
  const appReturnUrl = Deno.env.get("GOOGLE_BUSINESS_APP_RETURN_URL")?.trim() ?? "";
  if (!clientId || !clientSecret || !redirectUri || !appReturnUrl) return null;

  try {
    const redirect = new URL(redirectUri);
    const app = new URL(appReturnUrl);
    if (redirect.protocol !== "https:" || app.protocol !== "https:") return null;
    if (redirect.username || redirect.password || app.username || app.password) return null;
    return {
      clientId,
      clientSecret,
      redirectUri: redirect.toString(),
      appReturnUrl: app.toString(),
    };
  } catch {
    return null;
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function redirectResult(runtime: GoogleRuntime, result: "connected" | "degraded" | "error", code?: string): Response {
  const target = new URL(runtime.appReturnUrl);
  target.searchParams.set("google_business", result);
  if (code) target.searchParams.set("code", code.slice(0, 100));
  return new Response(null, {
    status: 303,
    headers: {
      location: target.toString(),
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function failSession(admin: SupabaseClient, sessionId: string, code: string, message: string) {
  const { error } = await admin.rpc("fail_google_business_onboarding_session", {
    _session_id: sessionId,
    _error_code: code,
    _error_message: message,
  });
  if (error) console.error("[comandiva-google-business] fail-session", error.code ?? "unknown");
}

async function previousRefreshToken(admin: SupabaseClient, storeId: string): Promise<string | null> {
  const { data, error } = await admin.rpc("service_get_google_business_credential", { _store_id: storeId });
  if (error || !data) return null;
  const credential = objectValue(objectValue(data).credential);
  return safeString(credential.refresh_token, 4096);
}

async function probeAccounts(accessToken: string): Promise<{ healthy: boolean; count: number; error: string | null }> {
  try {
    const response = await fetchWithTimeout(GOOGLE_ACCOUNTS_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      return {
        healthy: false,
        count: 0,
        error: response.status === 403 ? "google_business_api_access_pending" : "google_business_api_unavailable",
      };
    }
    const payload = objectValue(await response.json().catch(() => ({})));
    const accounts = Array.isArray(payload.accounts) ? payload.accounts : [];
    return { healthy: true, count: accounts.length, error: null };
  } catch {
    return { healthy: false, count: 0, error: "google_business_api_unreachable" };
  }
}

async function startAction(req: Request): Promise<Response> {
  const auth = await authenticatedContext(req);
  if (!auth) return json(401, { ok: false, error: "unauthorized" });

  const runtime = googleRuntime();
  if (!runtime) return json(503, { ok: false, error: "google_business_runtime_not_configured" });

  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: "payload_too_large" });
  }

  let body: JsonRecord;
  try {
    body = objectValue(JSON.parse(raw));
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  if (safeString(body.action, 40) !== "start") return json(400, { ok: false, error: "invalid_action" });
  const storeId = validUuid(body.storeId);
  if (!storeId) return json(400, { ok: false, error: "invalid_store_id" });

  const secretBytes = new Uint8Array(32);
  crypto.getRandomValues(secretBytes);
  const stateSecret = base64Url(secretBytes);
  const stateHash = await sha256Hex(stateSecret);

  const { data, error } = await auth.client.rpc("begin_store_google_business_onboarding", {
    _store_id: storeId,
    _state_hash: stateHash,
  });
  if (error || !data) {
    if (error?.code === "42501") return json(403, { ok: false, error: "forbidden" });
    console.error("[comandiva-google-business] begin-session", error?.code ?? "unknown");
    return json(500, { ok: false, error: "google_business_onboarding_start_failed" });
  }

  const session = objectValue(data);
  const sessionId = validUuid(session.session_id);
  const expiresAt = safeString(session.expires_at, 100);
  if (!sessionId || !expiresAt) return json(500, { ok: false, error: "google_business_onboarding_start_failed" });

  const authorization = new URL(GOOGLE_AUTH_URL);
  authorization.searchParams.set("client_id", runtime.clientId);
  authorization.searchParams.set("redirect_uri", runtime.redirectUri);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("scope", BUSINESS_SCOPE);
  authorization.searchParams.set("access_type", "offline");
  authorization.searchParams.set("prompt", "consent");
  authorization.searchParams.set("include_granted_scopes", "true");
  authorization.searchParams.set("state", `${sessionId}.${stateSecret}`);

  return json(200, {
    ok: true,
    authorizationUrl: authorization.toString(),
    expiresAt,
  });
}

async function callbackAction(req: Request): Promise<Response> {
  const runtime = googleRuntime();
  if (!runtime) return json(503, { ok: false, error: "google_business_runtime_not_configured" });

  const url = new URL(req.url);
  const state = url.searchParams.get("state")?.trim() ?? "";
  const [sessionPart, secretPart, extra] = state.split(".");
  const sessionId = validUuid(sessionPart);
  if (!sessionId || !secretPart || extra || secretPart.length < 32 || secretPart.length > 128) {
    return redirectResult(runtime, "error", "invalid_oauth_state");
  }

  const admin = adminClient();
  const stateHash = await sha256Hex(secretPart);
  const { data: claimed, error: claimError } = await admin.rpc("claim_google_business_onboarding_session", {
    _session_id: sessionId,
    _state_hash: stateHash,
  });
  if (claimError || !claimed) {
    return redirectResult(runtime, "error", "oauth_state_expired_or_invalid");
  }

  const claim = objectValue(claimed);
  const storeId = validUuid(claim.store_id);
  if (!storeId) {
    await failSession(admin, sessionId, "GOOGLE_BUSINESS_STORE_INVALID", "Google Business onboarding store could not be resolved.");
    return redirectResult(runtime, "error", "store_invalid");
  }

  const oauthError = url.searchParams.get("error")?.trim() ?? "";
  if (oauthError) {
    await failSession(admin, sessionId, "GOOGLE_OAUTH_DENIED", "Google authorization was cancelled or denied.");
    return redirectResult(runtime, "error", "oauth_denied");
  }

  const code = url.searchParams.get("code")?.trim() ?? "";
  if (!code || code.length > 8192) {
    await failSession(admin, sessionId, "GOOGLE_OAUTH_CODE_MISSING", "Google authorization code was not returned.");
    return redirectResult(runtime, "error", "oauth_code_missing");
  }

  let tokenResponse: Response;
  try {
    tokenResponse = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        code,
        client_id: runtime.clientId,
        client_secret: runtime.clientSecret,
        redirect_uri: runtime.redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });
  } catch {
    await failSession(admin, sessionId, "GOOGLE_OAUTH_TOKEN_UNREACHABLE", "Google token endpoint was unreachable.");
    return redirectResult(runtime, "error", "token_exchange_unreachable");
  }

  const tokenPayload = objectValue(await tokenResponse.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!tokenResponse.ok) {
    await failSession(admin, sessionId, "GOOGLE_OAUTH_TOKEN_EXCHANGE_FAILED", "Google rejected the OAuth token exchange.");
    return redirectResult(runtime, "error", "token_exchange_failed");
  }

  const accessToken = safeString(tokenPayload.access_token, 8192);
  const expiresIn = Number(tokenPayload.expires_in);
  const tokenType = safeString(tokenPayload.token_type, 80) ?? "Bearer";
  if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 60 || expiresIn > 86_400) {
    await failSession(admin, sessionId, "GOOGLE_OAUTH_TOKEN_INVALID", "Google returned an invalid OAuth token response.");
    return redirectResult(runtime, "error", "token_response_invalid");
  }

  let refreshToken = safeString(tokenPayload.refresh_token, 8192);
  if (!refreshToken) refreshToken = await previousRefreshToken(admin, storeId);
  if (!refreshToken) {
    await failSession(admin, sessionId, "GOOGLE_OAUTH_REFRESH_TOKEN_MISSING", "Google did not return a durable refresh token.");
    return redirectResult(runtime, "error", "refresh_token_missing");
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const scopeText = safeString(tokenPayload.scope, 4096) ?? BUSINESS_SCOPE;
  const scopes = scopeText.split(/\s+/).filter(Boolean).slice(0, 32);
  if (!scopes.includes(BUSINESS_SCOPE)) {
    await failSession(admin, sessionId, "GOOGLE_BUSINESS_SCOPE_MISSING", "Google Business management scope was not granted.");
    return redirectResult(runtime, "error", "business_scope_missing");
  }

  const probe = await probeAccounts(accessToken);
  const credential = JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: tokenType,
    expires_at: expiresAt,
    scope: scopes.join(" "),
  });

  const { error: completeError } = await admin.rpc("complete_google_business_connection", {
    _session_id: sessionId,
    _credential_json: credential,
    _token_expires_at: expiresAt,
    _scopes: scopes,
    _google_user_email: null,
    _api_healthy: probe.healthy,
    _api_error: probe.error,
    _account_count: probe.count,
  });
  if (completeError) {
    console.error("[comandiva-google-business] complete-session", completeError.code ?? "unknown");
    await failSession(admin, sessionId, "GOOGLE_BUSINESS_CONNECTION_PERSIST_FAILED", "Google Business credentials could not be persisted.");
    return redirectResult(runtime, "error", "connection_persist_failed");
  }

  return redirectResult(runtime, probe.healthy ? "connected" : "degraded");
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "POST") return await startAction(req);
    if (req.method === "GET") return await callbackAction(req);
    return json(405, { ok: false, error: "method_not_allowed" });
  } catch (error) {
    console.error("[comandiva-google-business] unexpected", error instanceof Error ? error.name : "unknown");
    return json(500, { ok: false, error: "internal_error" });
  }
});
