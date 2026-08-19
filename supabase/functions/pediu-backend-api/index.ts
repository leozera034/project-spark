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
const PASSWORD_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const COURIER_EMAIL_DOMAIN = "courier.pediuaqui.internal";

const slugSchema = z.string().trim().min(3).max(60).regex(/^[a-z0-9-]+$/);
const ownerPasswordSchema = z
  .string()
  .min(8)
  .max(72)
  .regex(/[A-Za-z]/)
  .regex(/[0-9]/);
const createStoreSchema = z.object({
  storeName: z.string().trim().min(3).max(80),
  slug: slugSchema,
  segment: z.string().trim().max(60).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  phone: z.string().trim().min(8).max(20),
  ownerName: z.string().trim().min(3).max(100),
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
  password: ownerPasswordSchema,
  planCode: z.enum(["essencial", "profissional", "avancado"]).default("essencial"),
});
const createCourierSchema = z.object({
  fullName: z.string().trim().min(3).max(100),
  phone: z.string().trim().min(8).max(20),
  loginIdentifier: z.string().trim().min(4).max(30).regex(/^[a-z0-9._]+$/),
  vehicle: z.enum(["moto", "carro"]),
  canAcceptDeliveries: z.boolean(),
  isActive: z.boolean(),
  idempotencyKey: z.string().min(10).max(160),
});
const resetCourierSchema = z.object({ courier_id: z.string().uuid() });
const smartDeliveryControlSchema = z.object({ storeId: z.string().uuid() });
const smartDeliveryPauseSchema = z.object({
  storeId: z.string().uuid(),
  paused: z.boolean(),
  reason: z.string().trim().max(240).nullable().optional(),
});

function allowedOrigin(req: Request): string {
  const origin = req.headers.get("origin") ?? "";
  if (origin === "https://shark-cardapio.lovable.app") return origin;
  if (/^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(origin)) return origin;
  return "https://shark-cardapio.lovable.app";
}

function clientAddress(req: Request): string | null {
  const value = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "").trim();
  if (!value || value.length > 64 || !/^[0-9a-fA-F:.]+$/.test(value)) return null;
  return value;
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

