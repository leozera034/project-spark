import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock, MapPin, Search, ShoppingBag, Store, X } from "lucide-react";
import { z } from "zod";

import { ProductConfigurator } from "@/components/storefront/ProductConfigurator";
import { WEEKDAY_LABELS, brl, foldText, shortTime } from "@/components/storefront/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fetchStorefront } from "@/lib/storefront.functions";
import type { PublicCatalog, PublicStorePayload } from "@/lib/storefront.server";


const searchSchema = z.object({
  produto: z.string().uuid().optional(),
});

export const Route = createFileRoute("/loja/$slug")({
  validateSearch: searchSchema,
  loader: async ({ params }) => fetchStorefront({ data: { slug: params.slug } }),
  head: ({ loaderData, params }) => {
    const name = loaderData?.store.store.name ?? "Cardápio digital";
    const city = loaderData?.store.store.city;
    const description =
      loaderData?.store.settings.description ??
      `Peça online no ${name}${city ? ` em ${city}` : ""}. Cardápio atualizado, entrega e retirada.`;
    const title = `${name} · Cardápio online`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "index,follow" },
      ],
      links: [{ rel: "canonical", href: `/loja/${params.slug}` }],
    };
  },
  errorComponent: () => (
    <CenteredMessage
      title="Cardápio indisponível"
      body="Não conseguimos carregar esta loja agora. Tente novamente em instantes."
    />
  ),
  notFoundComponent: () => (
    <CenteredMessage
      title="Loja não encontrada"
      body="O endereço acessado não corresponde a nenhuma loja ativa."
    />
  ),
  component: StorefrontPage,
});

function CenteredMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <Store className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
    </main>
  );
}

