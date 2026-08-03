/**
 * Central Demo do Preview — camada servidora.
 *
 * Regras de segurança (fail-closed):
 * - só existe quando APP_ENV ∈ { preview, development, staging };
 * - a chave de acesso vive apenas como secret (QA_PREVIEW_ACCESS_KEY);
 * - comparação em tempo constante;
 * - capacidade QA curta em cookie HttpOnly assinado/cifrado;
 * - nenhuma senha, service role, refresh token ou JWT administrativo é devolvido;
 * - o login demo usa magic link real (verifyOtp no navegador) — sessão legítima.
 */
import { createHash, timingSafeEqual } from "node:crypto";

import { useSession } from "@tanstack/react-start/server";

const ALLOWED_ENVS = new Set(["preview", "development", "staging"]);

const AURORA_STORE_ID = "00000000-0000-4000-8000-000000000205";
const BRASA_STORE_ID = "00000000-0000-4000-8000-000000000201";

export type DemoProfileId =
  | "admin_plataforma"
  | "aurora_proprietario"
  | "aurora_gerente"
  | "aurora_atendente"
  | "aurora_cozinha"
  | "aurora_entregador_1"
  | "aurora_entregador_2"
  | "brasa_proprietario";

export type DemoProfile = {
  id: DemoProfileId;
  label: string;
  description: string;
  group: "Plataforma" | "Mercado Aurora" | "Brasa Urbana (isolamento)";
  redirectTo: string;
  /** Conta Auth real. `courierOf` resolve o identificador interno do entregador. */
  email?: string;
  courierOf?: { storeId: string; index: number };
};

export const DEMO_PROFILES: DemoProfile[] = [
  {
    id: "admin_plataforma",
    label: "Administrador da plataforma",
    description: "Lojas, saúde operacional sanitizada, auditoria e cobranças.",
    group: "Plataforma",
    email: "admin@pediuaqui.test",
    redirectTo: "/admin",
  },
  {
    id: "aurora_proprietario",
    label: "Proprietário",
    description: "Configurações da loja, cardápio, equipe e relatórios.",
    group: "Mercado Aurora",
    email: "proprietario@aurora.test",
    redirectTo: "/app/loja",
  },
  {
    id: "aurora_gerente",
    label: "Gerente",
    description: "Operação completa, sem alterar dados cadastrais da loja.",
    group: "Mercado Aurora",
    email: "gerente@aurora.test",
    redirectTo: "/app/loja/pedidos",
  },
  {
    id: "aurora_atendente",
    label: "Atendente",
    description: "Fila de pedidos, aceite, recusa e atribuição de entregador.",
    group: "Mercado Aurora",
    email: "atendente@aurora.test",
    redirectTo: "/app/loja/pedidos",
  },
  {
    id: "aurora_cozinha",
    label: "Cozinha",
    description: "Modo Cozinha com projeção mínima e tempo decorrido.",
    group: "Mercado Aurora",
    email: "cozinha@aurora.test",
    redirectTo: "/app/loja/cozinha",
  },
  {
    id: "aurora_entregador_1",
    label: "Entregador 1",
    description: "App do entregador: disponibilidade, entregas e contador.",
    group: "Mercado Aurora",
    courierOf: { storeId: AURORA_STORE_ID, index: 0 },
    redirectTo: "/app/entregador",
  },
  {
    id: "aurora_entregador_2",
    label: "Entregador 2",
    description: "Segundo entregador para testar atribuição e concorrência.",
    group: "Mercado Aurora",
    courierOf: { storeId: AURORA_STORE_ID, index: 1 },
    redirectTo: "/app/entregador",
  },
  {
    id: "brasa_proprietario",
    label: "Proprietário da segunda loja",
    description: "Prova de isolamento: nunca enxerga dados do Mercado Aurora.",
    group: "Brasa Urbana (isolamento)",
    email: "proprietario@brasa.test",
    redirectTo: "/app/loja",
  },
];

export function isDemoEnvironmentEnabled() {
  const appEnv = process.env["APP_ENV"]?.trim().toLowerCase();
  if (!appEnv) return false;
  return ALLOWED_ENVS.has(appEnv);
}

/** Nega qualquer uso fora do ambiente permitido. */
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

// Rate limit simples por instância (defesa em profundidade; ambiente não produtivo).
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
  console.info("[qa-demo] unlock autorizado");
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

  const { data: userResult, error: userError } = await supabaseAdmin.auth.admin.getUserById(
    target.user_id,
  );
  if (userError) throw userError;
  return userResult.user?.email ?? null;
}

/**
 * Gera um magic link real para a conta demo e devolve apenas o token_hash,
 * que o navegador troca por uma sessão legítima via verifyOtp.
 */
export async function issueDemoMagicLink(profileId: string) {
  assertDemoEnvironment();

  const capability = await readDemoCapability();
  if (!capability.valid) {
    return { ok: false as const, reason: "unauthorized" as const };
  }

  const profile = DEMO_PROFILES.find((item) => item.id === profileId);
  if (!profile) return { ok: false as const, reason: "unknown_profile" as const };

  const email = profile.email ?? (profile.courierOf
    ? await resolveCourierEmail(profile.courierOf.storeId, profile.courierOf.index)
    : null);

  if (!email) return { ok: false as const, reason: "account_missing" as const };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error || !data?.properties?.hashed_token) {
    console.error("[qa-demo] falha ao gerar magic link", { profileId });
    return { ok: false as const, reason: "link_failed" as const };
  }

  console.info("[qa-demo] magic link emitido", { profileId });
  return {
    ok: true as const,
    tokenHash: data.properties.hashed_token,
    redirectTo: profile.redirectTo,
  };
}

export function listDemoProfiles() {
  assertDemoEnvironment();
  return DEMO_PROFILES.map(({ id, label, description, group, redirectTo }) => ({
    id,
    label,
    description,
    group,
    redirectTo,
  }));
}
