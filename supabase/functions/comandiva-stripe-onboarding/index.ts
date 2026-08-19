import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const STRIPE_API = "https://api.stripe.com";
const APP_ORIGIN = "https://shark-cardapio.lovable.app";
const TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 32 * 1024;

type J = Record<string, unknown>;
type User = { id: string; email: string | null };

function obj(v: unknown): J { return v && typeof v === "object" && !Array.isArray(v) ? v as J : {}; }
function str(v: unknown): string | null { return typeof v === "string" && v.trim() ? v.trim() : null; }
function parseKeys(raw: string | undefined): Record<string, string> { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
function keyAwareFetch(apiKey: string): typeof fetch { return (input, init) => { const h = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined); if (init?.headers) new Headers(init.headers).forEach((v, k) => h.set(k, v)); if (apiKey.startsWith("sb_") && h.get("Authorization") === `Bearer ${apiKey}`) h.delete("Authorization"); h.set("apikey", apiKey); return fetch(input, { ...init, headers: h }); }; }
function admin() { const url = Deno.env.get("SUPABASE_URL"), modern = parseKeys(Deno.env.get("SUPABASE_SECRET_KEYS")), key = modern.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if (!url || !key) throw new Error("backend_configuration_missing"); return createClient(url, key, { global: { fetch: keyAwareFetch(key) }, auth: { persistSession: false, autoRefreshToken: false } }); }
function allowedOrigin(req: Request) { const o = req.headers.get("origin") ?? ""; return o === APP_ORIGIN || /^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(o) ? o : APP_ORIGIN; }
function json(req: Request, body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": allowedOrigin(req), "access-control-allow-headers": "content-type, authorization, apikey", "access-control-allow-methods": "POST, OPTIONS", vary: "Origin" } }); }
async function readBody(req: Request): Promise<J | null> { const len = Number(req.headers.get("content-length") ?? 0); if (Number.isFinite(len) && len > MAX_BODY_BYTES) return null; try { return obj(await req.json()); } catch { return null; } }
async function currentUser(req: Request): Promise<User | null> { const raw = req.headers.get("authorization")?.trim() ?? ""; const match = /^Bearer\s+(.+)$/i.exec(raw); if (!match) return null; const { data, error } = await admin().auth.getUser(match[1]); if (error || !data.user) return null; return { id: data.user.id, email: data.user.email?.trim().toLowerCase() || null }; }
async function authorizeManager(actorId: string, storeId: string) { const { data, error } = await admin().rpc("backend_authorize_store_manager", { _actor_user_id: actorId, _store_id: storeId } as never); return !error && data === true; }
async function rateLimit(key: string, limit: number, windowSeconds: number) { const { data, error } = await admin().rpc("consume_edge_rate_limit", { _key: key, _limit: limit, _window_seconds: windowSeconds } as never); return !error && data === true; }
function connectEnabled() { return (Deno.env.get("STRIPE_CONNECT_ENABLED") ?? "").trim().toLowerCase() === "true"; }
function form(data: Record<string, string | number | boolean | null | undefined>) { const p = new URLSearchParams(); for (const [k, v] of Object.entries(data)) if (v !== null && v !== undefined) p.set(k, String(v)); return p; }
async function stripe(path: string, init: { method?: string; data?: URLSearchParams; idempotencyKey?: string } = {}) { const sk = Deno.env.get("STRIPE_SECRET_KEY")?.trim(); if (!sk) return { ok: false, status: 503, body: { error: { message: "stripe_not_configured" } } as J }; const h = new Headers({ Authorization: `Bearer ${sk}` }); if (init.data) h.set("content-type", "application/x-www-form-urlencoded"); if (init.idempotencyKey) h.set("Idempotency-Key", init.idempotencyKey); const controller = new AbortController(), timer = setTimeout(() => controller.abort(), TIMEOUT_MS); try { const response = await fetch(`${STRIPE_API}${path}`, { method: init.method ?? "GET", headers: h, body: init.data?.toString(), signal: controller.signal }); return { ok: response.ok, status: response.status, body: obj(await response.json().catch(() => ({}))) }; } finally { clearTimeout(timer); } }

async function ensureAccount(user: User, storeId: string) {
  const a = admin();
  const existing = await a.rpc("backend_get_stripe_connect_account", { _store_id: storeId } as never);
  const current = obj(existing.data);
  const currentId = str(current.stripe_account_id);
  if (currentId) return { accountId: currentId, account: current };

  const store = await a.from("stores").select("id,name").eq("id", storeId).maybeSingle();
  if (store.error || !store.data) throw new Error("store_not_found");
  const data = form({
    country: "BR",
    email: user.email ?? undefined,
    "controller[stripe_dashboard][type]": "none",
    "capabilities[card_payments][requested]": true,
    "capabilities[transfers][requested]": true,
    "business_profile[name]": str(obj(store.data).name) ?? "Comandiva Store",
    "metadata[comandiva_store_id]": storeId,
  });
  const created = await stripe("/v1/accounts", { method: "POST", data, idempotencyKey: `comandiva-connect-${storeId}` });
  if (!created.ok) throw new Error(`stripe_account_create_${created.status}`);
  const accountId = str(created.body.id);
  if (!accountId) throw new Error("stripe_account_invalid");
  const requirements = obj(created.body.requirements);
  const saved = await a.rpc("backend_upsert_stripe_connect_account", {
    _store_id: storeId,
    _stripe_account_id: accountId,
    _country: str(created.body.country),
    _business_type: str(created.body.business_type),
    _details_submitted: created.body.details_submitted === true,
    _charges_enabled: created.body.charges_enabled === true,
    _payouts_enabled: created.body.payouts_enabled === true,
    _requirements_currently_due: Array.isArray(requirements.currently_due) ? requirements.currently_due : [],
    _metadata: { source: "stripe_onboarding", created_by: user.id },
  } as never);
  if (saved.error) throw new Error("stripe_account_mapping_failed");
  return { accountId, account: obj(saved.data) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(req, { ok: true });
  if (req.method !== "POST") return json(req, { ok: false, error: "method_not_allowed" }, 405);
  if (!connectEnabled()) return json(req, { ok: false, error: "stripe_connect_disabled" }, 503);
  const user = await currentUser(req);
  if (!user) return json(req, { ok: false, error: "unauthorized" }, 401);
  const body = await readBody(req), storeId = str(body?.storeId);
  if (!storeId || !(await authorizeManager(user.id, storeId))) return json(req, { ok: false, error: "forbidden" }, 403);
  if (!(await rateLimit(`stripe:onboarding:${user.id}:${storeId}`, 5, 600))) return json(req, { ok: false, error: "rate_limited" }, 429);

  try {
    const { accountId, account } = await ensureAccount(user, storeId);
    if (account.charges_enabled === true && account.payouts_enabled === true) return json(req, { ok: true, alreadyReady: true, accountId });
    const link = await stripe("/v1/account_links", {
      method: "POST",
      data: form({
        account: accountId,
        refresh_url: `${APP_ORIGIN}/app/loja/plano?stripe_connect=refresh`,
        return_url: `${APP_ORIGIN}/app/loja/plano?stripe_connect=return`,
        type: "account_onboarding",
      }),
      idempotencyKey: `comandiva-onboarding-${accountId}-${crypto.randomUUID()}`,
    });
    if (!link.ok) return json(req, { ok: false, error: "account_link_create_failed", upstreamStatus: link.status, providerMessage: str(obj(link.body.error).message) }, link.status >= 500 ? 502 : 409);
    const url = str(link.body.url), expiresAt = link.body.expires_at;
    if (!url) return json(req, { ok: false, error: "account_link_invalid" }, 502);
    return json(req, { ok: true, accountId, onboardingUrl: url, expiresAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "stripe_onboarding_failed";
    return json(req, { ok: false, error: message }, message === "store_not_found" ? 404 : 502);
  }
});
