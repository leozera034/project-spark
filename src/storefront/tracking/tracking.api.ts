/**
 * Acesso do navegador ao acompanhamento público do pedido.
 * O token viaja no corpo do POST; nunca na URL da requisição.
 */
import type { TrackingResponse } from "@/lib/tracking-contracts";

const TIMEOUT_MS = 15_000;

export async function fetchOrderTracking(
  token: string,
  knownVersion: string | null,
): Promise<TrackingResponse> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, error: "unavailable" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch("/api/public/storefront/pedido/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, knownVersion }),
      signal: controller.signal,
    });

    if (response.status === 429) return { ok: false, error: "rate_limited" };

    const payload = (await response.json()) as TrackingResponse;
    if (!payload || typeof payload !== "object" || !("ok" in payload)) {
      return { ok: false, error: "unavailable" };
    }
    return payload;
  } catch {
    return { ok: false, error: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
