/**
 * Acesso do navegador ao acompanhamento público do pedido.
 * O token bruto nunca sai na URL: é transformado em hash no cliente antes da
 * RPC protegida pelo Edge do Supabase externo.
 */
import type { TrackingResponse } from "@/lib/tracking-contracts";
import { orderTrackingForBrowser } from "@/storefront/public-commerce";

const TIMEOUT_MS = 15_000;

export async function fetchOrderTracking(
  token: string,
  knownVersion: string | null,
): Promise<TrackingResponse> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, error: "unavailable" };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<TrackingResponse>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, error: "unavailable" }), TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      orderTrackingForBrowser({ token, knownVersion }),
      timeout,
    ]);
  } catch {
    return { ok: false, error: "unavailable" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
