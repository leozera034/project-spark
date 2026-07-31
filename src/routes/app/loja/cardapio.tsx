import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

import { CatalogProvider, useCatalog } from "@/catalog/CatalogProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { to: "/app/loja/cardapio", label: "Visão geral", exact: true },
  { to: "/app/loja/cardapio/categorias", label: "Categorias", exact: false },
  { to: "/app/loja/cardapio/produtos", label: "Produtos", exact: false },
  { to: "/app/loja/cardapio/opcoes", label: "Opções", exact: false },
] as const;

export const Route = createFileRoute("/app/loja/cardapio")({
  head: () => ({
    meta: [
      { title: "Cardápio da loja | Pediu Aqui" },
      {
        name: "description",
        content: "Gerencie categorias e produtos simples do cardápio da sua loja no Pediu Aqui.",
      },
      { property: "og:title", content: "Cardápio da loja | Pediu Aqui" },
      {
        property: "og:description",
        content: "Administração de categorias e produtos do cardápio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <CatalogProvider>
      <CardapioLayout />
    </CatalogProvider>
  ),
});

function CardapioLayout() {
  const { stores, selectionRequired, setStoreId, isLoading, error, overview } = useCatalog();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (selectionRequired) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="text-xl font-semibold text-foreground">Escolha a loja</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua conta tem acesso a mais de uma loja. Selecione qual cardápio deseja gerenciar.
        </p>
        <ul className="mt-6 space-y-2">
          {stores.map((store) => (
            <li key={store.id}>
              <Button
                variant="outline"
                className="h-auto w-full justify-start py-4 text-left"
                onClick={() => setStoreId(store.id)}
              >
                <span className="font-medium">{store.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Cardápio</h1>
        <p className="text-sm text-muted-foreground">
          Categorias, produtos, variações, grupos de opções e venda por peso.
        </p>

      <nav aria-label="Seções do cardápio" className="mt-6 -mx-4 overflow-x-auto px-4">
        <ul className="flex min-w-max gap-2 border-b border-border pb-px">
          {SECTIONS.map((section) => {
            const active = section.exact
              ? pathname === section.to || pathname === `${section.to}/`
              : pathname.startsWith(section.to);
            return (
              <li key={section.to}>
                <Link
                  to={section.to}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-t-md px-3 text-sm font-medium transition-colors",
                    active
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar o cardápio</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : isLoading || !overview ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <Outlet />
        )}
      </div>
    </main>
  );
}
