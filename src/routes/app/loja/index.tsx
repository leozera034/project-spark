import { Link, createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";


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
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
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
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/app/loja/pedidos">Fila de pedidos</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/app/loja/cozinha">Modo cozinha</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/app/loja/entregadores">Entregadores</Link>
        </Button>

        <Button asChild variant="outline">
          <Link to="/app/loja/cardapio">Gerenciar cardápio</Link>
        </Button>

        <Button asChild variant="outline">
          <Link to="/app/loja/configuracoes/dados">Configurações da loja</Link>
        </Button>
      </div>
    </main>

  );
}
