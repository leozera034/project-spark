import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { courierIdentifierToSyntheticEmail } from "@/auth/courierIdentifier";
import { supabase } from "@/integrations/supabase/client";
const TARGET = "/app/entregador/entrega";
const IDENTIFIER = "comandiva.demo.entregador";
const PASSWORD = "C0mandiva!Capture2026Z";
export const Route = createFileRoute("/")({ component: CaptureRedirect, head: () => ({ meta: [{ title: "COMANDIVA — captura temporária" }, { name: "robots", content: "noindex" }] }) });
function CaptureRedirect() {
  const [error, setError] = useState("");
  useEffect(() => { void (async () => { await supabase.auth.signOut({ scope: "local" }); const email = await courierIdentifierToSyntheticEmail(IDENTIFIER); const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: PASSWORD }); if (signInError) { setError("Falha ao autenticar entregador QA."); return; } window.location.replace(TARGET); })(); }, []);
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#FCFAF8", fontFamily: "sans-serif" }}><p>{error || "Preparando captura do entregador…"}</p></main>;
}
