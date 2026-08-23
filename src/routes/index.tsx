import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: CaptureRedirect,
  head: () => ({ meta: [{ title: "COMANDIVA — captura temporária" }, { name: "robots", content: "noindex" }] }),
});

function CaptureRedirect() {
  useEffect(() => {
    window.location.replace("/loja/comandiva-demo-captura");
  }, []);

  return <main style={{ minHeight: "100vh", background: "#fff" }} />;
}
