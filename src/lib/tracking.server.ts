/**
 * Fase 15 — Leitura pública do acompanhamento do pedido.
 *
 * SERVIDOR-ONLY (`.server.ts`). Regras aplicadas aqui:
 * - o token bruto nunca é gravado nem logado: viramos hash SHA-256 e só o
 *   hash viaja até o banco;
 * - a projeção vem pronta da RPC, que é concedida apenas ao `service_role`;
 * - o caminho da logo é trocado por URL assinada de curta duração, nunca
 *   persistida em lugar algum;
 * - erros são normalizados; detalhes ficam no log do servidor.
 */
import type { PublicDeliveryProof, PublicOrderTracking, TrackingResponse } from "@/lib/tracking-contracts";

const SIGNED_URL_TTL_SECONDS = 60 * 10;

type DeliveryProofLoadResult =
  | { ok: true; proof: PublicDeliveryProof }
  | { ok: false };

export async function hashTrackingToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function signLogo(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const db = await admin();
    const { data } = await db.storage
      .from("store-branding")
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

async function loadDeliveryProof(tokenHash: string): Promise<DeliveryProofLoadResult> {
  try {
    const db = await admin();
    const proofRpc = db.rpc.bind(db) as any;
    const { data, error } = await proofRpc("storefront_delivery_proof", { _token_hash: tokenHash });
    if (error || !data || typeof data !== "object") return { ok: false };

    const candidate = data as { mode?: unknown; code?: unknown };
    if (candidate.mode !== "pin") {
      return { ok: true, proof: { mode: "none", code: null } };
    }

    const code = typeof candidate.code === "string" && /^\d{6}$/.test(candidate.code) ? candidate.code : null;
    return { ok: true, proof: { mode: "pin", code } };
  } catch {
    return { ok: false };
  }
}

/**
 * Devolve a projeção pública do pedido. Quando `knownVersion` bate com a
 * versão atual, respondemos apenas `changed: false` — o polling fica barato e
 * nenhum dado é reenviado sem necessidade.
 */
export async function loadOrderTracking(
  token: string,
  knownVersion: string | null,
): Promise<TrackingResponse> {
  const tokenHash = await hashTrackingToken(token);

  let payload: Record<string, unknown> | null = null;
  try {
    const db = await admin();
    const { data, error } = await db.rpc("storefront_order_tracking", {
      _token_hash: tokenHash,
      _known_version: knownVersion ?? undefined,
    });
    if (error) throw error;
    payload = (data ?? null) as Record<string, unknown> | null;
  } catch {
    console.error("[tracking] lookup failed");
    return { ok: false, error: "unavailable" };
  }

  if (!payload || payload.ok !== true) return { ok: false, error: "not_found" };
  if (payload.changed !== true) {
    return { ok: true, changed: false, statusVersion: String(payload.statusVersion ?? "") };
  }

  const projection = payload as unknown as PublicOrderTracking & {
    store: { logoPath?: string | null };
  };

  const [logoUrl, proofResult] = await Promise.all([
    signLogo(projection.store?.logoPath ?? null),
    projection.fulfillment?.type === "entrega"
      ? loadDeliveryProof(tokenHash)
      : Promise.resolve<DeliveryProofLoadResult>({ ok: true, proof: { mode: "none", code: null } }),
  ]);

  // Não avance a versão conhecida quando a prova de uma entrega não puder ser
  // consultada. Assim o polling seguinte repete a resposta completa e tenta o
  // código novamente, em vez de prender cliente e entregador em changed:false.
  if (!proofResult.ok) {
    console.error("[tracking] delivery proof lookup failed");
    return { ok: false, error: "unavailable" };
  }

  const proof = projection.fulfillment?.type === "entrega" ? proofResult.proof : null;
  const { logoPath: _ignored, ...store } = projection.store as Record<string, unknown>;

  const proofMessage = proof?.mode === "pin" && proof.code
    ? `Código da entrega: ${proof.code}. Informe este código somente quando o entregador estiver com seu pedido no local.`
    : null;
  const existingMessage = projection.status.publicMessage?.trim() || null;

  return {
    ...projection,
    store: { ...(store as PublicOrderTracking["store"]), logoUrl },
    status: {
      ...projection.status,
      publicMessage: [existingMessage, proofMessage].filter(Boolean).join(" • ") || null,
    },
    fulfillment: {
      ...projection.fulfillment,
      proof,
    },
  };
}
