import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const MAX_BODY_BYTES = 32 * 1024;
const PROVIDER_TIMEOUT_MS = 15_000;
const QA_BASE_URL = "https://orange-capybara-9v54pg457j7hxqv6-8080.app.github.dev";

type JsonRecord = Record<string, unknown>;
type UserContext = { client: ReturnType<typeof createClient>; userId: string };

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}
function safeString(value: unknown, max = 512): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}
function validStoreId(value: unknown): string | null {
  const id = safeString(value, 80) ?? "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : null;
}
function baseInstanceName(storeId: string) {
  return `cmdv_${storeId.replace(/-/g, "").slice(0, 32)}`;
}
function freshInstanceName(storeId: string) {
  return `cmdv_${storeId.replace(/-/g, "").slice(0, 20)}_r${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
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
function gatewayAuthorization() {
  const { secret } = supabaseConfig();
  return `Basic ${btoa(`comandiva:${secret}`)}`;
}
async function authenticatedContext(req: Request): Promise<UserContext | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token || token.split(".").length !== 3) return null;
  const { url, publishable } = supabaseConfig();
  const client = createClient(url, publishable, {
    global: { fetch: keyAwareFetch(publishable), headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user?.id ? null : { client, userId: data.user.id };
}
function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function providerFetch(storeId: string, path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Comandiva-Store-Id", storeId);
  headers.set("Authorization", gatewayAuthorization());
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  try {
    const response = await fetch(`${QA_BASE_URL}${path}`, { ...init, headers, signal: controller.signal });
    const text = await response.text();
    let data: unknown = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text.slice(0, 500) }; }
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}
function providerError(data: unknown, status: number) {
  const root = objectValue(data);
  const error = objectValue(root.error);
  return safeString(error.message, 300) ?? safeString(root.message, 300) ?? `Evolution API retornou HTTP ${status}`;
}
function stateFromPayload(data: unknown) {
  const root = objectValue(data);
  const instance = objectValue(root.instance);
  return (safeString(instance.state, 40) ?? safeString(root.state, 40) ?? "unknown").toLowerCase();
}
function qrFromPayload(data: unknown) {
  const root = objectValue(data);
  const qrcode = objectValue(root.qrcode);
  const base64 = safeString(qrcode.base64, 2_000_000) ?? safeString(root.base64, 2_000_000);
  const pairingCode = safeString(root.pairingCode, 80) ?? safeString(qrcode.pairingCode, 80);
  const rawCode = safeString(root.code, 16_000) ?? safeString(qrcode.code, 16_000);
  return { dataUrl: base64 ? (base64.startsWith("data:image/") ? base64 : `data:image/png;base64,${base64}`) : null, pairingCode, rawCode };
}
function messageIdFromPayload(data: unknown) {
  const root = objectValue(data), key = objectValue(root.key), message = objectValue(root.message), messageKey = objectValue(message.key);
  for (const candidate of [key.id, root.id, messageKey.id, root.messageId]) {
    const value = safeString(candidate, 512);
    if (value && value.length >= 6) return value;
  }
  return "";
}
async function snapshot(auth: UserContext, storeId: string) {
  const { data, error } = await auth.client.rpc("get_store_evolution_whatsapp_connection", { _store_id: storeId });
  return error || !data ? null : objectValue(data);
}
async function persistState(storeId: string, instanceName: string, state: string, phone: string | null, lastError: string | null = null) {
  const { error } = await adminClient().rpc("backend_mark_evolution_whatsapp_state", {
    _store_id: storeId, _instance_name: instanceName, _state: state, _display_phone_number: phone, _last_error: lastError,
  });
  if (error) console.error("persist-state", error.code ?? "unknown");
}
async function instanceInfo(storeId: string, instanceName: string) {
  const query = new URLSearchParams({ instanceName }).toString();
  const result = await providerFetch(storeId, `/instance/fetchInstances?${query}`, { method: "GET" });
  if (!result.ok) return null;
  const rows = Array.isArray(result.data) ? result.data : [result.data];
  for (const value of rows) {
    const row = objectValue(value);
    const name = safeString(row.name, 100) ?? safeString(objectValue(row.instance).instanceName, 100);
    if (!name || name === instanceName) return row;
  }
  return null;
}
function phoneFromInfo(info: JsonRecord | null) {
  if (!info) return null;
  const nested = objectValue(info.instance);
  const jid = safeString(info.ownerJid, 120) ?? safeString(nested.ownerJid, 120);
  const digits = jid?.split("@")[0]?.replace(/\D/g, "") ?? "";
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}
function disconnectionReason(info: JsonRecord | null) {
  if (!info) return { code: null as number | null, deviceRemoved: false };
  const rawCode = info.disconnectionReasonCode;
  const code = typeof rawCode === "number" ? rawCode : Number(rawCode);
  const rawObject = safeString(info.disconnectionObject, 4000) ?? JSON.stringify(info.disconnectionObject ?? {});
  return { code: Number.isFinite(code) ? code : null, deviceRemoved: /device_removed/i.test(rawObject) || /"type"\s*:\s*"device_removed"/i.test(rawObject) };
}
function createPayload(instanceName: string) {
  return { instanceName, integration: "WHATSAPP-BAILEYS", qrcode: true, rejectCall: true, groupsIgnore: true, alwaysOnline: false, readMessages: false, readStatus: false };
}
async function deleteInstance(storeId: string, instanceName: string) {
  const result = await providerFetch(storeId, `/instance/delete/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
  return result.ok || result.status === 404;
}
async function createQr(storeId: string, instanceName: string) {
  const created = await providerFetch(storeId, "/instance/create", { method: "POST", body: JSON.stringify(createPayload(instanceName)) });
  if (!created.ok) return { ok: false as const, error: providerError(created.data, created.status) };
  let qr = qrFromPayload(created.data);
  if (!qr.dataUrl && !qr.pairingCode && !qr.rawCode) {
    const connected = await providerFetch(storeId, `/instance/connect/${encodeURIComponent(instanceName)}`, { method: "GET" });
    if (!connected.ok) return { ok: false as const, error: providerError(connected.data, connected.status) };
    qr = qrFromPayload(connected.data);
  }
  return { ok: true as const, qr };
}
async function recreateForPairing(storeId: string, oldInstanceName: string) {
  await deleteInstance(storeId, oldInstanceName);
  const instanceName = freshInstanceName(storeId);
  const result = await createQr(storeId, instanceName);
  if (!result.ok) {
    await persistState(storeId, instanceName, "degraded", null, result.error);
    return { ok: false as const, error: result.error };
  }
  await persistState(storeId, instanceName, "connecting", null);
  return { ok: true as const, instanceName, qr: result.qr };
}
async function connectExisting(storeId: string, instanceName: string) {
  const result = await providerFetch(storeId, `/instance/connect/${encodeURIComponent(instanceName)}`, { method: "GET" });
  if (!result.ok) return { ok: false as const, error: providerError(result.data, result.status) };
  return { ok: true as const, qr: qrFromPayload(result.data) };
}

