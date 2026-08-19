import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const MAX_BODY_BYTES = 24 * 1024;
const META_TIMEOUT_MS = 15_000;
const MAX_SYNC_PAGES = 20;

type JsonRecord = Record<string, unknown>;

type OperationContext = {
  store_id: string;
  credential_ref: string;
  waba_id: string;
  graph_api_version: string;
  template_id?: string;
  provider_template_id?: string | null;
  provider_template_name?: string;
  provider_status?: string;
  provider_language?: string;
  provider_category?: string;
  purpose?: string;
  body?: string;
  is_active?: boolean;
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

async function authenticatedUser(req: Request): Promise<string | null> {
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
  return error || !data.user?.id ? null : data.user.id;
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

function operationContext(value: unknown): OperationContext | null {
  const row = objectValue(value);
  const storeId = safeString(row.store_id, 80);
  const credentialRef = safeString(row.credential_ref, 256);
  const wabaId = safeString(row.waba_id, 80);
  const graphVersion = safeString(row.graph_api_version, 32);
  if (!storeId || !credentialRef || !wabaId || !graphVersion) return null;
  return {
    store_id: storeId,
    credential_ref: credentialRef,
    waba_id: wabaId,
    graph_api_version: graphVersion,
    template_id: safeString(row.template_id, 80) ?? undefined,
    provider_template_id: safeString(row.provider_template_id, 256),
    provider_template_name: safeString(row.provider_template_name, 512) ?? undefined,
    provider_status: safeString(row.provider_status, 40) ?? undefined,
    provider_language: safeString(row.provider_language, 40) ?? undefined,
    provider_category: safeString(row.provider_category, 40) ?? undefined,
    purpose: safeString(row.purpose, 40) ?? undefined,
    body: safeString(row.body, 4096) ?? undefined,
    is_active: row.is_active === true,
  };
}

async function metaFetch(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; data: JsonRecord }> {
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
  const subcode = safeString(error.error_subcode, 80);
  const message = safeString(error.message, 500);
  return {
    code: code ? `META_${code}${subcode ? `_${subcode}` : ""}`.slice(0, 120) : fallback,
    message: message ?? `Meta Graph API returned HTTP ${result.status}`,
  };
}

function bodyComponent(body: string): JsonRecord {
  const braces = [...body.matchAll(/\{\{([^{}]+)\}\}/g)];
  const indexes = braces.map((match) => Number(match[1]));
  if (indexes.some((value) => !Number.isInteger(value) || value <= 0 || value > 50)) {
    throw new Error("TEMPLATE_VARIABLES_INVALID");
  }
  const maxIndex = indexes.length ? Math.max(...indexes) : 0;
  const used = new Set(indexes);
  for (let index = 1; index <= maxIndex; index++) {
    if (!used.has(index)) throw new Error("TEMPLATE_VARIABLES_INVALID");
  }
  const leftover = body.replace(/\{\{\d+\}\}/g, "");
  if (leftover.includes("{{") || leftover.includes("}}")) throw new Error("TEMPLATE_VARIABLES_INVALID");

  const component: JsonRecord = { type: "BODY", text: body };
  if (maxIndex > 0) {
    component.example = {
      body_text: [Array.from({ length: maxIndex }, (_, index) => `Exemplo ${index + 1}`)],
    };
  }
  return component;
}

async function prepareContext(
  admin: ReturnType<typeof adminClient>,
  storeId: string,
  actorUserId: string,
  templateId: string | null,
): Promise<OperationContext> {
  const result = await admin.rpc("get_meta_whatsapp_template_operation_context", {
    _store_id: storeId,
    _actor_user_id: actorUserId,
    _template_id: templateId,
  });
  if (result.error) {
    const code = result.error.code === "42501" ? "forbidden" : safeString(result.error.message, 120) ?? "operation_context_failed";
    throw new Error(code);
  }
  const context = operationContext(result.data);
  if (!context) throw new Error("operation_context_invalid");
  return context;
}

async function accessToken(admin: ReturnType<typeof adminClient>, context: OperationContext): Promise<string> {
  const result = await admin.rpc("get_meta_whatsapp_access_token", {
    _store_id: context.store_id,
    _credential_ref: context.credential_ref,
  });
  const token = safeString(result.data, 8192);
  if (result.error || !token) throw new Error("provider_credential_unavailable");
  return token;
}

async function recordFailure(
  admin: ReturnType<typeof adminClient>,
  storeId: string,
  templateId: string,
  message: string,
) {
  const result = await admin.rpc("record_meta_whatsapp_template_submission_failure", {
    _store_id: storeId,
    _template_id: templateId,
    _error_message: message.slice(0, 500),
  });
  if (result.error) console.error("[comandiva-whatsapp-templates] failure persistence failed", result.error.code ?? "unknown");
}

async function recordSnapshot(
  admin: ReturnType<typeof adminClient>,
  context: OperationContext,
  remote: JsonRecord,
): Promise<boolean> {
  const templateId = safeString(remote.id, 256) ?? context.provider_template_id ?? null;
  const name = safeString(remote.name, 512) ?? context.provider_template_name ?? null;
  const language = safeString(remote.language, 40) ?? context.provider_language ?? null;
  const status = safeString(remote.status, 80) ?? "PENDING";
  const category = safeString(remote.category, 80) ?? context.provider_category ?? "UTILITY";
  if (!name || !language || !context.template_id) return false;
  const result = await admin.rpc("record_meta_whatsapp_template_submission", {
    _store_id: context.store_id,
    _template_id: context.template_id,
    _provider_template_id: templateId,
    _provider_template_name: name,
    _provider_language: language,
    _provider_status: status,
    _provider_category: category,
  });
  return !result.error && result.data === true;
}

async function fetchRemoteTemplate(accessTokenValue: string, context: OperationContext, templateId: string) {
  return metaFetch(
    `https://graph.facebook.com/${encodeURIComponent(context.graph_api_version)}/${encodeURIComponent(templateId)}?fields=id,name,status,category,language`,
    { method: "GET", headers: { Authorization: `Bearer ${accessTokenValue}` } },
  );
}

async function submit(
  admin: ReturnType<typeof adminClient>,
  actorUserId: string,
  storeId: string,
  templateId: string,
) {
  const context = await prepareContext(admin, storeId, actorUserId, templateId);
  if (!context.template_id || !context.provider_template_name || !context.provider_language || !context.provider_category || !context.body) {
    return json(409, { ok: false, error: "template_context_incomplete" });
  }
  if (!context.is_active) return json(409, { ok: false, error: "template_inactive" });

  let component: JsonRecord;
  try {
    component = bodyComponent(context.body);
  } catch {
    await recordFailure(admin, storeId, templateId, "Template variables must use sequential placeholders such as {{1}}, {{2}}.");
    return json(400, { ok: false, error: "template_variables_invalid" });
  }

  let token = "";
  try {
    token = await accessToken(admin, context);

    if (context.provider_template_id && (context.provider_status === "approved" || context.provider_status === "pending")) {
      const current = await fetchRemoteTemplate(token, context, context.provider_template_id);
      if (current.ok) {
        await recordSnapshot(admin, context, current.data);
        return json(200, {
          ok: true,
          skipped: true,
          providerTemplateId: safeString(current.data.id, 256),
          providerTemplateName: safeString(current.data.name, 512),
          status: safeString(current.data.status, 80)?.toLowerCase() ?? context.provider_status,
          category: safeString(current.data.category, 80),
        });
      }
    }

    const payload = {
      name: context.provider_template_name,
      language: context.provider_language,
      category: context.provider_category,
      components: [component],
    };

    let result: { ok: boolean; status: number; data: JsonRecord };
    if (context.provider_template_id) {
      result = await metaFetch(
        `https://graph.facebook.com/${encodeURIComponent(context.graph_api_version)}/${encodeURIComponent(context.provider_template_id)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      if (result.ok && result.data.success === true) {
        const refreshed = await fetchRemoteTemplate(token, context, context.provider_template_id);
        if (refreshed.ok) result = refreshed;
        else result = {
          ok: true,
          status: 200,
          data: {
            id: context.provider_template_id,
            name: context.provider_template_name,
            language: context.provider_language,
            status: "PENDING",
            category: context.provider_category,
          },
        };
      }
    } else {
      result = await metaFetch(
        `https://graph.facebook.com/${encodeURIComponent(context.graph_api_version)}/${encodeURIComponent(context.waba_id)}/message_templates`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      if (result.ok) {
        result.data.name = context.provider_template_name;
        result.data.language = context.provider_language;
      }
    }

    if (!result.ok) {
      const safe = providerError(result, "META_TEMPLATE_SUBMISSION_FAILED");
      await recordFailure(admin, storeId, templateId, safe.message);
      return json(422, { ok: false, error: "meta_template_submission_failed", providerCode: safe.code, message: safe.message });
    }

    if (!(await recordSnapshot(admin, context, result.data))) {
      return json(500, { ok: false, error: "template_submission_persist_failed" });
    }

    return json(200, {
      ok: true,
      providerTemplateId: safeString(result.data.id, 256) ?? context.provider_template_id,
      providerTemplateName: safeString(result.data.name, 512) ?? context.provider_template_name,
      status: safeString(result.data.status, 80)?.toLowerCase() ?? "pending",
      category: safeString(result.data.category, 80) ?? context.provider_category,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "template_submission_failed";
    await recordFailure(admin, storeId, templateId, message);
    const forbidden = message === "forbidden";
    return json(forbidden ? 403 : 409, { ok: false, error: forbidden ? "forbidden" : "template_submission_unavailable" });
  } finally {
    token = "";
  }
}

async function sync(
  admin: ReturnType<typeof adminClient>,
  actorUserId: string,
  storeId: string,
) {
  const context = await prepareContext(admin, storeId, actorUserId, null);
  let token = "";
  try {
    token = await accessToken(admin, context);
    let after: string | null = null;
    let remoteCount = 0;
    let matchedCount = 0;

    for (let page = 0; page < MAX_SYNC_PAGES; page++) {
      const url = new URL(`https://graph.facebook.com/${context.graph_api_version}/${context.waba_id}/message_templates`);
      url.searchParams.set("fields", "id,name,status,category,language");
      url.searchParams.set("limit", "100");
      if (after) url.searchParams.set("after", after);

      const result = await metaFetch(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!result.ok) {
        const safe = providerError(result, "META_TEMPLATE_SYNC_FAILED");
        return json(502, { ok: false, error: "meta_template_sync_failed", providerCode: safe.code, message: safe.message });
      }

      const rows = Array.isArray(result.data.data) ? result.data.data.map(objectValue) : [];
      remoteCount += rows.length;
      for (const remote of rows) {
        const remoteId = safeString(remote.id, 256);
        const name = safeString(remote.name, 512);
        const language = safeString(remote.language, 40);
        const status = safeString(remote.status, 80);
        const category = safeString(remote.category, 80);
        if (!name || !language || !status) continue;
        const applied = await admin.rpc("apply_meta_whatsapp_template_snapshot", {
          _waba_id: context.waba_id,
          _provider_template_id: remoteId,
          _template_name: name,
          _language: language,
          _status: status,
          _category: category,
          _reason: null,
        });
        if (!applied.error) matchedCount += Number(applied.data ?? 0);
      }

      const paging = objectValue(result.data.paging);
      const cursors = objectValue(paging.cursors);
      const nextAfter = safeString(cursors.after, 1024);
      const hasNext = Boolean(safeString(paging.next, 4096));
      if (!hasNext || !nextAfter || nextAfter === after) break;
      after = nextAfter;
    }

    const persisted = await admin.rpc("record_meta_whatsapp_template_sync", {
      _store_id: storeId,
      _template_count: remoteCount,
    });
    if (persisted.error || persisted.data !== true) return json(500, { ok: false, error: "template_sync_persist_failed" });

    return json(200, { ok: true, remoteCount, matchedCount, syncedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "template_sync_failed";
    return json(message === "forbidden" ? 403 : 409, { ok: false, error: message === "forbidden" ? "forbidden" : "template_sync_unavailable" });
  } finally {
    token = "";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") return json(200, { ok: true, service: "comandiva-whatsapp-templates" });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const length = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json(413, { ok: false, error: "payload_too_large" });

  const actorUserId = await authenticatedUser(req);
  if (!actorUserId) return json(401, { ok: false, error: "unauthorized" });

  let input: JsonRecord;
  try {
    input = objectValue(await req.json());
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  const action = safeString(input.action, 40) ?? "";
  const storeId = safeString(input.storeId, 80) ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return json(400, { ok: false, error: "invalid_store" });

  const admin = adminClient();
  if (action === "sync") return sync(admin, actorUserId, storeId);
  if (action === "submit") {
    const templateId = safeString(input.templateId, 80) ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(templateId)) return json(400, { ok: false, error: "invalid_template" });
    return submit(admin, actorUserId, storeId, templateId);
  }
  return json(403, { ok: false, error: "action_not_allowed" });
});
