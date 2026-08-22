import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/loja/smart-delivery")({
  beforeLoad: () => {
    throw redirect({ to: "/app/loja/entregas" });
  },
});