async function statusAction(req: Request, storeId: string) {
  const auth = await authenticatedContext(req);
  if (!auth) return json(401, { ok: false, error: "unauthorized" });
  const connection = await snapshot(auth, storeId);
  if (!connection) return json(403, { ok: false, error: "forbidden" });
  const instanceName = safeString(connection.instance_name, 100) ?? baseInstanceName(storeId);
  try {
    const current = await providerFetch(storeId, `/instance/connectionState/${encodeURIComponent(instanceName)}`, { method: "GET" });
    if (!current.ok) {
      if (current.status === 404) {
        await persistState(storeId, instanceName, "disconnected", null);
        return json(200, { ok: true, configured: true, state: "disconnected", connected: false, instanceName });
      }
      return json(502, { ok: false, error: "evolution_status_failed" });
    }
    const state = stateFromPayload(current.data);
    const info = await instanceInfo(storeId, instanceName);
    const phone = phoneFromInfo(info);
    if (state === "open" || state === "connected") {
      await persistState(storeId, instanceName, state, phone);
      return json(200, { ok: true, configured: true, state, connected: true, instanceName, displayPhoneNumber: phone });
    }
    const reason = disconnectionReason(info);
    if ((state === "close" || state === "closed" || state === "disconnected") && reason.deviceRemoved) {
      await persistState(storeId, instanceName, "disconnected", phone, "DEVICE_REMOVED");
      return json(200, { ok: true, configured: true, state: "disconnected", connected: false, instanceName, repairRequired: true, reasonCode: reason.code });
    }
    await persistState(storeId, instanceName, state, phone);
    return json(200, { ok: true, configured: true, state, connected: false, instanceName, displayPhoneNumber: phone });
  } catch {
    return json(502, { ok: false, error: "evolution_unreachable" });
  }
}

