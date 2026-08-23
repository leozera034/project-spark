import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { CatalogProvider, useCatalog } from "@/catalog/CatalogProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { to: "/app/loja/cardapio", label: "Visão geral", exact: true },
  { to: "/app/loja/cardapio/produtos", label: "Produtos", exact: false },
  { to: "/app/loja/cardapio/categorias", label: "Categorias", exact: false },
  { to: "/app/loja/cardapio/opcoes", label: "Adicionais", exact: false },
  { to: "/app/loja/cardapio/promocoes", label: "Promoções", exact: false },
] as const;

export const Route = createFileRoute("/app/loja/cardapio")({
  head: () => ({
    meta: [
      { title: "Cardápio da loja | Comandiva" },
      { name: "description", content: "Gerencie produtos, categorias, adicionais, promoções e disponibilidade do cardápio da sua loja." },
      { property: "og:title", content: "Cardápio da loja | Comandiva" },
      { property: "og:description", content: "Administração do cardápio da loja na Comandiva." },
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
        <p className="mt-2 text-sm text-muted-foreground">Sua conta tem acesso a mais de uma loja. Selecione qual cardápio deseja gerenciar.</p>
        <ul className="mt-6 space-y-2">
          {stores.map((store) => (
            <li key={store.id}><Button variant="outline" className="h-auto w-full justify-start py-4 text-left" onClick={() => setStoreId(store.id)}><span className="font-medium">{store.name}</span></Button></li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-brand">Gestão</p>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-foreground">Cardápio</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Organize o que o cliente vê, mantenha disponibilidade em dia, ajuste preços e programe promoções sem sair desta área.</p>
        </div>
        <Button asChild><Link to="/app/loja/cardapio/produtos/novo"><Plus className="size-4" /> Novo produto</Link></Button>
      </header>

      <nav aria-label="Seções do cardápio" className="rail mt-6 -mx-4 gap-2 px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2 border-b border-border pb-px">
          {SECTIONS.map((section) => {
            const active = section.exact ? pathname === section.to || pathname === `${section.to}/` : pathname.startsWith(section.to);
            return (
              <li key={section.to}>
                <Link
                  to={section.to}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-xl px-3.5 text-sm font-bold transition-colors",
                    active ? "bg-brand-soft text-brand" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
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
        {error ? <Alert variant="destructive"><AlertTitle>Não foi possível carregar o cardápio</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : isLoading || !overview ? <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-2/3" /><Skeleton className="h-32 w-full" /></div> : <Outlet />}
      </div>
    </main>
  );
}
