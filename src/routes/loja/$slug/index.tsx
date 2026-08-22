import { useEffect, useMemo, useState } from "react";
import { createFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router";
import {
  Beef,
  Bike,
  Clock,
  Coffee,
  Flame,
  Gift,
  IceCreamBowl,
  MapPin,
  Pizza,
  Search,
  ShoppingBag,
  ShoppingBasket,
  Star,
  Store,
  UtensilsCrossed,
  Wine,
  X,
} from "lucide-react";

import { CartBar } from "@/components/storefront/CartBar";
import { OrderingContextBar } from "@/components/storefront/OrderingContextBar";
import { ProductConfigurator } from "@/components/storefront/ProductConfigurator";
import { StorefrontIdentityMark } from "@/components/storefront/StorefrontIdentityMark";
import { WEEKDAY_LABELS, brl, foldText, shortTime } from "@/components/storefront/format";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PublicCatalog, PublicStorePayload } from "@/lib/storefront.server";
import {
  getDefaultStoreBanner,
  getStorefrontThemeVisual,
  resolveStorefrontThemeProfile,
} from "@/storefront/default-banners";

const parentRoute = getRouteApi("/loja/$slug");

export const Route = createFileRoute("/loja/$slug/")({
  component: StorefrontPage,
});

function categoryIconForName(name: string) {
  const folded = foldText(name);
  if (folded.includes("destaque")) return Star;
  if (folded.includes("mais pedido") || folded.includes("popular")) return Flame;
  if (folded.includes("combo")) return Gift;
  return null;
}

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
  const profile = resolveStorefrontThemeProfile(store.segment);
  const effectiveCoverUrl = settings.cover_url || getDefaultStoreBanner(profile);
  const visual = getStorefrontThemeVisual(profile);

  const ProductFallbackIcon =
    profile === "pizzaria"
      ? Pizza
      : profile === "hamburgueria"
        ? Beef
        : profile === "acai" || profile === "sorveteria"
          ? IceCreamBowl
          : profile === "adega"
            ? Wine
            : profile === "mercado"
              ? ShoppingBasket
              : profile === "lanchonete"
                ? Coffee
                : profile === "restaurante" || profile === "pastelaria"
                  ? UtensilsCrossed
                  : Store;

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
      { rootMargin: "-190px 0px -70% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [grouped]);

  const todayHours = hours.filter((h) => h.weekday === new Date().getDay());

  const openProduct = (id: string) =>
    navigate({ to: "/loja/$slug", params: { slug }, search: { produto: id } });
  const closeProduct = () =>
    navigate({ to: "/loja/$slug", params: { slug }, search: {}, replace: true });

  const storefrontStyle = {
    "--brand": visual.brand,
    "--brand-accent": visual.brand,
    "--background": "#fffaf5",
    "--foreground": "#2b1813",
    "--muted-foreground": "#705d56",
    "--card": "#ffffff",
    "--card-foreground": "#2b1813",
    "--border": "rgba(82,55,43,.14)",
    "--input": "rgba(82,55,43,.16)",
    "--ring": visual.brand,
  } as React.CSSProperties;

  return (
    <main
      className="storefront-global min-h-svh bg-background pb-[calc(7rem+env(safe-area-inset-bottom))] text-foreground"
      style={storefrontStyle}
    >
      <OrderingContextBar />

      <header className="relative overflow-hidden">
        <div className="relative h-[236px] sm:h-[300px]">
          <img
            src={effectiveCoverUrl}
            alt=""
            className="size-full object-cover"
            fetchPriority="high"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/12" />
          <svg
            aria-hidden="true"
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute -bottom-px left-0 h-12 w-full sm:h-16"
          >
            <path d="M0 28 C180 72 386 83 585 60 C760 40 862 31 1000 45 V100 H0 Z" fill="var(--background)" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          <div className="-mt-[54px] w-fit shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-300 sm:-mt-[62px]">
            <StorefrontIdentityMark
              segment={profile}
              storeName={store.name}
              logoUrl={settings.logo_url}
            />
          </div>
          <div className="mt-3 min-w-0">
            <h1 className="line-clamp-2 text-[clamp(1.65rem,6vw,2.35rem)] font-black leading-[1.02] tracking-[-0.035em] text-foreground">
              {store.name}
            </h1>
            <p className="mt-1 truncate text-sm font-medium text-muted-foreground sm:text-base">
              {store.segment ? `${store.segment} · ` : ""}
              {store.city}/{store.state}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <span
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-[0_5px_14px_rgba(40,24,15,.04)] ${
                isOpen
                  ? "border-emerald-600/20 bg-emerald-50 text-emerald-700"
                  : "border-black/10 bg-white text-muted-foreground"
              }`}
            >
              <span className={`size-2 rounded-full ${isOpen ? "bg-emerald-500" : "bg-muted-foreground"}`} />
              {isOpen ? "Aberta agora" : "Fechada"}
            </span>
            {store.accepts_delivery ? (
              <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-black/8 bg-white/75 px-3.5 py-1.5 text-xs font-bold shadow-sm">
                <Bike className="size-3.5 text-brand" />Entrega
              </span>
            ) : null}
            {store.accepts_pickup ? (
              <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-black/8 bg-white/75 px-3.5 py-1.5 text-xs font-bold shadow-sm">
                <ShoppingBag className="size-3.5 text-brand" />Retirada
              </span>
            ) : null}
            {settings.min_order_amount > 0 ? (
              <span className="inline-flex min-h-9 items-center rounded-full border border-black/8 bg-white/75 px-3.5 py-1.5 text-xs font-bold shadow-sm">Mínimo {brl(settings.min_order_amount)}</span>
            ) : null}
            <span className="inline-flex min-h-9 items-center rounded-full border border-black/8 bg-white/75 px-3.5 py-1.5 text-xs font-bold shadow-sm">
              <Clock className="mr-1 size-3.5" />~{settings.default_prep_minutes} min
            </span>
          </div>

          {!isOpen && settings.closed_message ? (
            <p className="mt-5 rounded-2xl border border-highlight/25 bg-white p-4 text-sm font-medium text-foreground shadow-sm">
              {settings.closed_message}
            </p>
          ) : (
            <p className="mt-5 text-[15px] font-medium leading-relaxed text-foreground/82 sm:text-base">
              {settings.welcome_message || "Bem-vindo! Escolha seus favoritos e monte o pedido do seu jeito."}
            </p>
          )}
        </div>
      </header>

      <div className="sticky top-[60px] z-20 mt-5 border-b border-black/5 bg-background/94 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl space-y-3.5 px-4 py-3.5 sm:px-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-foreground/65" />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Buscar no cardápio"
              aria-label="Buscar no cardápio"
              className="h-14 rounded-2xl border-black/8 bg-white pl-12 pr-11 text-[15px] font-medium text-black shadow-[0_8px_24px_rgba(74,43,29,.08)] placeholder:text-black/42 focus-visible:ring-brand"
            />
            {term ? (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setTerm("")}
                className="absolute right-2.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          {grouped.length > 1 ? (
            <nav className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6" aria-label="Categorias">
              {grouped.map(({ category }, index) => {
                const active = activeCategory ? activeCategory === category.id : index === 0;
                const CategoryIcon = categoryIconForName(category.name);
                return (
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
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-all duration-200 ${
                      active
                        ? "border-brand bg-brand text-brand-foreground shadow-[0_6px_16px_color-mix(in_srgb,var(--brand)_20%,transparent)]"
                        : "border-black/7 bg-white/70 text-foreground hover:-translate-y-0.5 hover:bg-white"
                    }`}
                  >
                    {CategoryIcon ? <CategoryIcon className="size-4" /> : null}
                    {category.name}
                  </a>
                );
              })}
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
              className="scroll-mt-48 py-8"
            >
              <div className="flex items-end gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-black tracking-[-0.025em] text-foreground sm:text-2xl">{category.name}</h2>
                  {category.description ? (
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{category.description}</p>
                  ) : null}
                </div>
                <span className="shrink-0 pb-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
                  {items.length} {items.length === 1 ? "item" : "itens"}
                </span>
              </div>

              <ul className="mt-4 space-y-3">
                {items.map((product, productIndex) => (
                  <Reveal as="li" key={product.id} delay={Math.min(productIndex, 6) * 45}>
                    <button
                      type="button"
                      onClick={() => openProduct(product.id)}
                      className="group flex w-full items-center gap-3 rounded-2xl border border-black/[0.055] bg-white p-3.5 text-left shadow-[0_8px_22px_rgba(61,37,25,.07)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(61,37,25,.10)] sm:gap-4 sm:p-4 disabled:opacity-55 disabled:hover:translate-y-0"
                      disabled={product.is_sold_out}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-start gap-2">
                          <p className="line-clamp-2 min-w-0 flex-1 text-[15px] font-extrabold leading-snug text-foreground sm:text-base">
                            {product.name}
                          </p>
                          {product.is_featured ? (
                            <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-bold text-brand sm:text-[11px]">
                              Destaque
                            </span>
                          ) : null}
                        </div>
                        {product.description ? (
                          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                            {product.description}
                          </p>
                        ) : null}
                        <p className={`mt-2 text-sm font-extrabold tabular-nums ${product.is_sold_out ? "text-muted-foreground" : "text-brand"}`}>
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
                          className="size-20 shrink-0 rounded-2xl object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025] sm:size-24"
                        />
                      ) : (
                        <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand sm:size-24">
                          <ProductFallbackIcon className="size-7 sm:size-8" strokeWidth={1.8} />
                        </div>
                      )}
                    </button>
                  </Reveal>
                ))}
              </ul>
            </Reveal>
          ))
        )}

        <Separator className="my-6 bg-black/8" />

        <footer className="space-y-4 pb-10 text-sm text-muted-foreground">
          {store.address_line ? (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">{store.address_line} — {store.city}/{store.state}</span>
            </p>
          ) : null}
          {todayHours.length > 0 ? (
            <p className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0" />
              <span>
                {WEEKDAY_LABELS[new Date().getDay()]}:{" "}
                {todayHours
                  .map((h) => `${shortTime(h.opens_at)} às ${shortTime(h.closes_at)}`)
                  .join(", ")}
              </span>
            </p>
          ) : null}
          <div className="flex flex-col gap-2 border-t border-black/5 pt-5 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p>Cardápio digital com Comandiva.</p>
            <a href="/criar-loja" className="font-bold text-brand transition-opacity hover:opacity-75">
              Tem uma loja? Crie seu cardápio no Comandiva →
            </a>
          </div>
        </footer>
      </div>

      <CartBar slug={slug} />

      {isMobile ? (
        <Sheet open={Boolean(produto)} onOpenChange={(open) => !open && closeProduct()}>
          <SheetContent
            side="bottom"
            className="flex h-[min(92dvh,52rem)] max-h-[calc(100dvh-env(safe-area-inset-top))] flex-col gap-0 rounded-t-2xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
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
          <DialogContent className="flex h-[min(85dvh,52rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-2xl p-4">
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
