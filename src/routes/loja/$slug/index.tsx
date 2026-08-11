import { useEffect, useMemo, useState } from "react";
import { createFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router";
import { Clock, MapPin, Search, ShoppingBag, Store, X } from "lucide-react";

import { CartBar } from "@/components/storefront/CartBar";
import { OrderingContextBar } from "@/components/storefront/OrderingContextBar";
import { ProductConfigurator } from "@/components/storefront/ProductConfigurator";
import { WEEKDAY_LABELS, brl, foldText, shortTime } from "@/components/storefront/format";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PublicCatalog, PublicStorePayload } from "@/lib/storefront.server";
import { ThemeToggle } from "@/components/ThemeToggle";

const parentRoute = getRouteApi("/loja/$slug");

export const Route = createFileRoute("/loja/$slug/")({
  component: StorefrontPage,
});

function StorefrontPage() {
  const { store: storePayload, catalog } = parentRoute.useLoaderData() as {
    store: PublicStorePayload;
    catalog: PublicCatalog;
  };

  const { slug } = parentRoute.useParams();
  const { produto, linha } = parentRoute.useSearch();

  const navigate = useNavigate();
  const isMobile = useIsMobile();
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

  useEffect(() => {
    if (grouped.length === 0) return;
    const elements = grouped
      .map(({ category }) => document.getElementById(`categoria-${category.id}`))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const id = visible[0].target.getAttribute("data-category-id");
          if (id) setActiveCategory(id);
        }
      },
      { rootMargin: "-120px 0px -70% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [grouped]);

  const todayHours = hours.filter((h) => h.weekday === new Date().getDay());

  const openProduct = (id: string) =>
    navigate({ to: "/loja/$slug", params: { slug }, search: { produto: id } });
  const closeProduct = () =>
    navigate({ to: "/loja/$slug", params: { slug }, search: {}, replace: true });

  return (
    <main
      className="min-h-svh bg-background pb-28"
      style={
        {
          "--brand": settings.brand_primary,
          "--brand-accent": settings.brand_accent,
        } as React.CSSProperties
      }
    >
      <OrderingContextBar />

      <header className="relative">
        {settings.cover_url ? (
          <img
            src={settings.cover_url}
            alt=""
            className="h-40 w-full object-cover sm:h-60"
            fetchPriority="high"
          />
        ) : (
          <div
            className="h-32 w-full sm:h-44"
            style={{
              background: `linear-gradient(120deg, ${settings.brand_primary}, ${settings.brand_accent})`,
            }}
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-gradient-to-b from-transparent to-background/70" />

        <ThemeToggle className="absolute right-4 top-4 z-10 border-transparent bg-background/70 backdrop-blur sm:right-6" />

        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          <div className="-mt-12 flex min-w-0 items-end gap-4 rise-in">
            {settings.logo_url ? (
              <img
                src={settings.logo_url}
                alt={store.name}
                className="size-18 shrink-0 rounded-2xl border-4 sm:size-22 sm:rounded-3xl border-background object-cover shadow-e2"
              />
            ) : (
              <div className="grid size-18 shrink-0 place-items-center rounded-2xl border-4 sm:size-22 sm:rounded-3xl border-background bg-surface-muted shadow-e2">
                <Store className="size-8 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 pb-1.5">
              <h1 className="text-[clamp(1.375rem,5.2vw,2rem)] font-semibold leading-tight tracking-tight">{store.name}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {store.segment ? `${store.segment} · ` : ""}
                {store.city}/{store.state}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                isOpen
                  ? "bg-success-soft text-success"
                  : "bg-surface-muted text-muted-foreground"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${isOpen ? "bg-success" : "bg-muted-foreground"}`}
                aria-hidden="true"
              />
              {isOpen ? "Aberta agora" : "Fechada"}
            </span>
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
            <p className="mt-4 rounded-2xl border border-highlight/40 bg-highlight-soft p-4 text-sm text-highlight-soft-foreground">
              {settings.closed_message}
            </p>
          ) : null}
          {isOpen && settings.welcome_message ? (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {settings.welcome_message}
            </p>
          ) : null}
        </div>
      </header>

      <div className="sticky top-0 z-20 mt-6 border-b border-border/70 glass-bar">
        <div className="mx-auto max-w-3xl space-y-3 px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Buscar no cardápio"
              aria-label="Buscar no cardápio"
              className="h-12 rounded-full bg-card pl-10 shadow-e1"
            />
            {term ? (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          {grouped.length > 1 ? (
            <nav className="rail -mx-4 gap-2 px-4 pb-1 sm:-mx-6 sm:px-6">
              {grouped.map(({ category }) => (
                <a
                  key={category.id}
                  href={`#categoria-${category.id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    setActiveCategory(category.id);
                    document
                      .getElementById(`categoria-${category.id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`press shrink-0 rounded-full border px-3.5 py-1.5 text-sm ${
                    activeCategory === category.id
                      ? "border-transparent bg-primary font-semibold text-primary-foreground"
                      : "bg-card text-muted-foreground hover:border-border-strong hover:text-foreground"
                  }`}
                >
                  {category.name}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </div>


      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {grouped.length === 0 ? (
          <EmptyState
            className="mt-8"
            icon={ShoppingBag}
            title={term ? "Nenhum item encontrado" : "Cardápio em preparo"}
            description={
              term
                ? `Não achamos nada para “${term}”. Tente outra palavra ou veja todas as categorias.`
                : "Esta loja ainda não publicou itens no cardápio. Volte em instantes."
            }
            action={
              term ? (
                <Button variant="outline" size="sm" onClick={() => setTerm("")}>
                  Limpar busca
                </Button>
              ) : null
            }
          />
        ) : (
          grouped.map(({ category, items }) => (
            <Reveal
              as="section"
              key={category.id}
              id={`categoria-${category.id}`}
              data-category-id={category.id}
              className="scroll-mt-32 py-7"
            >
              <div className="flex items-baseline gap-3">
                <h2 className="text-lg font-semibold tracking-tight">{category.name}</h2>
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {items.length} {items.length === 1 ? "item" : "itens"}
                </span>
              </div>
              {category.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
              ) : null}

              <ul className="mt-4 space-y-3">
                {items.map((product, productIndex) => (
                  <Reveal as="li" key={product.id} delay={Math.min(productIndex, 6) * 55}>
                    <button
                      type="button"
                      onClick={() => openProduct(product.id)}
                      className="group hover-lift panel flex w-full items-center gap-4 p-3.5 text-left disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:shadow-e1"
                      disabled={product.is_sold_out}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate font-semibold">
                          {product.name}
                          {product.is_featured ? (
                            <span className="shrink-0 rounded-full bg-highlight-soft px-2 py-0.5 text-[11px] font-semibold text-highlight-soft-foreground">
                              Destaque
                            </span>
                          ) : null}
                        </p>
                        {product.description ? (
                          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                            {product.description}
                          </p>
                        ) : null}
                        <p
                          className={`mt-2 text-sm font-semibold tabular-nums ${
                            product.is_sold_out ? "text-muted-foreground" : "text-brand-soft-foreground"
                          }`}
                        >
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
                          className="size-18 shrink-0 rounded-xl object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04] sm:size-22"
                        />
                      ) : null}
                    </button>
                  </Reveal>
                ))}
              </ul>
            </Reveal>
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

      <CartBar slug={slug} />

      {isMobile ? (
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
                editLineId={linha ?? null}
                onClose={closeProduct}
              />
            ) : null}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={Boolean(produto)} onOpenChange={(open) => !open && closeProduct()}>
          <DialogContent className="flex h-[85svh] max-w-xl flex-col gap-0 overflow-hidden rounded-2xl p-4">
            <DialogHeader className="p-0">
              <DialogTitle className="sr-only">Detalhes do item</DialogTitle>
            </DialogHeader>
            {produto ? (
              <ProductConfigurator
                slug={slug}
                productId={produto}
                storeOpen={isOpen}
                editLineId={linha ?? null}
                onClose={closeProduct}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}
