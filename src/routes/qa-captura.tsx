import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { courierIdentifierToSyntheticEmail } from "@/auth/courierIdentifier";
import { supabase } from "@/integrations/supabase/client";

const STORE_EMAIL = "qa.capture.loja.20260823@comandiva.test";
const STORE_PASSWORD = "QLHMo7bpO@fmG!j02B";
const COURIER_IDENTIFIER = "comandiva.demo.entregador";
const COURIER_TEMP_PASSWORD = "F7p59Pmq3rr7KW7a";
const COURIER_CAPTURE_PASSWORD = "C0mandiva!Capture2026Z";

const TARGETS = {
  dashboard: "/app/loja",
  cardapio: "/app/loja/cardapio",
  financeiro: "/app/loja/financeiro",
  entregas: "/app/loja/entregas",
  entregadores: "/app/loja/entregadores",
  cozinha: "/app/loja/cozinha",
  crescimento: "/app/loja/crescimento",
  avaliacoes: "/app/loja/avaliacoes",
  entregador: "/app/entregador",
} as const;

type Screen = keyof typeof TARGETS;

export const Route = createFileRoute("/qa-captura")({
  validateSearch: (search: Record<string, unknown>): { tela: Screen } => ({
    tela: typeof search.tela === "string" && search.tela in TARGETS ? (search.tela as Screen) : "dashboard",
  }),
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  component: CaptureEntry,
});

function CaptureEntry() {
  const { tela } = Route.useSearch();
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      await supabase.auth.signOut({ scope: "local" });

      if (tela === "entregador") {
        const email = await courierIdentifierToSyntheticEmail(COURIER_IDENTIFIER);
        let auth = await supabase.auth.signInWithPassword({ email, password: COURIER_CAPTURE_PASSWORD });
        if (auth.error) {
          auth = await supabase.auth.signInWithPassword({ email, password: COURIER_TEMP_PASSWORD });
          if (auth.error) {
            setError("Falha no acesso QA do entregador.");
            return;
          }
          const updated = await supabase.auth.updateUser({ password: COURIER_CAPTURE_PASSWORD });
          if (updated.error) {
            setError("Falha ao preparar acesso QA do entregador.");
            return;
          }
          await supabase.rpc("complete_my_initial_password_change");
        }
      } else {
        const auth = await supabase.auth.signInWithPassword({ email: STORE_EMAIL, password: STORE_PASSWORD });
        if (auth.error) {
          setError("Falha no acesso QA da loja.");
          return;
        }
      }

      window.location.replace(TARGETS[tela]);
    })();
  }, [tela]);

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <div>
        <p className="font-display text-2xl font-black">COMANDIVA</p>
        <p className="mt-2 text-sm text-muted-foreground">{error || "Preparando captura autorizada…"}</p>
      </div>
    </main>
  );
}
