import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/auth/useAuth";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Administração | Pediu Aqui" },
      {
        name: "description",
        content: "Área autenticada da administração da plataforma Pediu Aqui.",
      },
      { property: "og:title", content: "Administração | Pediu Aqui" },
      { property: "og:description", content: "Área autenticada da administração da plataforma." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHome,
});

function AdminHome() {
  const { authContext } = useAuth();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Administração da plataforma
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sessão ativa como {authContext?.full_name ?? "administrador"}. As telas de gestão conectadas
        ao banco entram nas próximas fases.
      </p>
    </main>
  );
}
