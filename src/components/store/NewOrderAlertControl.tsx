import { Bell, BellOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "comandiva:new-order-sound";

type AudioContextConstructor = typeof AudioContext;

function readEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function persistEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Preferência de som é conveniência local e não afeta a operação.
  }
}

export function NewOrderAlertControl({ count }: { count: number }) {
  const [enabled, setEnabled] = useState(readEnabled);
  const previousCountRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  function getAudioContext() {
    if (audioContextRef.current) return audioContextRef.current;
    const Constructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!Constructor) return null;
    audioContextRef.current = new Constructor();
    return audioContextRef.current;
  }

  async function ensureAudioReady() {
    const context = getAudioContext();
    if (!context) return null;
    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        return null;
      }
    }
    return context;
  }

  async function playOrderTone() {
    const context = await ensureAudioReady();
    if (!context) return false;

    const start = context.currentTime;
    for (const [offset, frequency] of [[0, 740], [0.16, 940]] as const) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start + offset);
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.14, start + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.13);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.14);
    }
    return true;
  }

  useEffect(() => {
    if (!enabled) return;
    const prime = () => {
      void ensureAudioReady();
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
    window.addEventListener("pointerdown", prime, { passive: true });
    window.addEventListener("keydown", prime);
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
  }, [enabled]);

  useEffect(() => {
    const previous = previousCountRef.current;
    previousCountRef.current = count;
    if (!enabled || previous === null || count <= previous) return;
    void playOrderTone();
  }, [count, enabled]);

  useEffect(() => () => {
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") void context.close();
  }, []);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    persistEnabled(next);
    if (!next) {
      toast.success("Som de novos pedidos desativado.");
      return;
    }

    const played = await playOrderTone();
    if (played) toast.success("Som de novos pedidos ativado.");
    else toast.info("Som ativado. O navegador pode exigir uma interação antes do primeiro alerta.");
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => void toggle()}
      aria-pressed={enabled}
      aria-label={enabled ? "Desativar som de novos pedidos" : "Ativar som de novos pedidos"}
      title={enabled ? "Som de novos pedidos ativado" : "Ativar som de novos pedidos"}
      className="shrink-0 text-muted-foreground hover:text-foreground"
    >
      {enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
    </Button>
  );
}