function publishableKey(): string | null {
  const modern = parseKeyDictionary(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"));
  return modern.default ?? Deno.env.get("SUPABASE_ANON_KEY") ?? null;
}

function requestHasKnownPublishableKey(req: Request): boolean {
  const supplied = req.headers.get("apikey") ?? "";
  if (!supplied) return false;
  const modern = Object.values(parseKeyDictionary(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")));
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  return modern.includes(supplied) || (Boolean(legacy) && supplied === legacy);
}

function createKeyAwareFetch(apiKey: string): typeof fetch {
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
  const modernSecrets = parseKeyDictionary(Deno.env.get("SUPABASE_SECRET_KEYS"));
  const key = modernSecrets.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("backend_configuration_missing");
  return createClient(url, key, {
    global: { fetch: createKeyAwareFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authenticatedUser(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  if (!token || token.split(".").length !== 3) return null;
  const url = Deno.env.get("SUPABASE_URL");
  const key = publishableKey();
  if (!url || !key) throw new Error("backend_configuration_missing");
  const client = createClient(url, key, {
    global: { fetch: createKeyAwareFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return data.user;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function generateTemporaryPassword(length = 14): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let value = "";
  for (const byte of bytes) value += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
  return `${value}7a`;
}

async function courierSyntheticEmail(identifier: string): Promise<string> {
  return `${(await sha256(`pediu-aqui:courier:${identifier}`)).slice(0, 32)}@${COURIER_EMAIL_DOMAIN}`;
}

async function consumeRateLimit(
  admin: ReturnType<typeof adminClient>,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await admin.rpc("consume_edge_rate_limit", {
    _key: key,
    _limit: limit,
    _window_seconds: windowSeconds,
  } as never);
  if (error || data !== true) return false;
  return true;
}

async function requireStorefrontOrderCapacity(
  admin: ReturnType<typeof adminClient>,
  args: Record<string, unknown>,
): Promise<boolean> {
  const slug = typeof args._slug === "string" ? args._slug.trim().toLowerCase() : "";
  if (!slug) return false;
  const slugKey = (await sha256(slug)).slice(0, 24);
  const [globalOk, storeOk] = await Promise.all([
    consumeRateLimit(admin, "orders:global:minute", 300, 60),
    consumeRateLimit(admin, `orders:store:${slugKey}:minute`, 30, 60),
  ]);
  return globalOk && storeOk;
}

async function runPublicRpc(req: Request, payload: Record<string, unknown>) {
  const rpc = typeof payload.rpc === "string" ? payload.rpc : "";
  if (!PUBLIC_RPCS.has(rpc)) return response(req, { ok: false, error: "rpc_not_allowed" }, 403);
  const args = payload.args && typeof payload.args === "object" ? payload.args as Record<string, unknown> : {};
  const admin = adminClient();
  if (rpc === "storefront_submit_order" && !(await requireStorefrontOrderCapacity(admin, args))) {
    return response(req, { ok: false, error: "rate_limited" }, 429);
  }
  const { data, error } = await admin.rpc(rpc, args as never);
  if (error) {
    console.error(`[pediu-backend-api] rpc failed: ${rpc} (${error.code ?? "unknown"})`);
    return response(req, { ok: false, error: "operation_failed" }, 502);
  }
  return response(req, { ok: true, data });
}

type AssetCandidate = { path: string; store_id: string };

async function filterPublicAssetPaths(
  admin: ReturnType<typeof adminClient>,
  bucket: string,
  paths: string[],
): Promise<string[]> {
  const candidates: AssetCandidate[] = [];
  if (bucket === "store-branding") {
    const [logos, covers] = await Promise.all([
      admin.from("store_settings").select("store_id,logo_path").in("logo_path", paths),
      admin.from("store_settings").select("store_id,cover_path").in("cover_path", paths),
    ]);
    if (logos.error || covers.error) throw new Error("asset_reference_lookup_failed");
    for (const row of logos.data ?? []) if (row.logo_path) candidates.push({ path: row.logo_path, store_id: row.store_id });
    for (const row of covers.data ?? []) if (row.cover_path) candidates.push({ path: row.cover_path, store_id: row.store_id });
  } else if (bucket === "store-catalog") {
    const [categories, products] = await Promise.all([
      admin.from("categories").select("store_id,image_path").in("image_path", paths).eq("is_active", true).eq("is_archived", false),
      admin.from("products").select("store_id,image_path").in("image_path", paths).eq("is_available", true).eq("is_archived", false),
    ]);
    if (categories.error || products.error) throw new Error("asset_reference_lookup_failed");
    for (const row of categories.data ?? []) if (row.image_path) candidates.push({ path: row.image_path, store_id: row.store_id });
    for (const row of products.data ?? []) if (row.image_path) candidates.push({ path: row.image_path, store_id: row.store_id });
  }
  const storeIds = Array.from(new Set(candidates.map((item) => item.store_id)));
  if (storeIds.length === 0) return [];
  const { data: activeStores, error } = await admin.from("stores").select("id").in("id", storeIds).eq("status", "ativa");
  if (error) throw new Error("asset_store_lookup_failed");
  const activeIds = new Set((activeStores ?? []).map((row) => row.id));
  const publicPaths = new Set(candidates.filter((item) => activeIds.has(item.store_id)).map((item) => item.path));
  return paths.filter((path) => publicPaths.has(path));
}

async function signPaths(req: Request, payload: Record<string, unknown>) {
  const bucket = typeof payload.bucket === "string" ? payload.bucket : "";
  if (!SIGNABLE_BUCKETS.has(bucket)) return response(req, { ok: false, error: "bucket_not_allowed" }, 403);
  const rawPaths = Array.isArray(payload.paths) ? payload.paths : [];
  const paths = Array.from(new Set(rawPaths.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter((value) => value.length > 0 && value.length <= 512 && !value.includes(".."))));
  if (paths.length > MAX_SIGN_PATHS) return response(req, { ok: false, error: "too_many_paths" }, 400);
  if (paths.length === 0) return response(req, { ok: true, data: [] });
  const admin = adminClient();
  let publicPaths: string[];
  try {
    publicPaths = await filterPublicAssetPaths(admin, bucket, paths);
  } catch {
    return response(req, { ok: false, error: "asset_validation_failed" }, 502);
  }
  if (publicPaths.length === 0) return response(req, { ok: true, data: [] });
  const requestedTtl = Number(payload.ttlSeconds ?? DEFAULT_SIGN_TTL);
  const ttl = Number.isFinite(requestedTtl) ? Math.max(60, Math.min(Math.floor(requestedTtl), MAX_SIGN_TTL)) : DEFAULT_SIGN_TTL;
  const { data, error } = await admin.storage.from(bucket).createSignedUrls(publicPaths, ttl);
  if (error || !data) return response(req, { ok: false, error: "signing_failed" }, 502);
  return response(req, { ok: true, data: data.map((item) => ({ path: item.path, signedUrl: item.signedUrl ?? null })) });
}

async function createStoreAccount(req: Request, payload: Record<string, unknown>) {
  const parsed = createStoreSchema.safeParse(payload.input);
  if (!parsed.success) return response(req, { ok: false, error: "invalid_input" }, 400);
  const input = parsed.data;
  const admin = adminClient();
  const emailKey = (await sha256(input.email)).slice(0, 24);
  const slugKey = (await sha256(input.slug)).slice(0, 24);
  const ip = clientAddress(req);
  const ipKey = ip ? (await sha256(ip)).slice(0, 24) : null;
  const checks = [
    consumeRateLimit(admin, "signup:global:minute", 10, 60),
    consumeRateLimit(admin, "signup:global:day", 250, 86400),
    consumeRateLimit(admin, `signup:email:${emailKey}:day`, 3, 86400),
    consumeRateLimit(admin, `signup:slug:${slugKey}:hour`, 5, 3600),
  ];
  if (ipKey) {
    checks.push(
      consumeRateLimit(admin, `signup:ip:${ipKey}:minute`, 5, 60),
      consumeRateLimit(admin, `signup:ip:${ipKey}:day`, 30, 86400),
    );
  }
  const limits = await Promise.all(checks);
  if (limits.some((allowed) => !allowed)) return response(req, { ok: false, error: "rate_limited" }, 429);

  const { data: availability, error: availabilityError } = await admin.rpc("check_public_store_slug", { _slug: input.slug } as never);
  if (availabilityError) return response(req, { ok: false, error: "onboarding_unavailable" }, 503);
  const slugState = availability as { available?: boolean; reason?: string | null } | null;
  if (!slugState?.available) return response(req, { ok: false, error: slugState?.reason === "em_uso" ? "slug_in_use" : "invalid_slug" }, 409);

  const idempotencyKey = await sha256(`store-onboarding:${input.email}:${input.slug}`);
  const requestHash = await sha256([input.storeName, input.slug, input.city, input.state, input.ownerName, input.email].join("|"));
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.ownerName, origin: "store_onboarding" },
  });
  if (createError || !created?.user) {
    const duplicate = /already|registered|exists/i.test(createError?.message ?? "");
    return response(req, { ok: false, error: duplicate ? "email_in_use" : "account_creation_failed" }, duplicate ? 409 : 502);
  }

  const ownerUserId = created.user.id;
  const { data: provisioned, error: provisionError } = await admin.rpc("provision_store_with_owner", {
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
  } as never);
  if (provisionError || !provisioned) {
    await admin.auth.admin.deleteUser(ownerUserId).catch(() => undefined);
    try {
      await admin.rpc("fail_store_provisioning", { _idempotency_key: idempotencyKey, _reason: provisionError?.code ?? "provision_failed" } as never);
    } catch {
      // best effort
    }
    return response(req, { ok: false, error: "provision_failed" }, 502);
  }
  const result = provisioned as { store_id: string; slug: string };
  await admin.from("stores").update({ status: "ativa" }).eq("id", result.store_id);
  return response(req, { ok: true, data: { storeId: result.store_id, slug: result.slug } });
}

async function createCourier(req: Request, payload: Record<string, unknown>) {
  const user = await authenticatedUser(req);
  if (!user) return response(req, { ok: false, error: "unauthorized" }, 401);
  const parsed = createCourierSchema.safeParse(payload.input);
  if (!parsed.success) return response(req, { ok: false, error: "invalid_input" }, 400);
  const input = parsed.data;
  const admin = adminClient();
  const { data: storeId, error: resolveError } = await admin.rpc("resolve_courier_create_store_admin", { _actor_user_id: user.id, _store_id: null } as never);
  if (resolveError || typeof storeId !== "string") return response(req, { ok: false, error: "unauthorized" }, 403);

  const syntheticEmail = await courierSyntheticEmail(input.loginIdentifier);
  const temporaryPassword = generateTemporaryPassword();
  const requestHash = await sha256([input.fullName, input.phone, input.loginIdentifier, input.vehicle, input.canAcceptDeliveries, input.isActive].join("|"));
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { role: "entregador", full_name: input.fullName },
  });
  if (authError || !authData.user) {
    const duplicate = /already|registered|exists/i.test(authError?.message ?? "");
    return response(req, { ok: false, error: duplicate ? "courier_identifier_in_use" : "courier_auth_failed" }, duplicate ? 409 : 502);
  }

  const authUserId = authData.user.id;
  const { data: provisioned, error: provisionError } = await admin.rpc("provision_store_courier_admin_v2", {
    _actor_user_id: user.id,
    _store_id: storeId,
    _auth_user_id: authUserId,
    _full_name: input.fullName,
    _phone: input.phone,
    _login_identifier: input.loginIdentifier,
    _synthetic_email: syntheticEmail,
    _vehicle: input.vehicle,
    _can_accept_deliveries: input.canAcceptDeliveries,
    _is_active: input.isActive,
    _idempotency_key: input.idempotencyKey,
    _request_hash: requestHash,
  } as never);
  if (provisionError || !provisioned) {
    await admin.auth.admin.deleteUser(authUserId).catch(() => undefined);
    try {
      await admin.rpc("fail_courier_provisioning_admin", { _store_id: storeId, _idempotency_key: input.idempotencyKey } as never);
    } catch {
      // best effort
    }
    return response(req, { ok: false, error: "courier_provision_failed" }, 502);
  }

  const result = provisioned as { courierId?: string; courier_id?: string };
  const courierId = result.courierId ?? result.courier_id;
  if (!courierId) return response(req, { ok: false, error: "courier_provision_failed" }, 502);
  return response(req, { ok: true, data: { courierId, created: true, loginIdentifier: input.loginIdentifier, temporaryPassword } });
}

async function resetCourierAccess(req: Request, payload: Record<string, unknown>) {
  const user = await authenticatedUser(req);
  if (!user) return response(req, { ok: false, error: "unauthorized" }, 401);
  const parsed = resetCourierSchema.safeParse(payload.input);
  if (!parsed.success) return response(req, { ok: false, error: "invalid_input" }, 400);
  const admin = adminClient();
  const { data: rows, error } = await admin.rpc("authorize_courier_reset", { _actor_user_id: user.id, _courier_id: parsed.data.courier_id } as never);
  const identity = Array.isArray(rows) ? rows[0] : null;
  if (error || !identity) return response(req, { ok: false, error: "unauthorized" }, 403);

  const temporaryPassword = generateTemporaryPassword();
  const { error: updateError } = await admin.auth.admin.updateUserById(identity.auth_user_id, { password: temporaryPassword });
  if (updateError) return response(req, { ok: false, error: "courier_reset_failed" }, 502);
  const { error: flagError } = await admin.from("courier_auth_identities").update({
    requires_password_change: true,
    is_login_enabled: true,
    temporary_password_issued_at: new Date().toISOString(),
  }).eq("id", identity.identity_id);
  if (flagError) return response(req, { ok: false, error: "courier_reset_failed" }, 502);
  await admin.from("audit_logs").insert({
    store_id: identity.store_id,
    actor_user_id: user.id,
    actor_kind: "loja",
    action: "courier_access_reset",
    entity: "courier_auth_identities",
    entity_id: identity.identity_id,
    context: { courier_id: parsed.data.courier_id },
  });
  return response(req, { ok: true, data: { temporaryPassword } });
}

async function getSmartDeliveryControlCenter(req: Request, payload: Record<string, unknown>) {
  const user = await authenticatedUser(req);
  if (!user) return response(req, { ok: false, error: "unauthorized" }, 401);
  const parsed = smartDeliveryControlSchema.safeParse(payload.input);
  if (!parsed.success) return response(req, { ok: false, error: "invalid_input" }, 400);
  const admin = adminClient();
  const { data, error } = await admin.rpc("backend_get_store_smart_delivery_control_center", {
    _actor_user_id: user.id,
    _store_id: parsed.data.storeId,
  } as never);
  if (error) {
    if (error.code === "42501") return response(req, { ok: false, error: "unauthorized" }, 403);
    console.error("[pediu-backend-api] Smart Delivery control read failed", error.code ?? "unknown");
    return response(req, { ok: false, error: "smart_delivery_control_unavailable" }, 502);
  }
  return response(req, { ok: true, data });
}

async function setSmartDeliveryPause(req: Request, payload: Record<string, unknown>) {
  const user = await authenticatedUser(req);
  if (!user) return response(req, { ok: false, error: "unauthorized" }, 401);
  const parsed = smartDeliveryPauseSchema.safeParse(payload.input);
  if (!parsed.success) return response(req, { ok: false, error: "invalid_input" }, 400);
  const admin = adminClient();
  const allowed = await consumeRateLimit(admin, `smart-delivery:control:${user.id}:minute`, 20, 60);
  if (!allowed) return response(req, { ok: false, error: "rate_limited" }, 429);
  const { data, error } = await admin.rpc("backend_set_store_smart_delivery_pause", {
    _actor_user_id: user.id,
    _store_id: parsed.data.storeId,
    _paused: parsed.data.paused,
    _reason: parsed.data.paused ? parsed.data.reason ?? null : null,
  } as never);
  if (error) {
    if (error.code === "42501") return response(req, { ok: false, error: "unauthorized" }, 403);
    console.error("[pediu-backend-api] Smart Delivery pause mutation failed", error.code ?? "unknown");
    return response(req, { ok: false, error: "smart_delivery_control_unavailable" }, 502);
  }
  return response(req, { ok: true, data });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return response(req, { ok: true });
  if (req.method !== "POST") return response(req, { ok: false, error: "method_not_allowed" }, 405);
  if (!requestHasKnownPublishableKey(req)) return response(req, { ok: false, error: "invalid_api_key" }, 401);
  const length = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return response(req, { ok: false, error: "payload_too_large" }, 413);

  try {
    const payload = (await req.json()) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "";
    if (action === "health") return response(req, { ok: true, data: { service: "pediu-backend-api" } });
    if (action === "rpc") return await runPublicRpc(req, payload);
    if (action === "sign_paths") return await signPaths(req, payload);
    if (action === "create_store_account") return await createStoreAccount(req, payload);
    if (action === "create_courier") return await createCourier(req, payload);
    if (action === "reset_courier_access") return await resetCourierAccess(req, payload);
    if (action === "get_smart_delivery_control_center") return await getSmartDeliveryControlCenter(req, payload);
    if (action === "set_smart_delivery_pause") return await setSmartDeliveryPause(req, payload);
    return response(req, { ok: false, error: "action_not_allowed" }, 403);
  } catch (error) {
    console.error("[pediu-backend-api] unhandled request error", error instanceof Error ? error.message : "unknown");
    return response(req, { ok: false, error: "internal_error" }, 500);
  }
});