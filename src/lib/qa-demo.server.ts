import { createHash, timingSafeEqual } from "node:crypto";

import { useSession } from "@tanstack/react-start/server";

const ALLOWED_ENVS = new Set(["preview", "development", "staging"]);
const SHARK_DEMO_STORE_ID = "aaaa0000-0000-4000-8000-000000000001";

export type DemoProfileId =
  | "shark_proprietario"
  | "shark_atendente"
  | "shark_cozinha"
  | "shark_entregador";

export type DemoProfile = {
  id: DemoProfileId;
  label: string;
  description: string;
  group: "Shark Demo Store";
  redirectTo: string;
  email?: string;
  courierOf?: { storeId: string; index: number };
};

export const DEMO_PROFILES: DemoProfile[] = [
  {
    id: "shark_proprietario",
    label: "Proprietário / Gestor",
    description: "Configurações, cardápio, pedidos, equipe, entregadores, relatórios e assinatura da loja demo.",
    group: "Shark Demo Store",
    email: "shark.owner@example.com",
    redirectTo: "/app/loja",
  },
  {
    id: "shark_atendente",
    label: "Atendente / Operação",
    description: "Fila de pedidos, aceite, recusa, cancelamento, contato do cliente e atribuição de entregador.",
    group: "Shark Demo Store",
    email: "shark.atendente@example.com",
    redirectTo: "/app/loja/pedidos",
  },
  {
    id: "shark_cozinha",
    label: "Cozinha",
    description: "Modo Cozinha com fila operacional, início de preparo e conclusão sem acesso financeiro amplo.",
    group: "Shark Demo Store",
    email: "shark.cozinha@example.com",
    redirectTo: "/app/loja/cozinha",
  },
  {
    id: "shark_entregador",
    label: "Entregador",
    description: "Aplicativo do entregador, presença, entregas atribuídas, status e ocorrências.",
    group: "Shark Demo Store",
    courierOf: { storeId: SHARK_DEMO_STORE_ID, index: 0 },
    redirectTo: "/app/entregador",
  },
];

export function isDemoEnvironmentEnabled() {
  const appEnv = process.env["APP_ENV"]?.trim().toLowerCase();
  if (!appEnv) return false;
  return ALLOWED_ENVS.has(appEnv);
}

export function assertDemoEnvironment() {
  if (!isDemoEnvironmentEnabled()) {
    throw new Response("Not Found", { status: 404 });
  }
}

type QaSession = { unlockedAt?: number; env?: string };
const CAPABILITY_TTL_MS = 30 * 60 * 1000;

function sessionConfig() {
  const password = process.env["QA_SESSION_SECRET"];
  if (!password) throw new Response("Not Found", { status: 404 });
  return {
    password,
    name: "pa-qa-demo",
    maxAge: Math.floor(CAPABILITY_TTL_MS / 1000),
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function keyMatches(input: string) {
  const expected = process.env["QA_PREVIEW_ACCESS_KEY"];
  if (!expected) return false;
  return timingSafeEqual(digest(input), digest(expected));
}

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 8;

function rateLimit(bucket: string) {
  const now = Date.now();
  const current = attempts.get(bucket);
  if (!current || current.resetAt < now) {
    attempts.set(bucket, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  current.count += 1;
  return current.count <= MAX_ATTEMPTS;
}

export async function unlockDemoCapability(accessKey: string) {
  assertDemoEnvironment();
  if (!rateLimit("qa-demo-unlock")) {
    console.warn("[qa-demo] unlock bloqueado por rate limit");
    return { ok: false as const, reason: "rate_limited" as const };
  }
  if (typeof accessKey !== "string" || accessKey.length < 8 || !keyMatches(accessKey)) {
    console.warn("[qa-demo] unlock recusado");
    return { ok: false as const, reason: "invalid_key" as const };
  }
  const session = await useSession<QaSession>(sessionConfig());
  await session.update({ unlockedAt: Date.now(), env: process.env["APP_ENV"] });
  return { ok: true as const };
}

export async function readDemoCapability() {
  if (!isDemoEnvironmentEnabled()) return { valid: false as const };
  const session = await useSession<QaSession>(sessionConfig());
  const unlockedAt = session.data.unlockedAt ?? 0;
  const sameEnv = session.data.env === process.env["APP_ENV"];
  const fresh = Date.now() - unlockedAt < CAPABILITY_TTL_MS;
  return { valid: Boolean(unlockedAt) && sameEnv && fresh };
}

export async function clearDemoCapability() {
  if (!isDemoEnvironmentEnabled()) return { ok: true as const };
  const session = await useSession<QaSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
}

async function resolveCourierEmail(storeId: string, index: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, created_at")
    .eq("store_id", storeId)
    .eq("role", "entregador")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const target = roles?.[index];
  if (!target) return null;
  const { data: userResult, error: userError } = await supabaseAdmin.auth.admin.getUserById(target.user_id);
  if (userError) throw userError;
  return userResult.user?.email ?? null;
}

export async function issueDemoMagicLink(profileId: string) {
  assertDemoEnvironment();
  const capability = await readDemoCapability();
  if (!capability.valid) return { ok: false as const, reason: "unauthorized" as const };
  const profile = DEMO_PROFILES.find((item) => item.id === profileId);
  if (!profile) return { ok: false as const, reason: "unknown_profile" as const };

  const email = profile.email ?? (profile.courierOf
    ? await resolveCourierEmail(profile.courierOf.storeId, profile.courierOf.index)
    : null);
  if (!email) return { ok: false as const, reason: "account_missing" as const };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) {
    console.error("[qa-demo] falha ao gerar magic link", { profileId });
    return { ok: false as const, reason: "link_failed" as const };
  }
  return { ok: true as const, tokenHash: data.properties.hashed_token, redirectTo: profile.redirectTo };
}

export function listDemoProfiles() {
  assertDemoEnvironment();
  return DEMO_PROFILES.map(({ id, label, description, group, redirectTo }) => ({ id, label, description, group, redirectTo }));
}
