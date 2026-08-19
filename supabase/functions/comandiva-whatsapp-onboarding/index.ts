import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const MAX_BODY_BYTES = 32 * 1024;
const META_TIMEOUT_MS = 15_000;

type JsonRecord = Record<string, unknown>;

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
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

function adminClient() {
  const { url, secret } = supabaseConfig();
  return createClient(url, secret, {
    global: { fetch: keyAwareFetch(secret) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authenticatedContext(req: Request) {
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

function metaConfig() {
  const appId = Deno.env.get("META_WHATSAPP_APP_ID")?.trim() ?? "";
  const appSecret = Deno.env.get("META_WHATSAPP_APP_SECRET")?.trim() ?? "";
  const configId = Deno.env.get("META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID")?.trim() ?? "";
  const graphVersion = Deno.env.get("META_WHATSAPP_GRAPH_API_VERSION")?.trim() ?? "";
  const configured = Boolean(
    /^\d{5,40}$/.test(appId)
      && /^\d{5,40}$/.test(configId)
      && /^v\d{1,3}\.\d{1,2}$/.test(graphVersion)
      && appSecret,
  );
  return { appId, appSecret, configId, graphVersion, configured };
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

function safeString(value: unknown, max = 512): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

async function metaFetch(
  url: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; data: JsonRecord }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), META_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const data = objectValue(await response.json().catch(() => ({})));
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

function providerError(result: { status: number; data: JsonRecord }, fallback: string) {
  const error = objectValue(result.data.error);
  const code = safeString(error.code, 80);
  const message = safeString(error.message, 500);
  return {
    code: code ? `META_${code}` : fallback,
    message: message ?? `Meta Graph API returned HTTP ${result.status}`,
  };
}

async function failSession(
  admin: ReturnType<typeof adminClient>,
  sessionId: string,
  storeId: string,
  userId: string,
  code: string,
  message: string,
) {
  const result = await admin.rpc("fail_meta_whatsapp_onboarding_session", {
    _session_id: sessionId,
    _store_id: storeId,
    _actor_user_id: userId,
    _error_code: code.slice(0, 120),
    _error_message: message.slice(0, 500),
  });
  if (result.error) {
    console.error("[comandiva-whatsapp-onboarding] fail-session transition failed", result.error.code ?? "unknown");
  }
}

async function start(req: Request, storeId: string) {
  const auth = await authenticatedContext(req);
  if (!auth) return json(401, { ok: false, error: "unauthorized" });
  const meta = metaConfig();
  if (!meta.configured) {
    return json(503, {
      ok: false,
      error: "meta_app_not_configured",
      configured: false,
    });
  }

  const { data, error } = await auth.client.rpc("begin_store_meta_whatsapp_onboarding", {
    _store_id: storeId,
  });
  if (error || !data) {
    const denied = error?.code === "42501";
    return json(denied ? 403 : 409, { ok: false, error: denied ? "forbidden" : "onboarding_unavailable" });
  }

  const session = objectValue(data);
  return json(200, {
    ok: true,
    configured: true,
    sessionId: safeString(session.session_id, 80),
    expiresAt: safeString(session.expires_at, 80),
    appId: meta.appId,
    configurationId: meta.configId,
    graphApiVersion: meta.graphVersion,
    sessionInfoVersion: "3",
  });
}

async function complete(
  req: Request,
  input: JsonRecord,
) {
  const auth = await authenticatedContext(req);
  if (!auth) return json(401, { ok: false, error: "unauthorized" });
  const meta = metaConfig();
  if (!meta.configured) return json(503, { ok: false, error: "meta_app_not_configured" });

  const storeId = safeString(input.storeId, 80) ?? "";
  const sessionId = safeString(input.sessionId, 80) ?? "";
  const code = safeString(input.code, 4096) ?? "";
  const wabaId = safeString(input.wabaId, 80) ?? "";
  const phoneNumberId = safeString(input.phoneNumberId, 80) ?? "";
  const businessId = safeString(input.businessId, 80);

  if (
    !/^[0-9a-f-]{36}$/i.test(storeId)
      || !/^[0-9a-f-]{36}$/i.test(sessionId)
      || !code
      || !/^\d{5,40}$/.test(wabaId)
      || !/^\d{5,40}$/.test(phoneNumberId)
  ) {
    return json(400, { ok: false, error: "invalid_input" });
  }

  const admin = adminClient();
  const claim = await admin.rpc("claim_meta_whatsapp_onboarding_session", {
    _session_id: sessionId,
    _store_id: storeId,
    _actor_user_id: auth.userId,
    _waba_id: wabaId,
    _phone_number_id: phoneNumberId,
    _business_id: businessId,
  });
  if (claim.error) return json(500, { ok: false, error: "session_claim_failed" });
  if (claim.data === "complete") return json(200, { ok: true, connected: true, duplicate: true });
  if (claim.data === "expired") return json(410, { ok: false, error: "onboarding_session_expired" });
  if (claim.data !== "process") return json(409, { ok: false, error: "onboarding_session_invalid" });

  let accessToken = "";
  try {
    const tokenBody = new URLSearchParams({
      client_id: meta.appId,
      client_secret: meta.appSecret,
      code,
    });
    const exchanged = await metaFetch(
      `https://graph.facebook.com/${encodeURIComponent(meta.graphVersion)}/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody.toString(),
      },
    );
    accessToken = safeString(exchanged.data.access_token, 8192) ?? "";
    if (!exchanged.ok || !accessToken) {
      const safe = providerError(exchanged, "META_CODE_EXCHANGE_FAILED");
      await failSession(admin, sessionId, storeId, auth.userId, safe.code, safe.message);
      return json(502, { ok: false, error: "meta_code_exchange_failed" });
    }

    const appToken = `${meta.appId}|${meta.appSecret}`;
    const debugUrl = new URL(`https://graph.facebook.com/${meta.graphVersion}/debug_token`);
    debugUrl.searchParams.set("input_token", accessToken);
    debugUrl.searchParams.set("access_token", appToken);
    const debugged = await metaFetch(debugUrl.toString(), { method: "GET" });
    const debugData = objectValue(debugged.data.data);
    if (!debugged.ok || debugData.is_valid !== true || safeString(debugData.app_id, 80) !== meta.appId) {
      await failSession(admin, sessionId, storeId, auth.userId, "META_TOKEN_INVALID", "Meta returned an invalid integration token.");
      return json(502, { ok: false, error: "meta_token_invalid" });
    }

    const expirySeconds = Number(debugData.expires_at ?? 0);
    const tokenExpiresAt = Number.isFinite(expirySeconds) && expirySeconds > 0
      ? new Date(expirySeconds * 1000).toISOString()
      : null;

    const waba = await metaFetch(
      `https://graph.facebook.com/${meta.graphVersion}/${encodeURIComponent(wabaId)}?fields=id,name`,
      { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!waba.ok || safeString(waba.data.id, 80) !== wabaId) {
      const safe = providerError(waba, "META_WABA_ACCESS_DENIED");
      await failSession(admin, sessionId, storeId, auth.userId, safe.code, safe.message);
      return json(502, { ok: false, error: "meta_waba_access_denied" });
    }

    const phonesUrl = new URL(`https://graph.facebook.com/${meta.graphVersion}/${encodeURIComponent(wabaId)}/phone_numbers`);
    phonesUrl.searchParams.set("fields", "id,display_phone_number,verified_name,quality_rating");
    phonesUrl.searchParams.set("limit", "100");
    const phones = await metaFetch(
      phonesUrl.toString(),
      { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const phoneRows = Array.isArray(phones.data.data) ? phones.data.data.map(objectValue) : [];
    const phone = phoneRows.find((row) => safeString(row.id, 80) === phoneNumberId);
    if (!phones.ok || !phone) {
      const safe = providerError(phones, "META_PHONE_NUMBER_ACCESS_DENIED");
      await failSession(admin, sessionId, storeId, auth.userId, safe.code, safe.message);
      return json(502, { ok: false, error: "meta_phone_number_access_denied" });
    }

    const subscribed = await metaFetch(
      `https://graph.facebook.com/${meta.graphVersion}/${encodeURIComponent(wabaId)}/subscribed_apps`,
      { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!subscribed.ok || subscribed.data.success !== true) {
      const safe = providerError(subscribed, "META_WEBHOOK_SUBSCRIPTION_FAILED");
      await failSession(admin, sessionId, storeId, auth.userId, safe.code, safe.message);
      return json(502, { ok: false, error: "meta_webhook_subscription_failed" });
    }

    const templatesUrl = new URL(`https://graph.facebook.com/${meta.graphVersion}/${encodeURIComponent(wabaId)}/message_templates`);
    templatesUrl.searchParams.set("fields", "id,name,status,category,language");
    templatesUrl.searchParams.set("limit", "100");
    const templates = await metaFetch(
      templatesUrl.toString(),
      { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const templateCount = templates.ok && Array.isArray(templates.data.data) ? templates.data.data.length : 0;

    const completed = await admin.rpc("complete_meta_whatsapp_connection", {
      _session_id: sessionId,
      _store_id: storeId,
      _actor_user_id: auth.userId,
      _access_token: accessToken,
      _waba_id: wabaId,
      _phone_number_id: phoneNumberId,
      _business_id: businessId,
      _display_phone_number: safeString(phone.display_phone_number, 120),
      _verified_name: safeString(phone.verified_name, 200),
      _quality_rating: safeString(phone.quality_rating, 80),
      _graph_api_version: meta.graphVersion,
      _webhook_subscribed: true,
      _template_count: templateCount,
      _token_expires_at: tokenExpiresAt,
    });
    if (completed.error || completed.data !== true) {
      await failSession(admin, sessionId, storeId, auth.userId, "META_CONNECTION_PERSIST_FAILED", "Meta connection could not be persisted.");
      return json(500, { ok: false, error: "connection_persist_failed" });
    }

    return json(200, {
      ok: true,
      connected: true,
      wabaId,
      phoneNumberId,
      displayPhoneNumber: safeString(phone.display_phone_number, 120),
      verifiedName: safeString(phone.verified_name, 200),
      qualityRating: safeString(phone.quality_rating, 80),
      webhookSubscribed: true,
      templateCount,
    });
  } catch (error) {
    await failSession(
      admin,
      sessionId,
      storeId,
      auth.userId,
      "META_PROVIDER_UNREACHABLE",
      error instanceof Error ? error.message : "Meta onboarding request failed.",
    );
    return json(502, { ok: false, error: "meta_provider_unreachable" });
  } finally {
    accessToken = "";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    const meta = metaConfig();
    return json(meta.configured ? 200 : 503, {
      ok: meta.configured,
      service: "comandiva-whatsapp-onboarding",
      configured: meta.configured,
    });
  }

  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  const length = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json(413, { ok: false, error: "payload_too_large" });

  let input: JsonRecord;
  try {
    input = objectValue(await req.json());
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  const action = safeString(input.action, 40) ?? "";
  const storeId = safeString(input.storeId, 80) ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return json(400, { ok: false, error: "invalid_store" });

  if (action === "start") return start(req, storeId);
  if (action === "complete") return complete(req, input);
  return json(403, { ok: false, error: "action_not_allowed" });
});
