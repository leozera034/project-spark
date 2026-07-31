/**
 * Fase 15 — Polling do acompanhamento, consciente de visibilidade.
 *
 * Regras:
 * - só consulta com a aba visível e o aparelho online;
 * - envia a versão conhecida do status: sem mudança, a resposta é mínima;
 * - intervalo aumenta em estados lentos e para de vez em estado final;
 * - falhas de rede fazem backoff, sem apagar o que já está na tela.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { PublicOrderTracking, TrackingResponse } from "@/lib/tracking-contracts";

import { fetchOrderTracking } from "./tracking.api";

const FAST_MS = 12_000;
const SLOW_MS = 30_000;
const MAX_BACKOFF_MS = 120_000;

const FAST_CODES = new Set(["received", "confirmed", "out_for_delivery", "ready_for_pickup"]);

export type TrackingState = {
  data: PublicOrderTracking | null;
  error: "not_found" | "rate_limited" | "unavailable" | null;
  loading: boolean;
  refresh: () => void;
};

export function useOrderTracking(token: string | null): TrackingState {
  const [data, setData] = useState<PublicOrderTracking | null>(null);
  const [error, setError] = useState<TrackingState["error"]>(null);
  const [loading, setLoading] = useState(Boolean(token));

  const versionRef = useRef<string | null>(null);
  const failuresRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  const tick = useCallback(async () => {
    if (!token || runningRef.current) return;
    runningRef.current = true;
    try {
      const result: TrackingResponse = await fetchOrderTracking(token, versionRef.current);
      if (result.ok) {
        failuresRef.current = 0;
        setError(null);
        versionRef.current = result.statusVersion;
        if (result.changed) setData(result);
      } else if (result.error === "not_found") {
        setError("not_found");
      } else {
        failuresRef.current += 1;
        setError(result.error === "rate_limited" ? "rate_limited" : "unavailable");
      }
    } finally {
      runningRef.current = false;
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const clear = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };

    const schedule = () => {
      clear();
      if (cancelled) return;
      if (data?.status.isFinal) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

      const base = data && !FAST_CODES.has(data.status.publicCode) ? SLOW_MS : FAST_MS;
      const delay =
        failuresRef.current > 0
          ? Math.min(base * 2 ** failuresRef.current, MAX_BACKOFF_MS)
          : base;

      timerRef.current = setTimeout(async () => {
        await tick();
        schedule();
      }, delay);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void tick().then(schedule);
      } else {
        clear();
      }
    };

    void tick().then(schedule);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);

    return () => {
      cancelled = true;
      clear();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
    // `data` participa para reagendar quando o ritmo muda ou o pedido finaliza
  }, [token, tick, data?.status.publicCode, data?.status.isFinal]);

  const refresh = useCallback(() => {
    versionRef.current = null;
    failuresRef.current = 0;
    void tick();
  }, [tick]);

  return { data, error, loading, refresh };
}