async function startAction(req: Request, storeId: string) {
  const auth = await authenticatedContext(req);
  if (!auth) return json(401, { ok: false, error: "unauthorized" });
  const connection = await snapshot(auth, storeId);
  if (!connection) return json(403, { ok: false, error: "forbidden" });
  if (connection.can_provision !== true) return json(402, { ok: false, error: "whatsapp_payment_required", connection });
  let instanceName = safeString(connection.instance_name, 100) ?? baseInstanceName(storeId);
  try {
    const current = await providerFetch(storeId, `/instance/connectionState/${encodeURIComponent(instanceName)}`, { method: "GET" });
    if (current.ok) {
      const state = stateFromPayload(current.data), info = await instanceInfo(storeId, instanceName), phone = phoneFromInfo(info);
      if (state === "open" || state === "connected") {
        await persistState(storeId, instanceName, state, phone);
        return json(200, { ok: true, configured: true, state, connected: true, instanceName, displayPhoneNumber: phone });
      }
      if (disconnectionReason(info).deviceRemoved) {
        const repaired = await recreateForPairing(storeId, instanceName);
        if (!repaired.ok) return json(502, { ok: false, error: "evolution_instance_create_failed" });
        return json(200, { ok: true, configured: true, state: "connecting", connected: false, recovered: true, instanceName: repaired.instanceName, qrCodeDataUrl: repaired.qr.dataUrl, pairingCode: repaired.qr.pairingCode, qrCode: repaired.qr.rawCode });
      }
      const existing = await connectExisting(storeId, instanceName);
      if (existing.ok && (existing.qr.dataUrl || existing.qr.pairingCode || existing.qr.rawCode)) {
        await persistState(storeId, instanceName, "connecting", null);
        return json(200, { ok: true, configured: true, state: "connecting", connected: false, instanceName, qrCodeDataUrl: existing.qr.dataUrl, pairingCode: existing.qr.pairingCode, qrCode: existing.qr.rawCode });
      }
      const recreated = await recreateForPairing(storeId, instanceName);
      if (!recreated.ok) return json(502, { ok: false, error: "evolution_qr_failed" });
      return json(200, { ok: true, configured: true, state: "connecting", connected: false, recovered: true, instanceName: recreated.instanceName, qrCodeDataUrl: recreated.qr.dataUrl, pairingCode: recreated.qr.pairingCode, qrCode: recreated.qr.rawCode });
    }
    if (current.status !== 404) return json(502, { ok: false, error: "evolution_status_failed" });
    const created = await createQr(storeId, instanceName);
    if (!created.ok) {
      const recreated = await recreateForPairing(storeId, instanceName);
      if (!recreated.ok) return json(502, { ok: false, error: "evolution_instance_create_failed" });
      instanceName = recreated.instanceName;
      await persistState(storeId, instanceName, "connecting", null);
      return json(200, { ok: true, configured: true, state: "connecting", connected: false, instanceName, qrCodeDataUrl: recreated.qr.dataUrl, pairingCode: recreated.qr.pairingCode, qrCode: recreated.qr.rawCode });
    }
    await persistState(storeId, instanceName, "connecting", null);
    return json(200, { ok: true, configured: true, state: "connecting", connected: false, instanceName, qrCodeDataUrl: created.qr.dataUrl, pairingCode: created.qr.pairingCode, qrCode: created.qr.rawCode });
  } catch (error) {
    await persistState(storeId, instanceName, "degraded", null, error instanceof Error ? error.message : "Evolution API unavailable");
    return json(502, { ok: false, error: "evolution_unreachable" });
  }
}

async function refreshQrAction(req: Request, storeId: string) {
  const auth = await authenticatedContext(req);
  if (!auth) return json(401, { ok: false, error: "unauthorized" });
  const connection = await snapshot(auth, storeId);
  if (!connection) return json(403, { ok: false, error: "forbidden" });
  if (connection.can_provision !== true) return json(402, { ok: false, error: "whatsapp_payment_required" });
  let instanceName = safeString(connection.instance_name, 100) ?? baseInstanceName(storeId);
  try {
    const info = await instanceInfo(storeId, instanceName);
    if (disconnectionReason(info).deviceRemoved) {
      const repaired = await recreateForPairing(storeId, instanceName);
      if (!repaired.ok) return json(502, { ok: false, error: "evolution_qr_failed" });
      instanceName = repaired.instanceName;
      return json(200, { ok: true, state: "connecting", connected: false, recovered: true, instanceName, qrCodeDataUrl: repaired.qr.dataUrl, pairingCode: repaired.qr.pairingCode, qrCode: repaired.qr.rawCode });
    }
    const connected = await connectExisting(storeId, instanceName);
    if (!connected.ok) {
      const repaired = await recreateForPairing(storeId, instanceName);
      if (!repaired.ok) return json(502, { ok: false, error: "evolution_qr_failed" });
      instanceName = repaired.instanceName;
      return json(200, { ok: true, state: "connecting", connected: false, recovered: true, instanceName, qrCodeDataUrl: repaired.qr.dataUrl, pairingCode: repaired.qr.pairingCode, qrCode: repaired.qr.rawCode });
    }
    await persistState(storeId, instanceName, "connecting", null);
    return json(200, { ok: true, state: "connecting", connected: false, instanceName, qrCodeDataUrl: connected.qr.dataUrl, pairingCode: connected.qr.pairingCode, qrCode: connected.qr.rawCode });
  } catch {
    return json(502, { ok: false, error: "evolution_unreachable" });
  }
}

