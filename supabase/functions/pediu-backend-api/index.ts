import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { z } from "npm:zod@3.24.2";

const PUBLIC_RPCS = new Set([
  "check_public_store_slug",
  "storefront_store",
  "storefront_catalog",
  "storefront_product",
  "storefront_price",
  "storefront_fulfillment",
  "storefront_validate_fulfillment",
  "storefront_payment_methods",
  "storefront_submit_order",
  "storefront_order_tracking",
]);

const SIGNABLE_BUCKETS = new Set(["store-branding", "store-catalog"]);
const MAX_BODY_BYTES = 96 * 1024;
const MAX_SIGN_PATHS = 100;
const DEFAULT_SIGN_TTL = 30 * 60;
const MAX_SIGN_TTL = 60 * 60;

const slugSchema = z.string().trim().min(3).max(60).regex(/^[a-z0-9-]+$/);
const createStoreSchema = z.object({
  storeName: z.string().trim().min(3).max(80),
  slug: slugSchema,
  segment: z.string().trim().max(60).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  phone: z.string().trim().min(8).max(20),
  ownerName: z.string().trim().min(3).max(100),
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(72),
  planCode: z.enum(["essencial", "profissional", "avancado"]).default("essencial"),
});

function allowedOrigin(req: Request): string {
  const origin = req.headers.get("origin") ?? "";
  if (origin === "https://shark-cardapio.lovable.app") return origin;
  if (/^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(origin)) return origin;
  return "https://shark-cardapio.lovable.app";
}

function response(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": allowedOrigin(req),
      "access-control-allow-headers": "apikey, authorization, content-type, x-client-info",
      "access-control-allow-methods": "POST, OPTIONS",
      vary: "Origin",
    },
  });
}

