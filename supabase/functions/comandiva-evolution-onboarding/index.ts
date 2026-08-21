import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const MAX_BODY_BYTES = 32 * 1024;
const PROVIDER_TIMEOUT_MS = 15_000;

type JsonRecord = Record<string, unknown>;
type UserContext = {
  client: ReturnType<typeof createClient>;
  userId: string;
};

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

function evolutionConfig(): { baseUrl: string; apiKey: string } | null {
  const rawBase = Deno.env.get("EVOLUTION_API_BASE_URL")?.trim() ?? "";
  const apiKey = Deno.env.get("EVOLUTION_API_KEY")?.trim() ?? "";
  if (!rawBase || !apiKey) return null;
  try {
    const url = new URL(rawBase);
    if (url.protocol !== "https:") return null;
    url.pathname = url.pathname.replace(/\/$/, "");
    url.search = "";
    url.hash = "";
    return { baseUrl: url.toString().replace(/\/$/, ""), apiKey };
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

function safeString(value: unknown, max = 512): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function validStoreId(value: unknown): string | null {
  const storeId = safeString(value, 80) ?? "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storeId)
    ? storeId
    : null;
}

function instanceNameForStore(storeId: string): string {
  return `cmdv_${storeId.replace(/-/g, "").slice(0, 32)}`;
}

async function providerFetch(
  config: { baseUrl: string; apiKey: string },
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  const headers = new Headers(init.headers);
  headers.set("apikey", config.apiKey);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

function providerError(data: unknown, status: number): string {
  const root = objectValue(data);
  const response = root.response;
  const error = objectValue(root.error);
  const candidate = safeString(error.message, 300)
    ?? safeString(root.message, 300)
    ?? (typeof response === "string" ? response.slice(0, 300) : null);
  return candidate ?? `Evolution API retornou HTTP ${status}`;
}

function stateFromPayload(data: unknown): string {
  const root = objectValue(data);
  const instance = objectValue(root.instance);
  return (safeString(instance.state, 40) ?? safeString(root.state, 40) ?? "unknown").toLowerCase();
}

function messageIdFromPayload(data: unknown): string {
  const root = objectValue(data);
  const key = objectValue(root.key);
  const message = objectValue(root.message);
  const messageKey = objectValue(message.key);
  for (const candidate of [key.id, root.id, messageKey.id, root.messageId]) {
    const value = safeString(candidate, 512);
    if (value && value.length >= 6) return value;
  }
  return "";
}

function qrFromPayload(data: unknown): { dataUrl: string | null; pairingCode: string | null; rawCode: string | null } {
  const root = objectValue(data);
  const qr = objectValue(root.qrcode);
  const base64 = safeString(qr.base64, 2_000_000) ?? safeString(root.base64, 2_000_000);
  const pairingCode = safeString(root.pairingCode, 80) ?? safeString(qr.pairingCode, 80);
  const rawCode = safeString(root.code, 16_000) ?? safeString(qr.code, 16_000);
  let dataUrl: string | null = null;
  if (base64) {
    dataUrl = base64.startsWith("data:image/") ? base64 : `data:image/png;base64,${base64}`;
  }
  return { dataUrl, pairingCode, rawCode };
}

function isAlreadyExists(data: unknown, status: number): boolean {
  if (![400, 403, 409, 422].includes(status)) return false;
  const text = JSON.stringify(data).toLowerCase();
  return text.includes("already") || text.includes("exists") || text.includes("existente") || text.includes("instance name");
}

async function connectionSnapshot(auth: UserContext, storeId: string): Promise<JsonRecord | null> {
  const { data, error } = await auth.client.rpc("get_store_evolution_whatsapp_connection", {
    _store_id: storeId,
  });
  if (error || !data) return null;
  return objectValue(data);
}

async function displayPhone(
  config: { baseUrl: string; apiKey: string },
  instanceName: string,
): Promise<string | null> {
  const query = new URLSearchParams({ instanceName }).toString();
  const result = await providerFetch(config, `/instance/fetchInstances?${query}`, { method: "GET" });
  if (!result.ok) return null;
  const rows = Array.isArray(result.data) ? result.data : [result.data];
  for (const rowValue of rows) {
    const row = objectValue(rowValue);
    const instance = objectValue(row.instance);
    const ownerJid = safeString(instance.ownerJid, 120) ?? safeString(row.ownerJid, 120);
    const number = ownerJid?.split("@")[0]?.replace(/\D/g, "") ?? "";
    if (number.length >= 8 && number.length <= 15) return `+${number}`;
  }
  return null;
}

async function persistState(
  storeId: string,
  instanceName: string,
  state: string,
  phone: string | null,
  lastError: string | null = null,
) {
  const admin = adminClient();
  const { error } = await admin.rpc("backend_mark_evolution_whatsapp_state", {
    _store_id: storeId,
    _instance_name: instanceName,
    _state: state,
    _display_phone_number: phone,
    _last_error: lastError,
  });
  if (error) console.error("[comandiva-evolution-onboarding] persist-state", error.code ?? "unknown");
}

async function statusAction(req: Request, storeId: string) {
  const auth = await authenticatedContext(req);
  if (!auth) return json(401, { ok: false, error: "unauthorized" });
  const snapshot = await connectionSnapshot(auth, storeId);
  if (!snapshot) return json(403, { ok: false, error: "forbidden" });

  const config = evolutionConfig();
  if (!config) {
    return json(503, {
      ok: false,
      error: "evolution_runtime_not_configured",
      configured: false,
      connection: snapshot,
    });
  }

  const instanceName = safeString(snapshot.instance_name, 80) ?? instanceNameForStore(storeId);
  try {
    const result = await providerFetch(config, `/instance/connectionState/${encodeURIComponent(instanceName)}`, { method: "GET" });
    if (!result.ok) {
      if (result.status === 404) {
        await persistState(storeId, instanceName, "disconnected", null);
        return json(200, { ok: true, configured: true, state: "disconnected", connected: false, instanceName, connection: snapshot });
      }
      return json(502, { ok: false, error: "evolution_status_failed" });
    }
    const state = stateFromPayload(result.data);
    const connected = state === "open" || state === "connected";
    const phone = connected ? await displayPhone(config, instanceName) : null;
    await persistState(storeId, instanceName, state, phone);
    return json(200, { ok: true, configured: true, state, connected, instanceName, displayPhoneNumber: phone, connection: snapshot });
  } catch (error) {
    return json(502, { ok: false, error: "evolution_unreachable", message: error instanceof Error ? error.message : undefined });
  }
}

async function startAction(req: Request, storeId: string) {
  const auth = await authenticatedContext(req);
  if (!auth) return json(401, { ok: false, error: "unauthorized" });
  const snapshot = await connectionSnapshot(auth, storeId);
  if (!snapshot) return json(403, { ok: false, error: "forbidden" });
  if (snapshot.can_provision !== true) {
    return json(402, { ok: false, error: "whatsapp_payment_required", connection: snapshot });
  }

  const config = evolutionConfig();
  if (!config) return json(503, { ok: false, error: "evolution_runtime_not_configured", configured: false });
  const instanceName = safeString(snapshot.instance_name, 80) ?? instanceNameForStore(storeId);

  try {
    const current = await providerFetch(config, `/instance/connectionState/${encodeURIComponent(instanceName)}`, { method: "GET" });
    if (current.ok) {
      const state = stateFromPayload(current.data);
      if (state === "open" || state === "connected") {
        const phone = await displayPhone(config, instanceName);
        await persistState(storeId, instanceName, state, phone);
        return json(200, { ok: true, configured: true, state, connected: true, instanceName, displayPhoneNumber: phone });
      }
    }

    const created = await providerFetch(config, "/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        rejectCall: true,
        groupsIgnore: true,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
      }),
    });

    if (!created.ok && !isAlreadyExists(created.data, created.status)) {
      const message = providerError(created.data, created.status);
      await persistState(storeId, instanceName, "degraded", null, message);
      return json(502, { ok: false, error: "evolution_instance_create_failed" });
    }

    let qr = qrFromPayload(created.data);
    if (!qr.dataUrl && !qr.pairingCode && !qr.rawCode) {
      const connect = await providerFetch(config, `/instance/connect/${encodeURIComponent(instanceName)}`, { method: "GET" });
      if (!connect.ok) {
        const message = providerError(connect.data, connect.status);
        await persistState(storeId, instanceName, "degraded", null, message);
        return json(502, { ok: false, error: "evolution_qr_failed" });
      }
      qr = qrFromPayload(connect.data);
    }

    await persistState(storeId, instanceName, "connecting", null);
    return json(200, {
      ok: true,
      configured: true,
      state: "connecting",
      connected: false,
      instanceName,
      qrCodeDataUrl: qr.dataUrl,
      pairingCode: qr.pairingCode,
      qrCode: qr.rawCode,
    });
  } catch (error) {
    await persistState(storeId, instanceName, "degraded", null, error instanceof Error ? error.message : "Evolution API unavailable");
    return json(502, { ok: false, error: "evolution_unreachable" });
  }
}