async function disconnectAction(req: Request, storeId: string) {
  const auth = await authenticatedContext(req);
  if (!auth) return json(401, { ok: false, error: "unauthorized" });
  const connection = await snapshot(auth, storeId);
  if (!connection) return json(403, { ok: false, error: "forbidden" });
  const instanceName = safeString(connection.instance_name, 100) ?? baseInstanceName(storeId);
  try {
    await providerFetch(storeId, `/instance/logout/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
    await deleteInstance(storeId, instanceName);
    await persistState(storeId, instanceName, "disconnected", null);
    return json(200, { ok: true, connected: false, state: "disconnected", instanceName });
  } catch {
    return json(502, { ok: false, error: "evolution_unreachable" });
  }
}

async function sendManualAction(req: Request, storeId: string, input: JsonRecord) {
  const auth = await authenticatedContext(req);
  if (!auth) return json(401, { ok: false, error: "unauthorized" });
  const prepared = await auth.client.rpc("prepare_evolution_manual_send", { _store_id: storeId, _phone: safeString(input.phone, 80) ?? "", _body: safeString(input.message, 4096) ?? "" });
  if (prepared.error || !prepared.data) return json(prepared.error?.code === "42501" ? 403 : 409, { ok: false, error: prepared.error?.code === "42501" ? "forbidden" : "manual_send_not_ready" });
  const data = objectValue(prepared.data), recipient = safeString(data.recipient_e164, 32) ?? "", message = safeString(data.body, 4096) ?? "", instanceName = safeString(data.instance_name, 100) ?? "";
  if (!recipient || !message || !instanceName) return json(409, { ok: false, error: "manual_send_not_ready" });
  try {
    const path = `/message/sendText/${encodeURIComponent(instanceName)}`;
    let result = await providerFetch(storeId, path, { method: "POST", body: JSON.stringify({ number: recipient, textMessage: { text: message } }) });
    if (!result.ok && result.status === 400 && JSON.stringify(result.data).toLowerCase().includes("text")) result = await providerFetch(storeId, path, { method: "POST", body: JSON.stringify({ number: recipient, text: message }) });
    if (!result.ok) return json(502, { ok: false, error: "evolution_send_failed" });
    const providerMessageId = messageIdFromPayload(result.data);
    if (!providerMessageId) return json(502, { ok: false, error: "evolution_send_ambiguous" });
    await adminClient().rpc("backend_record_evolution_manual_send", { _store_id: storeId, _recipient_e164: recipient, _body: message, _provider_message_id: providerMessageId, _actor_user_id: auth.userId });
    return json(200, { ok: true, sent: true, providerMessageId });
  } catch {
    return json(502, { ok: false, error: "evolution_unreachable" });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") return json(200, { ok: true, service: "comandiva-evolution-onboarding", configured: true, gateway: "basic-v1", recovery: "device-removed-v1" });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  const length = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json(413, { ok: false, error: "payload_too_large" });
  let input: JsonRecord;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json(413, { ok: false, error: "payload_too_large" });
    input = objectValue(JSON.parse(raw || "{}"));
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }
  const action = safeString(input.action, 40) ?? "status", storeId = validStoreId(input.storeId);
  if (!storeId) return json(400, { ok: false, error: "invalid_store_id" });
  if (action === "status") return statusAction(req, storeId);
  if (action === "start") return startAction(req, storeId);
  if (action === "refresh_qr") return refreshQrAction(req, storeId);
  if (action === "disconnect") return disconnectAction(req, storeId);
  if (action === "send_manual") return sendManualAction(req, storeId, input);
  return json(400, { ok: false, error: "invalid_action" });
});