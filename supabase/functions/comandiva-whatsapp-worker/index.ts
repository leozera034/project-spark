import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_BATCH = 10;
const PROVIDER_TIMEOUT_MS = 12_000;

type JsonRecord = Record<string, unknown>;
type SupportedProvider = "meta_whatsapp" | "evolution_api";

type ClaimedJob = {
  id: string;
  store_id: string;
  event_code: string;
  action_code: string;
  payload: JsonRecord;
  attempt_count: number;
  max_attempts: number;
};

type PreparedDispatch = {
  job_id: string;
  store_id: string;
  message_id: string;
  recipient_e164: string;
  provider: SupportedProvider;
  purpose: "transactional" | "marketing";
  template_id: string;
  template_name: string | null;
  template_language: string | null;
  template_body: string | null;
  variables: JsonRecord;
  credential_ref: string | null;
  phone_number_id: string | null;
  waba_id: string | null;
  graph_api_version: string | null;
  instance_name: string | null;
  attempt_count: number;
  max_attempts: number;
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

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function workerAuthorized(req: Request): boolean {
  const expected = Deno.env.get("COMANDIVA_WORKER_SECRET")?.trim() ?? "";
  if (!expected) return false;
  const supplied = req.headers.get("x-comandiva-worker-secret")?.trim() ?? "";
  return Boolean(supplied) && constantTimeEquals(supplied, expected);
}

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function bodyParameters(variables: JsonRecord): string[] {
  const raw = variables.body_parameters;
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 20) throw new Error("invalid_body_parameters");
  return raw.map((value) => {
    if (typeof value !== "string") throw new Error("invalid_body_parameter");
    const text = value.trim();
    if (!text || text.length > 1024) throw new Error("invalid_body_parameter");
    return text;
  });
}

function metaPayload(dispatch: PreparedDispatch): JsonRecord {
  const templateName = dispatch.template_name?.trim() ?? "";
  const templateLanguage = dispatch.template_language?.trim() ?? "";
  if (!templateName || !templateLanguage) throw new Error("meta_template_not_ready");
  const parameters = bodyParameters(objectValue(dispatch.variables)).map((text) => ({ type: "text", text }));
  const template: JsonRecord = {
    name: templateName,
    language: { code: templateLanguage },
  };
  if (parameters.length > 0) template.components = [{ type: "body", parameters }];
  return {
    messaging_product: "whatsapp",
    to: dispatch.recipient_e164,
    type: "template",
    template,
  };
}

function renderEvolutionText(dispatch: PreparedDispatch): string {
  const body = dispatch.template_body?.trim() ?? "";
  if (!body || body.length > 4096) throw new Error("evolution_template_body_invalid");
  const params = bodyParameters(objectValue(dispatch.variables));
  const rendered = body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_match, rawIndex: string) => {
    const index = Number(rawIndex) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= params.length) throw new Error("evolution_template_parameter_missing");
    return params[index];
  });
  if (/\{\{[^{}]+\}\}/.test(rendered)) throw new Error("evolution_template_placeholder_unresolved");
  return rendered;
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

function safeProviderError(raw: unknown, status: number, prefix: string): { code: string; message: string } {
  const root = objectValue(raw);
  const error = objectValue(root.error);
  const responseValue = root.response;
  const codeRaw = error.code ?? root.code;
  const code = typeof codeRaw === "number" || typeof codeRaw === "string"
    ? `${prefix}_${String(codeRaw).slice(0, 80)}`
    : `${prefix}_HTTP_${status}`;
  let message = typeof error.message === "string"
    ? error.message
    : typeof root.message === "string"
      ? root.message
      : typeof responseValue === "string"
        ? responseValue
        : JSON.stringify(responseValue ?? root).slice(0, 500);
  if (!message || message === "{}") message = `Provider returned HTTP ${status}`;
  return { code, message: message.slice(0, 500) };
}

async function providerFetch(url: string, init: RequestInit): Promise<{ response: Response; raw: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, { ...init, signal: controller.signal });
    const raw = await upstream.json().catch(() => ({}));
    return { response: upstream, raw };
  } finally {
    clearTimeout(timeout);
  }
}

async function failJob(
  admin: ReturnType<typeof adminClient>,
  jobId: string,
  messageId: string | null,
  code: string,
  message: string,
  retryable: boolean,
) {
  const { error } = await admin.rpc("fail_whatsapp_automation_job", {
    _job_id: jobId,
    _message_id: messageId,
    _error_code: code.slice(0, 120),
    _error_message: message.slice(0, 500),
    _retryable: retryable,
  });
  if (error) console.error("[comandiva-whatsapp-worker] fail transition error", error.code ?? "unknown");
}