function parseKeyDictionary(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function requestHasKnownPublishableKey(req: Request): boolean {
  const supplied = req.headers.get("apikey") ?? "";
  if (!supplied) return false;
  const modern = Object.values(parseKeyDictionary(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")));
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  return modern.includes(supplied) || (Boolean(legacy) && supplied === legacy);
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const modernSecrets = parseKeyDictionary(Deno.env.get("SUPABASE_SECRET_KEYS"));
  const key = modernSecrets.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("backend_configuration_missing");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function runPublicRpc(req: Request, payload: Record<string, unknown>) {
  const rpc = typeof payload.rpc === "string" ? payload.rpc : "";
  if (!PUBLIC_RPCS.has(rpc)) return response(req, { ok: false, error: "rpc_not_allowed" }, 403);
  const args = payload.args && typeof payload.args === "object" ? payload.args : {};
  const admin = adminClient();
  const { data, error } = await admin.rpc(rpc, args as never);
  if (error) {
    console.error(`[pediu-backend-api] rpc failed: ${rpc} (${error.code ?? "unknown"})`);
    return response(req, { ok: false, error: "operation_failed" }, 502);
  }
  return response(req, { ok: true, data });
}

async function signPaths(req: Request, payload: Record<string, unknown>) {
  const bucket = typeof payload.bucket === "string" ? payload.bucket : "";
  if (!SIGNABLE_BUCKETS.has(bucket)) {
    return response(req, { ok: false, error: "bucket_not_allowed" }, 403);
  }
  const rawPaths = Array.isArray(payload.paths) ? payload.paths : [];
  const paths = Array.from(
    new Set(
      rawPaths
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0 && value.length <= 512 && !value.includes("..")),
    ),
  );
  if (paths.length > MAX_SIGN_PATHS) {
    return response(req, { ok: false, error: "too_many_paths" }, 400);
  }
  if (paths.length === 0) return response(req, { ok: true, data: [] });
  const requestedTtl = Number(payload.ttlSeconds ?? DEFAULT_SIGN_TTL);
  const ttl = Number.isFinite(requestedTtl)
    ? Math.max(60, Math.min(Math.floor(requestedTtl), MAX_SIGN_TTL))
    : DEFAULT_SIGN_TTL;
  const admin = adminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrls(paths, ttl);
  if (error || !data) {
    console.error(`[pediu-backend-api] storage signing failed: ${bucket}`);
    return response(req, { ok: false, error: "signing_failed" }, 502);
  }
  return response(req, {
    ok: true,
    data: data.map((item) => ({ path: item.path, signedUrl: item.signedUrl ?? null })),
  });
}

async function createStoreAccount(req: Request, payload: Record<string, unknown>) {
  const parsed = createStoreSchema.safeParse(payload.input);
  if (!parsed.success) return response(req, { ok: false, error: "invalid_input" }, 400);
  const input = parsed.data;
  const admin = adminClient();
  const { data: availability, error: availabilityError } = await admin.rpc(
    "check_public_store_slug",
    { _slug: input.slug } as never,
  );
  if (availabilityError) return response(req, { ok: false, error: "onboarding_unavailable" }, 503);
  const slugState = availability as { available?: boolean; reason?: string | null } | null;
  if (!slugState?.available) {
    return response(
      req,
      { ok: false, error: slugState?.reason === "em_uso" ? "slug_in_use" : "invalid_slug" },
      409,
    );
  }

  const idempotencyKey = await sha256(`store-onboarding:${input.email}:${input.slug}`);
  const requestHash = await sha256(
    [input.storeName, input.slug, input.city, input.state, input.ownerName, input.email].join("|"),
  );
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.ownerName, origin: "store_onboarding" },
  });
  if (createError || !created?.user) {
    const duplicate = /already|registered|exists/i.test(createError?.message ?? "");
    return response(
      req,
      { ok: false, error: duplicate ? "email_in_use" : "account_creation_failed" },
      duplicate ? 409 : 502,
    );
  }

  const ownerUserId = created.user.id;
  const { data: provisioned, error: provisionError } = await admin.rpc(
    "provision_store_with_owner",
    {
      _idempotency_key: idempotencyKey,
      _request_hash: requestHash,
      _owner_user_id: ownerUserId,
      _owner_full_name: input.ownerName,
      _store_name: input.storeName,
      _slug: input.slug,
      _city: input.city,
      _state: input.state,
      _segment: input.segment ?? null,
      _phone: input.phone,
      _plan_code: input.planCode,
      _origin: "autoatendimento",
      _requested_by: null,
    } as never,
  );

  if (provisionError || !provisioned) {
    await admin.auth.admin.deleteUser(ownerUserId).catch(() => undefined);
    try {
      await admin.rpc(
        "fail_store_provisioning",
        { _idempotency_key: idempotencyKey, _reason: provisionError?.code ?? "provision_failed" } as never,
      );
    } catch {
      // Compensation logging is best-effort.
    }
    console.error(`[pediu-backend-api] store provisioning failed (${provisionError?.code ?? "unknown"})`);
    return response(req, { ok: false, error: "provision_failed" }, 502);
  }

  const result = provisioned as { store_id: string; slug: string };
  await admin.from("stores").update({ status: "ativa" }).eq("id", result.store_id);
  return response(req, { ok: true, data: { storeId: result.store_id, slug: result.slug } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return response(req, { ok: true });
  if (req.method !== "POST") return response(req, { ok: false, error: "method_not_allowed" }, 405);
  if (!requestHasKnownPublishableKey(req)) {
    return response(req, { ok: false, error: "invalid_api_key" }, 401);
  }
  const length = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return response(req, { ok: false, error: "payload_too_large" }, 413);
  }

  try {
    const payload = (await req.json()) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "";
    if (action === "health") return response(req, { ok: true, data: { service: "pediu-backend-api" } });
    if (action === "rpc") return await runPublicRpc(req, payload);
    if (action === "sign_paths") return await signPaths(req, payload);
    if (action === "create_store_account") return await createStoreAccount(req, payload);
    return response(req, { ok: false, error: "action_not_allowed" }, 403);
  } catch (error) {
    console.error(
      "[pediu-backend-api] unhandled request error",
      error instanceof Error ? error.message : "unknown",
    );
    return response(req, { ok: false, error: "internal_error" }, 500);
  }
});