async function refreshQrAction(req: Request, storeId: string) {
  const auth = await authenticatedContext(req);
  if (!auth) return json(401, { ok: false, error: "unauthorized" });
  const snapshot = await connectionSnapshot(auth, storeId);
  if (!snapshot) return json(403, { ok: false, error: "forbidden" });
  if (snapshot.can_provision !== true) return json(402, { ok: false, error: "whatsapp_payment_required" });
  const config = evolutionConfig();
  if (!config) return json(503, { ok: false, error: "evolution_runtime_not_configured" });
  const instanceName = safeString(snapshot.instance_name, 80) ?? instanceNameForStore(storeId);
  try {
    const connect = await providerFetch(config, `/instance/connect/${encodeURIComponent(instanceName)}`, { method: "GET" });
    if (!connect.ok) return json(502, { ok: false, error: "evolution_qr_failed" });
    const qr = qrFromPayload(connect.data);
    await persistState(storeId, instanceName, "connecting", null);
    return json(200, { ok: true, connected: false, state: "connecting", instanceName, qrCodeDataUrl: qr.dataUrl, pairingCode: qr.pairingCode, qrCode: qr.rawCode });
  } catch {
    return json(502, { ok: false, error: "evolution_unreachable" });
  }
}

async function disconnectAction(req: Request, storeId: string) {
  const auth = await authenticatedContext(req);
  if (!auth) return json(401, { ok: false, error: "unauthorized" });
  const snapshot = await connectionSnapshot(auth, storeId);
  if (!snapshot) return json(403, { ok: false, error: "forbidden" });
  const config = evolutionConfig();
  if (!config) return json(503, { ok: false, error: "evolution_runtime_not_configured" });
  const instanceName = safeString(snapshot.instance_name, 80) ?? instanceNameForStore(storeId);
  try {
    const result = await providerFetch(config, `/instance/logout/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
    if (!result.ok && result.status !== 404) return json(502, { ok: false, error: "evolution_disconnect_failed" });
    await persistState(storeId, instanceName, "disconnected", null);
    return json(200, { ok: true, connected: false, state: "disconnected", instanceName });
  } catch {
    return json(502, { ok: false, error: "evolution_unreachable" });
  }
}

async function sendManualAction(req: Request, storeId: string, input: JsonRecord) {
  const auth = await authenticatedContext(req);
  if (!auth) return json(401, { ok: false, error: "unauthorized" });
  const phone = safeString(input.phone, 80) ?? "";
  const body = safeString(input.message, 4096) ?? "";
  const prepared = await auth.client.rpc("prepare_evolution_manual_send", {
    _store_id: storeId,
    _phone: phone,
    _body: body,
  });
  if (prepared.error || !prepared.data) {
    const code = prepared.error?.code === "42501" ? "forbidden" : "manual_send_not_ready";
    return json(code === "forbidden" ? 403 : 409, { ok: false, error: code });
  }
  const data = objectValue(prepared.data);
  const recipient = safeString(data.recipient_e164, 32) ?? "";
  const message = safeString(data.body, 4096) ?? "";
  const instanceName = safeString(data.instance_name, 80) ?? "";
  const config = evolutionConfig();
  if (!config) return json(503, { ok: false, error: "evolution_runtime_not_configured" });
  if (!recipient || !message || !instanceName) return json(409, { ok: false, error: "manual_send_not_ready" });

  try {
    const url = `/message/sendText/${encodeURIComponent(instanceName)}`;
    let result = await providerFetch(config, url, {
      method: "POST",
      body: JSON.stringify({ number: recipient, textMessage: { text: message } }),
    });
    if (!result.ok && result.status === 400 && JSON.stringify(result.data).toLowerCase().includes("text")) {
      result = await providerFetch(config, url, {
        method: "POST",
        body: JSON.stringify({ number: recipient, text: message }),
      });
    }
    if (!result.ok) return json(502, { ok: false, error: "evolution_send_failed" });
    const providerMessageId = messageIdFromPayload(result.data);
    if (!providerMessageId) return json(502, { ok: false, error: "evolution_send_ambiguous" });

    const admin = adminClient();
    const recorded = await admin.rpc("backend_record_evolution_manual_send", {
      _store_id: storeId,
      _recipient_e164: recipient,
      _body: message,
      _provider_message_id: providerMessageId,
      _actor_user_id: auth.userId,
    });
    if (recorded.error) console.error("[comandiva-evolution-onboarding] manual-send record", recorded.error.code ?? "unknown");
    return json(200, { ok: true, sent: true, providerMessageId });
  } catch {
    return json(502, { ok: false, error: "evolution_unreachable" });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    const configured = Boolean(evolutionConfig());
    return json(configured ? 200 : 503, {
      ok: configured,
      service: "comandiva-evolution-onboarding",
      configured,
    });
  }
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: "payload_too_large" });
  }

  let input: JsonRecord;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json(413, { ok: false, error: "payload_too_large" });
    input = objectValue(JSON.parse(raw || "{}"));
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  const action = safeString(input.action, 40) ?? "status";
  const storeId = validStoreId(input.storeId);
  if (!storeId) return json(400, { ok: false, error: "invalid_store_id" });

  if (action === "status") return await statusAction(req, storeId);
  if (action === "start") return await startAction(req, storeId);
  if (action === "refresh_qr") return await refreshQrAction(req, storeId);
  if (action === "disconnect") return await disconnectAction(req, storeId);
  if (action === "send_manual") return await sendManualAction(req, storeId, input);
  return json(400, { ok: false, error: "invalid_action" });
});
