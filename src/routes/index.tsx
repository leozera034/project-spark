import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { courierIdentifierToSyntheticEmail } from "@/auth/courierIdentifier";
import { supabase } from "@/integrations/supabase/client";

const TARGET = "/app/entregador";
const IDENTIFIER = "comandiva.demo.entregador";
const TEMP_PASSWORD = "F7p59Pmq3rr7KW7a";
const CAPTURE_PASSWORD = "C0mandiva!Capture2026Z";

export const Route = createFileRoute("/")({ component: CaptureRedirect, head: () => ({ meta: [{ title: "COMANDIVA — captura temporária" }, { name: "robots", content: "noindex" }] }) });

function CaptureRedirect() {
  const [error, setError] = useState("");
  useEffect(() => { void (async () => {
    await supabase.auth.signOut({ scope: "local" });
    const email = await courierIdentifierToSyntheticEmail(IDENTIFIER);
    let signIn = await supabase.auth.signInWithPassword({ email, password: CAPTURE_PASSWORD });
    if (signIn.error) {
      signIn = await supabase.auth.signInWithPassword({ email, password: TEMP_PASSWORD });
      if (signIn.error) { setError("Falha ao autenticar entregador QA."); return; }
      const { error: updateError } = await supabase.auth.updateUser({ password: CAPTURE_PASSWORD });
      if (updateError) { setError("Falha ao preparar senha QA do entregador."); return; }
      const { error: completeError } = await supabase.rpc("complete_my_initial_password_change");
      if (completeError) { setError("Falha ao concluir acesso inicial do entregador QA."); return; }
    }
    window.location.replace(TARGET);
  })(); }, []);
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#FCFAF8", fontFamily: "sans-serif" }}><p>{error || "Preparando captura do entregador…"}</p></main>;
}
