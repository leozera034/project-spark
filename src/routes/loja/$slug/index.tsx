import { useEffect, useMemo, useState } from "react";
import { createFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router";
import { Clock, Flame, MapPin, Search, ShoppingBag, Store, X } from "lucide-react";

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
import type { PublicCatalog, PublicProductCard, PublicStorePayload } from "@/lib/storefront.server";
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

  const popularityById = useMemo(
    () => new Map(catalog.popularity.map((entry, index) => [entry.product_id, { ...entry, rank: index + 1 }])),
    [catalog.popularity],
  );

  const popularProducts = useMemo(
    () =>
      catalog.popularity
        .map((entry) => catalog.products.find((product) => product.id === entry.product_id) ?? null)
        .filter((product): product is PublicProductCard => Boolean(product) && !product.is_sold_out)
        .slice(0, 8),
    [catalog],
  );

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

  const scrollCategory = (id: string) => {
    setActiveCategory(id);
    document.getElementById(`categoria-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
          <img src={settings.cover_url} alt="" className="h-40 w-full object-cover sm:h-60" fetchPriority="high" />
        ) : (
          <div
            className="h-32 w-full sm:h-44"
            style={{ background: `linear-gradient(120deg, ${settings.brand_primary}, ${settings.brand_accent})` }}
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
                className="size-18 shrink-0 rounded-2xl border-4 border-background object-cover shadow-e2 sm:size-22 sm:rounded-3xl"
              />
            ) : (
              <div className="grid size-18 shrink-0 place-items-center rounded-2xl border-4 border-background bg-surface-muted shadow-e2 sm:size-22 sm:rounded-3xl">
                <Store className="size-8 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 pb-1.5">
              <h1 className="text-[clamp(1.375rem,5.2vw,2rem)] font-semibold leading-tight tracking-tight">{store.name}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {store.segment ? `${store.segment} · ` : ""}{store.city}/{store.state}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${isOpen ? "bg-success-soft text-success" : "bg-surface-muted text-muted-foreground"}`}>
              <span className={`size-1.5 rounded-full ${isOpen ? "bg-success" : "bg-muted-foreground"}`} aria-hidden="true" />
              {isOpen ? "Aberta agora" : "Fechada"}
            </span>
            {store.accepts_delivery ? <Badge variant="outline">Entrega</Badge> : null}
            {store.accepts_pickup ? <Badge variant="outline">Retirada</Badge> : null}
            {settings.min_order_amount > 0 ? <Badge variant="outline">Mínimo {brl(settings.min_order_amount)}</Badge> : null}
            <Badge variant="outline"><Clock className="mr-1 size-3" />~{settings.default_prep_minutes} min</Badge>
          </div>

          {!isOpen && settings.closed_message ? (
            <p className="mt-4 rounded-2xl border border-highlight/40 bg-highlight-soft p-4 text-sm text-highlight-soft-foreground">{settings.closed_message}</p>
          ) : null}
          {isOpen && settings.welcome_message ? (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{settings.welcome_message}</p>
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
              <button type="button" aria-label="Limpar busca" onClick={() => setTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground">
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          {grouped.length > 1 ? (
            <nav className="rail -mx-4 gap-2 px-4 pb-1 sm:-mx-6 sm:px-6">
              {grouped.map(({ category }) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => scrollCategory(category.id)}
                  className={`press shrink-0 rounded-full border px-3.5 py-1.5 text-sm ${activeCategory === category.id ? "border-transparent bg-primary font-semibold text-primary-foreground" : "bg-card text-muted-foreground hover:border-border-strong hover:text-foreground"}`}
                >
                  {category.name}
                </button>
              ))}
            </nav>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {!term && catalog.categories.length > 1 ? (
          <Reveal as="section" className="pt-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.12em] text-violet-300/80">Explore</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight">O que você quer hoje?</h2>
              </div>
              <span className="text-xs text-muted-foreground">{catalog.categories.length} categorias</span>
            </div>
            <div className="rail -mx-4 mt-4 gap-3 px-4 pb-2 sm:-mx-6 sm:px-6">
              {catalog.categories.map((category) => (
                <button key={category.id} type="button" onClick={() => scrollCategory(category.id)} className="group relative h-28 w-28 shrink-0 overflow-hidden rounded-[1.45rem] border border-violet-300/10 bg-card text-left shadow-e1 sm:h-32 sm:w-32">
                  {category.image_url ? (
                    <img src={category.image_url} alt="" className="absolute inset-0 size-full object-cover opacity-70 transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(217,70,239,.28),transparent_42%),linear-gradient(145deg,rgba(91,33,182,.28),rgba(10,7,16,.98))]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  <span className="absolute inset-x-3 bottom-3 line-clamp-2 text-sm font-bold leading-tight text-white">{category.name}</span>
                </button>
              ))}
            </div>
          </Reveal>
        ) : null}

        {!term && popularProducts.length >= 2 ? (
          <Reveal as="section" className="pt-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[.12em] text-fuchsia-300/85"><Flame className="size-3.5" />Escolhas reais</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight">Mais pedidos</h2>
                <p className="mt-1 text-xs text-muted-foreground">Ranking dos últimos 60 dias com base em pedidos confirmados.</p>
              </div>
            </div>
            <div className="rail -mx-4 mt-4 gap-3 px-4 pb-2 sm:-mx-6 sm:px-6">
              {popularProducts.map((product) => {
                const popularity = popularityById.get(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => openProduct(product.id)}
                    className="group relative w-[72vw] max-w-[17rem] shrink-0 overflow-hidden rounded-[1.65rem] border border-violet-300/12 bg-[#120b1b] text-left shadow-[0_22px_60px_-40px_rgba(168,85,247,.8)]"
                  >
                    <div className="relative aspect-[1.45/1] overflow-hidden bg-white/[.025]">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="size-full bg-[radial-gradient(circle_at_75%_15%,rgba(217,70,239,.25),transparent_44%),linear-gradient(145deg,#20102f,#0b0710)]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#120b1b] via-transparent to-transparent" />
                      <span className="absolute left-3 top-3 grid size-8 place-items-center rounded-full border border-white/10 bg-black/55 text-sm font-black text-white backdrop-blur">{popularity?.rank ?? "•"}</span>
                    </div>
                    <div className="p-4">
                      <p className="truncate font-bold tracking-tight">{product.name}</p>
                      {product.description ? <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/50">{product.description}</p> : null}
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-sm font-extrabold text-violet-200">{product.has_variants && product.from_price !== null ? `a partir de ${brl(product.from_price)}` : brl(product.base_price)}</span>
                        <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-lg font-medium text-white shadow-lg">+</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Reveal>
        ) : null}

        {grouped.length === 0 ? (
          <EmptyState
            className="mt-8"
            icon={ShoppingBag}
            title={term ? "Nenhum item encontrado" : "Cardápio em preparo"}
            description={term ? `Não achamos nada para “${term}”. Tente outra palavra ou veja todas as categorias.` : "Esta loja ainda não publicou itens no cardápio. Volte em instantes."}
            action={term ? <Button variant="outline" size="sm" onClick={() => setTerm("")}>Limpar busca</Button> : null}
          />
        ) : (
          grouped.map(({ category, items }) => (
            <Reveal as="section" key={category.id} id={`categoria-${category.id}`} data-category-id={category.id} className="scroll-mt-32 py-7">
              <div className="flex items-baseline gap-3">
                <h2 className="text-lg font-semibold tracking-tight">{category.name}</h2>
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
                <span className="text-xs font-medium text-muted-foreground tabular-nums">{items.length} {items.length === 1 ? "item" : "itens"}</span>
              </div>
              {category.description ? <p className="mt-1 text-sm text-muted-foreground">{category.description}</p> : null}
              <ul className="mt-4 space-y-3">
                {items.map((product, productIndex) => (
                  <Reveal as="li" key={product.id} delay={Math.min(productIndex, 6) * 55}>
                    <ProductRow product={product} rank={popularityById.get(product.id)?.rank ?? null} onOpen={() => openProduct(product.id)} />
                  </Reveal>
                ))}
              </ul>
            </Reveal>
          ))
        )}

        <Separator className="my-6" />
        <footer className="space-y-4 pb-10 text-sm text-muted-foreground">
          {store.address_line ? <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0" />{store.address_line} — {store.city}/{store.state}</p> : null}
          {todayHours.length > 0 ? (
            <p className="flex items-start gap-2"><Clock className="mt-0.5 size-4 shrink-0" />{WEEKDAY_LABELS[new Date().getDay()]}: {todayHours.map((h) => `${shortTime(h.opens_at)} às ${shortTime(h.closes_at)}`).join(", ")}</p>
          ) : null}
          <p className="text-xs">Cardápio digital Pediu Aqui.</p>
        </footer>
      </div>

      <CartBar slug={slug} />

      {isMobile ? (
        <Sheet open={Boolean(produto)} onOpenChange={(open) => !open && closeProduct()}>
          <SheetContent side="bottom" className="flex h-[92svh] flex-col gap-0 rounded-t-2xl px-4 pb-3">
            <SheetHeader className="px-0"><SheetTitle className="sr-only">Detalhes do item</SheetTitle></SheetHeader>
            {produto ? <ProductConfigurator slug={slug} productId={produto} storeOpen={isOpen} editLineId={linha ?? null} onClose={closeProduct} /> : null}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={Boolean(produto)} onOpenChange={(open) => !open && closeProduct()}>
          <DialogContent className="flex h-[85svh] max-w-xl flex-col gap-0 overflow-hidden rounded-2xl p-4">
            <DialogHeader className="p-0"><DialogTitle className="sr-only">Detalhes do item</DialogTitle></DialogHeader>
            {produto ? <ProductConfigurator slug={slug} productId={produto} storeOpen={isOpen} editLineId={linha ?? null} onClose={closeProduct} /> : null}
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}

function ProductRow({ product, rank, onOpen }: { product: PublicProductCard; rank: number | null; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group hover-lift panel flex w-full items-center gap-4 p-3.5 text-left disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:shadow-e1"
      disabled={product.is_sold_out}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate font-semibold">
          {product.name}
          {product.is_featured ? <span className="shrink-0 rounded-full bg-highlight-soft px-2 py-0.5 text-[11px] font-semibold text-highlight-soft-foreground">Destaque</span> : null}
          {rank && rank <= 3 ? <span className="shrink-0 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-300">Top {rank}</span> : null}
        </p>
        {product.description ? <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{product.description}</p> : null}
        <p className={`mt-2 text-sm font-semibold tabular-nums ${product.is_sold_out ? "text-muted-foreground" : "text-brand-soft-foreground"}`}>
          {product.is_sold_out ? "Esgotado" : product.from_price !== null && product.has_variants ? `a partir de ${brl(product.from_price)}` : brl(product.base_price)}
        </p>
      </div>
      {product.image_url ? <img src={product.image_url} alt="" loading="lazy" decoding="async" className="size-18 shrink-0 rounded-xl object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04] sm:size-22" /> : null}
    </button>
  );
}
