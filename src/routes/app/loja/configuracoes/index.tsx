import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/loja/configuracoes/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/loja/configuracoes/dados" });
  },
});
