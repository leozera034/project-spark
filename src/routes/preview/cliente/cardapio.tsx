import { Link, createFileRoute } from "@tanstack/react-router";
import { Search, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";

import { ProductSheet } from "@/components/demo/ProductSheet";
import { EmptyState } from "@/components/demo/States";
import { StickyAction, StoreFooter } from "@/components/demo/StoreShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDemo } from "@/demo/state/useDemo";
import { formatBRL } from "@/demo/utils/format";
import { demoHead } from "@/demo/utils/head";
import type { DemoProduct } from "@/demo/types/demo";

export const Route = createFileRoute("/preview/cliente/cardapio")({
  head: demoHead(
    "Cardápio — Mercado Aurora",
    "Padaria, refeições, bebidas, mercearia e sobremesas do Mercado Aurora.",
  ),
  component: Menu,
});

function Menu() {
  const { store, storeOpen, products, customer } = useDemo();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("cat-destaques");
  const [selected, setSelected] = useState<DemoProduct | null>(null);

  const categories = useMemo(
    () => [
      { id: "cat-destaques", name: "Destaques" },
      { id: "cat-padaria", name: "Padaria" },
      { id: "cat-refeicoes", name: "Refeições" },
      { id: "cat-bebidas", name: "Bebidas" },
      { id: "cat-mercearia", name: "Mercearia" },
      { id: "cat-sobremesas", name: "Sobremesas" },
    ],
    [],
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term) {
      return products.filter(
        (product) =>
          product.name.toLowerCase().includes(term) ||
          product.description.toLowerCase().includes(term),
      );
    }
    if (category === "cat-destaques") return products.filter((product) => product.highlighted);
    return products.filter((product) => product.categoryId === category);
  }, [products, query, category]);

  const cartCount = customer.cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = customer.cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-brand-foreground"
            style={{ backgroundColor: store.theme.brand }}
          >
            MA
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-foreground">{store.name}</h1>
            <p className="truncate text-sm text-muted-foreground">
              {storeOpen ? `Aberta · entrega em ${store.etaDelivery}` : "Fechada no momento"}
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/preview/cliente">Início</Link>
          </Button>
        </div>

        <div className="mx-auto max-w-3xl px-4 pb-3">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="h-12 pl-9 text-base"
              placeholder="Buscar no cardápio"
              aria-label="Buscar no cardápio"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        <nav aria-label="Categorias" className="rail mx-auto max-w-3xl gap-2 px-4 pb-3">
          <ul className="flex gap-2">
            {categories.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={category === item.id && query === ""}
                  onClick={() => {
                    setCategory(item.id);
                    setQuery("");
                  }}
                  className={`min-h-11 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors ${
                    category === item.id && query === ""
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-border bg-surface text-foreground hover:bg-muted"
                  }`}
                >
                  {item.name}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">
        {visible.length === 0 ? (
          <EmptyState
            title="Nenhum produto encontrado"
            description="Tente outra palavra ou escolha uma categoria acima."
            actionLabel="Limpar busca"
            onAction={() => setQuery("")}
          />
        ) : (
          <ul className="space-y-3">
            {visible.map((product) => {
              const unavailable = product.availability !== "disponivel";
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    disabled={unavailable}
                    onClick={() => setSelected(product)}
                    className="flex w-full items-start gap-4 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-surface"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-foreground">{product.name}</span>
                        {product.highlighted ? <Badge variant="brandSoft">Destaque</Badge> : null}
                        {product.availability === "esgotado" ? (
                          <Badge variant="warning">Esgotado hoje</Badge>
                        ) : null}
                        {product.availability === "indisponivel" ? (
                          <Badge variant="secondary">Indisponível</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {formatBRL(product.price)}
                        {product.unitLabel ? (
                          <span className="text-sm font-normal text-muted-foreground">
                            {" "}
                            / {product.unitLabel}
                          </span>
                        ) : null}
                        {product.variations ? (
                          <span className="text-sm font-normal text-muted-foreground">
                            {" "}
                            · a partir de
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div
                      aria-hidden="true"
                      className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-lg font-semibold text-muted-foreground"
                    >
                      {product.name.slice(0, 2).toUpperCase()}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <StoreFooter />
      </main>

      {cartCount > 0 ? (
        <StickyAction>
          <Button asChild size="touch" variant="brand" className="h-13 w-full justify-between text-base">
            <Link to="/preview/cliente/carrinho">
              <span className="flex items-center gap-2">
                <ShoppingBag aria-hidden="true" />
                Ver carrinho · {cartCount}
              </span>
              <span>{formatBRL(cartTotal)}</span>
            </Link>
          </Button>
        </StickyAction>
      ) : null}

      <ProductSheet product={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