async function completeJob(
  admin: ReturnType<typeof adminClient>,
  job: ClaimedJob,
  dispatch: PreparedDispatch,
  providerMessageId: string,
) {
  if (!providerMessageId || providerMessageId.length < 6) {
    await failJob(admin, job.id, dispatch.message_id, "PROVIDER_RESULT_AMBIGUOUS", "Provider accepted the request without a usable message id; automatic retry blocked.", false);
    return { jobId: job.id, status: "failed", stage: "provider_response" };
  }
  const completed = await admin.rpc("complete_whatsapp_automation_job", {
    _job_id: job.id,
    _message_id: dispatch.message_id,
    _provider_message_id: providerMessageId.slice(0, 512),
  });
  if (completed.error || completed.data !== true) {
    console.error("[comandiva-whatsapp-worker] completion failed", completed.error?.code ?? "unknown");
    return { jobId: job.id, status: "needs_reconciliation", stage: "complete" };
  }
  return { jobId: job.id, status: "sent", provider: dispatch.provider };
}

async function processMeta(
  admin: ReturnType<typeof adminClient>,
  job: ClaimedJob,
  dispatch: PreparedDispatch,
) {
  const credentialRef = dispatch.credential_ref?.trim() ?? "";
  const phoneNumberId = dispatch.phone_number_id?.trim() ?? "";
  const graphVersion = dispatch.graph_api_version?.trim() ?? "";
  if (!credentialRef || !phoneNumberId || !graphVersion) {
    await failJob(admin, job.id, dispatch.message_id, "META_CONFIGURATION_MISSING", "Meta WhatsApp provider configuration is incomplete.", false);
    return { jobId: job.id, status: "failed", stage: "configuration" };
  }

  const tokenResult = await admin.rpc("get_meta_whatsapp_access_token", {
    _store_id: dispatch.store_id,
    _credential_ref: credentialRef,
  });
  if (tokenResult.error || typeof tokenResult.data !== "string" || !tokenResult.data.trim()) {
    await failJob(admin, job.id, dispatch.message_id, tokenResult.error?.code ?? "PROVIDER_SECRET_MISSING", "Meta credential is unavailable.", false);
    return { jobId: job.id, status: "failed", stage: "credential" };
  }

  let payload: JsonRecord;
  try {
    payload = metaPayload(dispatch);
  } catch {
    await failJob(admin, job.id, dispatch.message_id, "INVALID_TEMPLATE_VARIABLES", "Template variables are invalid.", false);
    return { jobId: job.id, status: "failed", stage: "payload" };
  }

  try {
    const result = await providerFetch(
      `https://graph.facebook.com/${encodeURIComponent(graphVersion)}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenResult.data.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    if (!result.response.ok) {
      const safe = safeProviderError(result.raw, result.response.status, "META");
      const retryable = result.response.status === 429;
      const ambiguous = result.response.status >= 500;
      await failJob(admin, job.id, dispatch.message_id, ambiguous ? "PROVIDER_RESULT_AMBIGUOUS" : safe.code, safe.message, retryable && !ambiguous);
      return { jobId: job.id, status: retryable && !ambiguous ? "retry_scheduled" : "failed", stage: ambiguous ? "provider_ambiguous" : "provider" };
    }
    const root = objectValue(result.raw);
    const messages = Array.isArray(root.messages) ? root.messages : [];
    const first = objectValue(messages[0]);
    const providerMessageId = typeof first.id === "string" ? first.id.trim() : "";
    return await completeJob(admin, job, dispatch, providerMessageId);
  } catch (error) {
    await failJob(admin, job.id, dispatch.message_id, "PROVIDER_RESULT_AMBIGUOUS", error instanceof Error ? error.message : "Meta request ended without a reliable response.", false);
    return { jobId: job.id, status: "failed", stage: "provider_ambiguous" };
  }
}

function evolutionMessageId(raw: unknown): string {
  const root = objectValue(raw);
  const key = objectValue(root.key);
  const message = objectValue(root.message);
  const messageKey = objectValue(message.key);
  const candidates = [key.id, root.id, messageKey.id, root.messageId];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length >= 6) return candidate.trim();
  }
  return "";
}

function evolutionWantsTopLevelText(raw: unknown): boolean {
  const text = JSON.stringify(raw).toLowerCase();
  return text.includes("requires property") && (text.includes('property \\"text\\"') || text.includes("property 'text'") || text.includes("property text"));
}

async function processEvolution(
  admin: ReturnType<typeof adminClient>,
  job: ClaimedJob,
  dispatch: PreparedDispatch,
) {
  const config = evolutionConfig();
  const instanceName = dispatch.instance_name?.trim() ?? "";
  if (!config || !instanceName) {
    await failJob(admin, job.id, dispatch.message_id, "EVOLUTION_RUNTIME_NOT_CONFIGURED", "Evolution API runtime or instance configuration is unavailable.", false);
    return { jobId: job.id, status: "failed", stage: "configuration" };
  }

  let text: string;
  try {
    text = renderEvolutionText(dispatch);
  } catch (error) {
    await failJob(admin, job.id, dispatch.message_id, "INVALID_TEMPLATE_VARIABLES", error instanceof Error ? error.message : "Evolution message template is invalid.", false);
    return { jobId: job.id, status: "failed", stage: "payload" };
  }

  const url = `${config.baseUrl}/message/sendText/${encodeURIComponent(instanceName)}`;
  const headers = { apikey: config.apiKey, "Content-Type": "application/json", Accept: "application/json" };
  try {
    let result = await providerFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ number: dispatch.recipient_e164, textMessage: { text } }),
    });

    // Evolution 2.3.7 has a known schema mismatch where some builds reject the documented
    // textMessage shape with an explicit HTTP 400 requiring top-level text. That response is
    // an explicit rejection, so one compatibility retry cannot duplicate an accepted message.
    if (result.response.status === 400 && evolutionWantsTopLevelText(result.raw)) {
      result = await providerFetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ number: dispatch.recipient_e164, text }),
      });
    }

    if (!result.response.ok) {
      const safe = safeProviderError(result.raw, result.response.status, "EVOLUTION");
      const retryable = result.response.status === 429;
      const ambiguous = result.response.status >= 500;
      await failJob(admin, job.id, dispatch.message_id, ambiguous ? "PROVIDER_RESULT_AMBIGUOUS" : safe.code, safe.message, retryable && !ambiguous);
      return { jobId: job.id, status: retryable && !ambiguous ? "retry_scheduled" : "failed", stage: ambiguous ? "provider_ambiguous" : "provider" };
    }

    return await completeJob(admin, job, dispatch, evolutionMessageId(result.raw));
  } catch (error) {
    await failJob(admin, job.id, dispatch.message_id, "PROVIDER_RESULT_AMBIGUOUS", error instanceof Error ? error.message : "Evolution API request ended without a reliable response.", false);
    return { jobId: job.id, status: "failed", stage: "provider_ambiguous" };
  }
}

async function processJob(admin: ReturnType<typeof adminClient>, job: ClaimedJob) {
  let dispatch: PreparedDispatch | null = null;
  try {
    const prepared = await admin.rpc("prepare_whatsapp_automation_job", { _job_id: job.id });
    if (prepared.error || !prepared.data) {
      await failJob(admin, job.id, null, prepared.error?.code ?? "PREPARE_FAILED", "WhatsApp dispatch validation failed.", false);
      return { jobId: job.id, status: "failed", stage: "prepare" };
    }
    dispatch = prepared.data as PreparedDispatch;
    if (dispatch.provider === "meta_whatsapp") return await processMeta(admin, job, dispatch);
    if (dispatch.provider === "evolution_api") return await processEvolution(admin, job, dispatch);
    await failJob(admin, job.id, dispatch.message_id, "WHATSAPP_PROVIDER_NOT_SUPPORTED_BY_WORKER", "WhatsApp provider is not supported by this worker.", false);
    return { jobId: job.id, status: "failed", stage: "provider_selection" };
  } catch (error) {
    await failJob(
      admin,
      job.id,
      dispatch?.message_id ?? null,
      "WORKER_UNHANDLED",
      error instanceof Error ? error.message : "Unhandled worker error.",
      false,
    );
    return { jobId: job.id, status: "failed", stage: "unhandled" };
  }
}

Deno.serve(async (req: Request) => {
  const workerConfigured = Boolean(Deno.env.get("COMANDIVA_WORKER_SECRET")?.trim());
  const evolutionConfigured = evolutionConfig() !== null;

  if (req.method === "GET") {
    return response(workerConfigured ? 200 : 503, {
      ok: workerConfigured,
      service: "comandiva-whatsapp-worker",
      workerConfigured,
      providers: {
        meta_whatsapp: true,
        evolution_api: evolutionConfigured,
      },
    });
  }

  if (req.method !== "POST") return response(405, { ok: false, error: "method_not_allowed" });
  if (!workerConfigured) return response(503, { ok: false, error: "worker_not_configured" });
  if (!workerAuthorized(req)) return response(401, { ok: false, error: "unauthorized" });

  const length = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return response(413, { ok: false, error: "payload_too_large" });

  let input: JsonRecord = {};
  try {
    input = objectValue(await req.json());
  } catch {
    return response(400, { ok: false, error: "invalid_json" });
  }

  const requested = Number(input.limit ?? 5);
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(Math.floor(requested), MAX_BATCH)) : 5;
  const workerId = `edge:${crypto.randomUUID()}`;
  const admin = adminClient();

  const claim = await admin.rpc("claim_whatsapp_automation_jobs", {
    _worker_id: workerId,
    _limit: limit,
  });
  if (claim.error) {
    console.error("[comandiva-whatsapp-worker] claim failed", claim.error.code ?? "unknown");
    return response(500, { ok: false, error: "claim_failed" });
  }

  const jobs = (Array.isArray(claim.data) ? claim.data : []) as ClaimedJob[];
  const results = [];
  for (const job of jobs) results.push(await processJob(admin, job));

  return response(200, {
    ok: true,
    claimed: jobs.length,
    results,
  });
});