function StorefrontPage() {
  const { store: storePayload, catalog } = Route.useLoaderData() as {
    store: PublicStorePayload;
    catalog: PublicCatalog;
  };

  const { slug } = Route.useParams();
  const { produto } = Route.useSearch();

  const navigate = useNavigate({ from: Route.fullPath });
  const [term, setTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { store, settings, hours, is_open: isOpen } = storePayload;

  const grouped = useMemo(() => {
    const needle = foldText(term);
    const filtered = needle
      ? catalog.products.filter(
          (p) =>
            foldText(p.name).includes(needle) ||
            foldText(p.description ?? "").includes(needle),
        )
      : catalog.products;

    return catalog.categories
      .map((category) => ({
        category,
        items: filtered.filter((p) => p.category_id === category.id),
      }))
      .filter((entry) => entry.items.length > 0);
  }, [catalog, term]);

  const todayHours = hours.filter((h) => h.weekday === new Date().getDay());

  const openProduct = (id: string) =>
    navigate({ search: { produto: id }, replace: false });
  const closeProduct = () => navigate({ search: {}, replace: true });

  return (
    <main
      className="min-h-svh bg-background pb-16"
      style={
        {
          "--brand": settings.brand_primary,
          "--brand-accent": settings.brand_accent,
        } as React.CSSProperties
      }
    >
      <header className="relative">
        {settings.cover_url ? (
          <img
            src={settings.cover_url}
            alt=""
            className="h-36 w-full object-cover sm:h-52"
            fetchPriority="high"
          />
        ) : (
          <div
            className="h-28 w-full sm:h-40"
            style={{
              background: `linear-gradient(120deg, ${settings.brand_primary}, ${settings.brand_accent})`,
            }}
          />
        )}

        <div className="mx-auto max-w-3xl px-4">
          <div className="-mt-10 flex items-end gap-4">
            {settings.logo_url ? (
              <img
                src={settings.logo_url}
                alt={store.name}
                className="size-20 rounded-2xl border-4 border-background object-cover shadow-sm"
              />
            ) : (
              <div className="grid size-20 place-items-center rounded-2xl border-4 border-background bg-muted shadow-sm">
                <Store className="size-8 text-muted-foreground" />
              </div>
            )}
            <div className="pb-1">
              <h1 className="text-xl font-semibold leading-tight">{store.name}</h1>
              <p className="text-sm text-muted-foreground">
                {store.segment ? `${store.segment} · ` : ""}
                {store.city}/{store.state}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant={isOpen ? "default" : "secondary"}>
              {isOpen ? "Aberta agora" : "Fechada"}
            </Badge>
            {store.accepts_delivery ? <Badge variant="outline">Entrega</Badge> : null}
            {store.accepts_pickup ? <Badge variant="outline">Retirada</Badge> : null}
            {settings.min_order_amount > 0 ? (
              <Badge variant="outline">Mínimo {brl(settings.min_order_amount)}</Badge>
            ) : null}
            <Badge variant="outline">
              <Clock className="mr-1 size-3" />~{settings.default_prep_minutes} min
            </Badge>
          </div>

          {!isOpen && settings.closed_message ? (
            <p className="mt-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              {settings.closed_message}
            </p>
          ) : null}
          {isOpen && settings.welcome_message ? (
            <p className="mt-4 text-sm text-muted-foreground">{settings.welcome_message}</p>
          ) : null}
        </div>
      </header>

      <div className="sticky top-0 z-20 mt-6 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-3xl space-y-3 px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Buscar no cardápio"
              aria-label="Buscar no cardápio"
              className="h-11 pl-9"
            />
            {term ? (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          {grouped.length > 1 ? (
            <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {grouped.map(({ category }) => (
                <a
                  key={category.id}
                  href={`#categoria-${category.id}`}
                  onClick={() => setActiveCategory(category.id)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                    activeCategory === category.id ? "bg-muted font-medium" : ""
                  }`}
                >
                  {category.name}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4">
        {grouped.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingBag className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              {term
                ? `Nenhum item encontrado para “${term}”.`
                : "Esta loja ainda não publicou itens no cardápio."}
            </p>
          </div>
        ) : (
          grouped.map(({ category, items }) => (
            <section
              key={category.id}
              id={`categoria-${category.id}`}
              className="scroll-mt-32 py-6"
            >
              <h2 className="text-lg font-semibold">{category.name}</h2>
              {category.description ? (
                <p className="text-sm text-muted-foreground">{category.description}</p>
              ) : null}

              <ul className="mt-4 space-y-3">
                {items.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => openProduct(product.id)}
                      className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
                      disabled={product.is_sold_out}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate font-medium">
                          {product.name}
                          {product.is_featured ? (
                            <Badge variant="secondary" className="shrink-0">
                              Destaque
                            </Badge>
                          ) : null}
                        </p>
                        {product.description ? (
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {product.description}
                          </p>
                        ) : null}
                        <p className="mt-1 text-sm font-semibold">
                          {product.is_sold_out
                            ? "Esgotado"
                            : product.from_price !== null && product.has_variants
                              ? `a partir de ${brl(product.from_price)}`
                              : brl(product.base_price)}
                        </p>
                      </div>
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="size-20 shrink-0 rounded-lg object-cover"
                        />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        <Separator className="my-6" />

        <footer className="space-y-4 pb-10 text-sm text-muted-foreground">
          {store.address_line ? (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              {store.address_line} — {store.city}/{store.state}
            </p>
          ) : null}
          {todayHours.length > 0 ? (
            <p className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0" />
              {WEEKDAY_LABELS[new Date().getDay()]}:{" "}
              {todayHours
                .map((h) => `${shortTime(h.opens_at)} às ${shortTime(h.closes_at)}`)
                .join(", ")}
            </p>
          ) : null}
          <p className="text-xs">Cardápio digital Pediu Aqui.</p>
        </footer>
      </div>

      <Sheet open={Boolean(produto)} onOpenChange={(open) => !open && closeProduct()}>
        <SheetContent
          side="bottom"
          className="flex h-[92svh] flex-col gap-0 rounded-t-2xl px-4 pb-3"
        >
          <SheetHeader className="px-0">
            <SheetTitle className="sr-only">Detalhes do item</SheetTitle>
          </SheetHeader>
          {produto ? (
            <ProductConfigurator
              slug={slug}
              productId={produto}
              storeOpen={isOpen}
              onClose={closeProduct}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </main>
  );
}
