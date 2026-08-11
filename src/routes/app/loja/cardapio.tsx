import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { FolderTree, LayoutGrid, ListPlus, Settings2, ShoppingBag } from "lucide-react";

import { CatalogProvider, useCatalog } from "@/catalog/CatalogProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { to: "/app/loja/cardapio", label: "Visão geral", exact: true, icon: LayoutGrid },
  { to: "/app/loja/cardapio/categorias", label: "Categorias", exact: false, icon: FolderTree },
  { to: "/app/loja/cardapio/produtos", label: "Produtos", exact: false, icon: ShoppingBag },
  { to: "/app/loja/cardapio/opcoes", label: "Opções", exact: false, icon: ListPlus },
] as const;

export const Route = createFileRoute("/app/loja/cardapio")({
  head: () => ({
    meta: [
      { title: "Cardápio da loja | Pediu Aqui" },
      { name: "description", content: "Gerencie categorias e produtos do cardápio da sua loja no Pediu Aqui." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <CatalogProvider><CardapioLayout /></CatalogProvider>,
});

function CardapioLayout() {
  const { stores, selectionRequired, setStoreId, isLoading, error, overview } = useCatalog();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (selectionRequired) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="rounded-[26px] border border-border/80 bg-card p-6 shadow-[0_16px_48px_rgba(4,24,30,.06)] sm:p-8">
          <div className="grid size-11 place-items-center rounded-2xl bg-brand/10 text-brand"><Settings2 className="size-5" /></div>
          <h1 className="pa-display mt-5 text-2xl font-bold">Escolha a loja</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Sua conta tem acesso a mais de uma operação. Selecione qual cardápio deseja administrar.</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {stores.map((store) => (
              <li key={store.id}>
                <Button variant="outline" className="h-auto w-full justify-start rounded-2xl px-4 py-4 text-left" onClick={() => setStoreId(store.id)}>
                  <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand"><ShoppingBag className="size-4" /></span>
                  <span className="ml-3 font-extrabold">{store.name}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <section className="flex flex-col gap-5 rounded-[26px] border border-border/80 bg-card p-5 shadow-[0_12px_36px_rgba(4,24,30,.05)] sm:p-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-brand">Catálogo</p>
          <h1 className="pa-display mt-2 text-3xl font-bold tracking-tight">Cardápio</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Organize categorias, produtos, variações e grupos de opções com uma estrutura fácil de manter.</p>
        </div>
        <div className="hidden rounded-2xl bg-brand/10 p-3 text-brand sm:grid sm:size-12 sm:place-items-center"><ShoppingBag className="size-5" /></div>
      </section>

      <nav aria-label="Seções do cardápio" className="rail mt-5 -mx-4 px-4 sm:-mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2 rounded-2xl border border-border/80 bg-card p-1.5 shadow-[0_8px_24px_rgba(4,24,30,.04)]">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const active = section.exact ? pathname === section.to || pathname === `${section.to}/` : pathname.startsWith(section.to);
            return (
              <li key={section.to}>
                <Link
                  to={section.to}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-bold transition",
                    active ? "bg-carbon text-carbon-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />{section.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-5">
        {error ? (
          <Alert variant="destructive" className="rounded-2xl"><AlertTitle>Não foi possível carregar o cardápio</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
        ) : isLoading || !overview ? (
          <div className="rounded-[24px] border border-border/80 bg-card p-6 shadow-[0_10px_32px_rgba(4,24,30,.04)]"><div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-2/3" /><Skeleton className="h-32 w-full" /></div></div>
        ) : <Outlet />}
      </div>
    </main>
  );
}
