import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_BATCH = 10;
const META_TIMEOUT_MS = 12_000;

type JsonRecord = Record<string, unknown>;

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
  provider: "meta_whatsapp";
  purpose: "transactional" | "marketing";
  template_id: string;
  template_name: string;
  template_language: string;
  variables: JsonRecord;
  credential_ref: string;
  phone_number_id: string;
  waba_id: string | null;
  graph_api_version: string;
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

function bodyParameters(variables: JsonRecord): Array<{ type: "text"; text: string }> {
  const raw = variables.body_parameters;
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 20) throw new Error("invalid_body_parameters");

  return raw.map((value) => {
    if (typeof value !== "string") throw new Error("invalid_body_parameter");
    const text = value.trim();
    if (!text || text.length > 1024) throw new Error("invalid_body_parameter");
    return { type: "text" as const, text };
  });
}

function metaPayload(dispatch: PreparedDispatch): JsonRecord {
  const parameters = bodyParameters(objectValue(dispatch.variables));
  const template: JsonRecord = {
    name: dispatch.template_name,
    language: { code: dispatch.template_language },
  };
  if (parameters.length > 0) {
    template.components = [{ type: "body", parameters }];
  }
  return {
    messaging_product: "whatsapp",
    to: dispatch.recipient_e164,
    type: "template",
    template,
  };
}

function safeProviderError(raw: unknown, status: number): { code: string; message: string } {
  const root = objectValue(raw);
  const error = objectValue(root.error);
  const codeRaw = error.code;
  const code = typeof codeRaw === "number" || typeof codeRaw === "string"
    ? `META_${String(codeRaw).slice(0, 80)}`
    : `META_HTTP_${status}`;
  const messageRaw = typeof error.message === "string" ? error.message : `Meta returned HTTP ${status}`;
  return { code, message: messageRaw.slice(0, 500) };
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

async function processJob(admin: ReturnType<typeof adminClient>, job: ClaimedJob) {
  let dispatch: PreparedDispatch | null = null;

  try {
    const prepared = await admin.rpc("prepare_whatsapp_automation_job", { _job_id: job.id });
    if (prepared.error || !prepared.data) {
      await failJob(admin, job.id, null, prepared.error?.code ?? "PREPARE_FAILED", "WhatsApp dispatch validation failed.", false);
      return { jobId: job.id, status: "failed", stage: "prepare" };
    }
    dispatch = prepared.data as PreparedDispatch;

    const tokenResult = await admin.rpc("get_meta_whatsapp_access_token", {
      _store_id: dispatch.store_id,
      _credential_ref: dispatch.credential_ref,
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), META_TIMEOUT_MS);
    let upstream: Response;
    let raw: unknown = {};

    try {
      upstream = await fetch(
        `https://graph.facebook.com/${encodeURIComponent(dispatch.graph_api_version)}/${encodeURIComponent(dispatch.phone_number_id)}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenResult.data.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );
      raw = await upstream.json().catch(() => ({}));
    } catch {
      // A timeout/network failure can happen after Meta accepted the message. Retrying automatically
      // could duplicate a customer message, so this is intentionally terminal/manual.
      await failJob(admin, job.id, dispatch.message_id, "PROVIDER_RESULT_AMBIGUOUS", "Meta request ended without a reliable response; automatic retry blocked to avoid duplicates.", false);
      return { jobId: job.id, status: "failed", stage: "provider_ambiguous" };
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok) {
      const safe = safeProviderError(raw, upstream.status);
      // HTTP 429 is an explicit rejection before acceptance and is safe to retry with backoff.
      const retryable = upstream.status === 429;
      await failJob(admin, job.id, dispatch.message_id, safe.code, safe.message, retryable);
      return { jobId: job.id, status: retryable ? "retry_scheduled" : "failed", stage: "provider" };
    }

    const root = objectValue(raw);
    const messages = Array.isArray(root.messages) ? root.messages : [];
    const first = objectValue(messages[0]);
    const providerMessageId = typeof first.id === "string" ? first.id.trim() : "";
    if (!providerMessageId) {
      await failJob(admin, job.id, dispatch.message_id, "PROVIDER_RESULT_AMBIGUOUS", "Meta accepted the request without a usable message id; automatic retry blocked.", false);
      return { jobId: job.id, status: "failed", stage: "provider_response" };
    }

    const completed = await admin.rpc("complete_whatsapp_automation_job", {
      _job_id: job.id,
      _message_id: dispatch.message_id,
      _provider_message_id: providerMessageId,
    });
    if (completed.error || completed.data !== true) {
      console.error("[comandiva-whatsapp-worker] completion failed", completed.error?.code ?? "unknown");
      return { jobId: job.id, status: "needs_reconciliation", stage: "complete" };
    }

    return { jobId: job.id, status: "sent" };
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
  const configured = Boolean(Deno.env.get("COMANDIVA_WORKER_SECRET")?.trim());

  if (req.method === "GET") {
    return response(configured ? 200 : 503, {
      ok: configured,
      service: "comandiva-whatsapp-worker",
      configured,
      provider: "meta_whatsapp",
    });
  }

  if (req.method !== "POST") return response(405, { ok: false, error: "method_not_allowed" });
  if (!configured) return response(503, { ok: false, error: "worker_not_configured" });
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
