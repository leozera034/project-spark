import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/auth/useAuth";

export const Route = createFileRoute("/app/loja/")({
  head: () => ({
    meta: [
      { title: "Painel da loja | Pediu Aqui" },
      {
        name: "description",
        content: "Área autenticada da equipe da loja no Pediu Aqui.",
      },
      { property: "og:title", content: "Painel da loja | Pediu Aqui" },
      { property: "og:description", content: "Área autenticada da equipe da loja." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StoreHome,
});

function StoreHome() {
  const { authContext } = useAuth();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Olá, {authContext?.full_name ?? "equipe"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sua sessão está ativa. As telas operacionais conectadas ao banco entram nas próximas fases.
      </p>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Ambiente</dt>
          <dd className="mt-1 text-sm text-foreground">Loja</dd>
        </div>
        <div className="rounded-lg border border-border p-4">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Papéis</dt>
          <dd className="mt-1 text-sm text-foreground">
            {authContext?.roles.join(", ") || "sem papel"}
          </dd>
        </div>
      </dl>
    </main>
  );
}
