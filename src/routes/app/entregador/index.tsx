import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/auth/useAuth";

export const Route = createFileRoute("/app/entregador/")({
  head: () => ({
    meta: [
      { title: "Minhas entregas | Pediu Aqui" },
      {
        name: "description",
        content: "Área do entregador no Pediu Aqui, com acesso às entregas da sua loja.",
      },
      { property: "og:title", content: "Minhas entregas | Pediu Aqui" },
      { property: "og:description", content: "Área do entregador com as entregas da sua loja." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CourierHome,
});

function CourierHome() {
  const { authContext } = useAuth();

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Olá, {authContext?.full_name ?? "entregador"}
      </h1>
      <p className="mt-3 text-base text-muted-foreground">
        Seu acesso está ativo. As entregas aparecem aqui nas próximas fases.
      </p>
    </main>
  );
}
