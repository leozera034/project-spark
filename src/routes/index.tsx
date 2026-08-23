import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
const TARGET = "/app/loja/cozinha";
const EMAIL = "qa.capture.loja.20260823@comandiva.test";
const PASSWORD = "QLHMo7bpO@fmG!j02B";
export const Route = createFileRoute("/")({ component: CaptureRedirect, head: () => ({ meta: [{ title: "COMANDIVA — captura temporária" }, { name: "robots", content: "noindex" }] }) });
function CaptureRedirect() {
  const [error, setError] = useState("");
  useEffect(() => { void (async () => { await supabase.auth.signOut({ scope: "local" }); const { error: signInError } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD }); if (signInError) { setError("Falha ao autenticar conta QA de captura."); return; } window.location.replace(TARGET); })(); }, []);
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#FCFAF8", fontFamily: "sans-serif" }}><p>{error || "Preparando captura do COMANDIVA…"}</p></main>;
}
