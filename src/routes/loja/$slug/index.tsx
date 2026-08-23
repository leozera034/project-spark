import { useEffect, useMemo, useState } from "react";
import { createFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router";
import {
  Beef,
  Bike,
  Clock,
  Coffee,
  Flame,
  Gift,
  Heart,
  History,
  IceCreamBowl,
  MapPin,
  Pizza,
  Plus,
  Search,
  ShoppingBag,
  ShoppingBasket,
  Star,
  Store,
  UtensilsCrossed,
  Wine,
  X,
  type LucideIcon,
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
import { useStorefrontPreferences } from "@/storefront/preferences/storefront-preferences";

const parentRoute = getRouteApi("/loja/$slug");
type CatalogProduct = PublicCatalog["products"][number];
type MerchandisedProduct = CatalogProduct & {
  category_ids?: string[];
  original_base_price?: number;
  original_from_price?: number | null;
  promotion_id?: string;
  promotion_name?: string | null;
  promotion_kind?: "percentual" | "valor_fixo";
  promotion_value?: number;
  promotion_discount_total?: number;
  promotion_scope?: "store" | "category" | "product";
};

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

function promotionFor(product: CatalogProduct) {
  const merch = product as MerchandisedProduct;
  if (!merch.promotion_name || Number(merch.promotion_discount_total ?? 0) <= 0) return null;
  return merch;
}

function productAppearsInCategory(product: CatalogProduct, categoryId: string) {
  const categoryIds = (product as MerchandisedProduct).category_ids;
  return Array.isArray(categoryIds) && categoryIds.length > 0
    ? categoryIds.includes(categoryId)
    : product.category_id === categoryId;
}

function currentPriceLabel(product: CatalogProduct) {
  return product.from_price !== null && product.has_variants
    ? `a partir de ${brl(product.from_price)}`
    : brl(product.base_price);
}

function originalPriceLabel(product: CatalogProduct, merch: MerchandisedProduct) {
  if (product.has_variants) {
    const value = merch.original_from_price;
    return value === null || value === undefined ? null : `a partir de ${brl(value)}`;
  }
  return merch.original_base_price === undefined ? null : brl(merch.original_base_price);
}

function ProductRail({
  eyebrow,
  title,
  description,
  icon: Icon,
  products,
  fallbackIcon: FallbackIcon,
  onOpen,
  isFavorite,
  onToggleFavorite,
}: {
  eyebrow: string;
  title: string;
  description?: string | null;
  icon: LucideIcon;
  products: CatalogProduct[];
  fallbackIcon: LucideIcon;
  onOpen: (id: string) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
}) {
  if (products.length === 0) return null;

  return (
    <section className="mx-auto max-w-3xl pt-7" aria-label={title}>
      <div className="flex items-end justify-between gap-3 px-4 sm:px-6">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[.12em] text-brand">
            <Icon className="size-4" /> {eyebrow}
          </p>
          <h2 className="mt-1 text-xl font-black tracking-[-.025em]">{title}</h2>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>

      <div className="mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:px-6">
        {products.map((product) => {
          const favorite = isFavorite(product.id);
          const promotion = promotionFor(product);
          const originalLabel = promotion ? originalPriceLabel(product, promotion) : null;
          return (
            <div key={product.id} className="relative w-[172px] shrink-0 snap-start sm:w-[190px]">
              <button
                type="button"
                onClick={() => onOpen(product.id)}
                disabled={product.is_sold_out}
                aria-label={product.is_sold_out ? `${product.name}, esgotado` : `Abrir ${product.name}`}
                className="group w-full overflow-hidden rounded-2xl border border-black/[.06] bg-white text-left shadow-[0_8px_22px_rgba(61,37,25,.07)] transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-default disabled:opacity-65 disabled:hover:translate-y-0"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-brand/8">
                  {product.image_url ? (
                    <img src={product.image_url} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="grid size-full place-items-center text-brand"><FallbackIcon className="size-9" strokeWidth={1.7} /></div>
                  )}
                  {promotion ? (
                    <span className="absolute left-2 top-2 inline-flex max-w-[calc(100%-3.5rem)] items-center gap-1 truncate rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-black text-white shadow-sm"><Gift className="size-3 shrink-0" /> {promotion.promotion_name}</span>
                  ) : product.is_best_seller ? (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/94 px-2 py-1 text-[10px] font-black text-brand shadow-sm"><Flame className="size-3" /> Mais pedido</span>
                  ) : null}
                  {product.is_sold_out ? <span className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2 py-1 text-[10px] font-black text-white">Esgotado</span> : null}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 min-h-10 text-sm font-extrabold leading-snug">{product.name}</p>
                  {product.is_sold_out ? (
                    <p className="mt-2 text-sm font-black text-muted-foreground">Indisponível</p>
                  ) : promotion ? (
                    <div className="mt-2">
                      {originalLabel ? <p className="text-[11px] font-semibold text-muted-foreground line-through tabular-nums">{originalLabel}</p> : null}
                      <p className="text-sm font-black text-emerald-700 tabular-nums">{currentPriceLabel(product)}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm font-black text-brand tabular-nums">{currentPriceLabel(product)}</p>
                  )}
                </div>
              </button>

              <button
                type="button"
                aria-pressed={favorite}
                aria-label={favorite ? `Remover ${product.name} dos favoritos` : `Adicionar ${product.name} aos favoritos`}
                onClick={() => onToggleFavorite(product.id)}
                className="absolute right-2 top-2 z-10 grid size-11 place-items-center rounded-full border border-black/8 bg-white/95 text-foreground shadow-sm backdrop-blur transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Heart className={`size-5 ${favorite ? "fill-brand text-brand" : "text-foreground/70"}`} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
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
  const preferences = useStorefrontPreferences(slug);
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
        items: filtered.filter((p) => productAppearsInCategory(p, category.id)),
      }))
      .filter((entry) => entry.items.length > 0);
  }, [catalog, term]);

  const searchResultCount = useMemo(() => {
    const needle = foldText(term);
    if (!needle) return catalog.products.length;
    return catalog.products.filter(
      (product) =>
        foldText(product.name).includes(needle) ||
        foldText(product.description ?? "").includes(needle),
    ).length;
  }, [catalog.products, term]);

  const productById = useMemo(
    () => new Map(catalog.products.map((product) => [product.id, product] as const)),
    [catalog.products],
  );
  const promotionalProducts = useMemo(
    () => catalog.products
      .filter((product) => Boolean(promotionFor(product)))
      .sort((a, b) => Number((b as MerchandisedProduct).promotion_discount_total ?? 0) - Number((a as MerchandisedProduct).promotion_discount_total ?? 0))
      .slice(0, 8),
    [catalog.products],
  );
  const favoriteProducts = useMemo(
    () => preferences.favoriteProductIds.map((id) => productById.get(id)).filter((product): product is CatalogProduct => Boolean(product)).slice(0, 8),
    [preferences.favoriteProductIds, productById],
  );
  const recentProducts = useMemo(
    () => preferences.recentProductIds.map((id) => productById.get(id)).filter((product): product is CatalogProduct => Boolean(product)).slice(0, 8),
    [preferences.recentProductIds, productById],
  );
  const bestSellers = useMemo(
    () => catalog.products.filter((product) => product.is_best_seller).slice(0, 5),
    [catalog.products],
  );
  const featuredProducts = useMemo(
    () => catalog.products.filter((product) => product.is_featured).slice(0, 6),
    [catalog.products],
  );
  const spotlightProducts = bestSellers.length > 0 ? bestSellers : featuredProducts;
  const spotlightTitle = bestSellers.length > 0 ? "Mais pedidos" : "Destaques da casa";

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

  useEffect(() => {
    if (grouped.length === 0) {
      setActiveCategory(null);
      return;
    }
    if (!activeCategory || !grouped.some(({ category }) => category.id === activeCategory)) {
      setActiveCategory(grouped[0].category.id);
    }
  }, [activeCategory, grouped]);

  const todayHours = hours.filter((h) => h.weekday === new Date().getDay());

  const openProduct = (id: string) => {
    preferences.rememberViewed(id);
    void navigate({ to: "/loja/$slug", params: { slug }, search: { produto: id } });
  };
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
            <StorefrontIdentityMark segment={profile} storeName={store.name} logoUrl={settings.logo_url} />
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
            <span className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-[0_5px_14px_rgba(40,24,15,.04)] ${isOpen ? "border-emerald-600/20 bg-emerald-50 text-emerald-700" : "border-black/10 bg-white text-muted-foreground"}`}>
              <span className={`size-2 rounded-full ${isOpen ? "bg-emerald-500" : "bg-muted-foreground"}`} />
              {isOpen ? "Aberta agora" : "Fechada"}
            </span>
            {store.accepts_delivery ? <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-black/8 bg-white/75 px-3.5 py-1.5 text-xs font-bold shadow-sm"><Bike className="size-3.5 text-brand" />Entrega</span> : null}
            {store.accepts_pickup ? <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-black/8 bg-white/75 px-3.5 py-1.5 text-xs font-bold shadow-sm"><ShoppingBag className="size-3.5 text-brand" />Retirada</span> : null}
            {settings.min_order_amount > 0 ? <span className="inline-flex min-h-9 items-center rounded-full border border-black/8 bg-white/75 px-3.5 py-1.5 text-xs font-bold shadow-sm">Mínimo {brl(settings.min_order_amount)}</span> : null}
            <span className="inline-flex min-h-9 items-center rounded-full border border-black/8 bg-white/75 px-3.5 py-1.5 text-xs font-bold shadow-sm"><Clock className="mr-1 size-3.5" />~{settings.default_prep_minutes} min</span>
          </div>

          {!isOpen && settings.closed_message ? (
            <p className="mt-5 rounded-2xl border border-highlight/25 bg-white p-4 text-sm font-medium text-foreground shadow-sm">{settings.closed_message}</p>
          ) : (
            <p className="mt-5 text-[15px] font-medium leading-relaxed text-foreground/82 sm:text-base">{settings.welcome_message || "Bem-vindo! Escolha seus favoritos e monte o pedido do seu jeito."}</p>
          )}
        </div>
      </header>

      <div className="sticky top-[62px] z-20 mt-5 border-b border-black/5 bg-background/94 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl space-y-3.5 px-4 py-3.5 sm:px-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-foreground/65" />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Buscar prato, bebida ou ingrediente"
              aria-label="Buscar no cardápio"
              className="h-14 rounded-2xl border-black/8 bg-white pl-12 pr-11 text-[15px] font-medium text-black shadow-[0_8px_24px_rgba(74,43,29,.08)] placeholder:text-black/42 focus-visible:ring-brand"
            />
            {term ? (
              <button type="button" aria-label="Limpar busca" onClick={() => setTerm("")} className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground">
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          {term ? (
            <p className="px-1 text-xs font-semibold text-muted-foreground" aria-live="polite">
              {searchResultCount} {searchResultCount === 1 ? "resultado" : "resultados"} para “{term.trim()}”
            </p>
          ) : null}

          {grouped.length > 1 ? (
            <nav className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6" aria-label="Categorias">
              {grouped.map(({ category }, index) => {
                const active = activeCategory ? activeCategory === category.id : index === 0;
                const CategoryIcon = categoryIconForName(category.name);
                return (
                  <a
                    key={category.id}
                    href={`#categoria-${category.id}`}
                    aria-current={active ? "true" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      setActiveCategory(category.id);
                      document.getElementById(`categoria-${category.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-all duration-200 ${active ? "border-brand bg-brand text-brand-foreground shadow-[0_6px_16px_color-mix(in_srgb,var(--brand)_20%,transparent)]" : "border-black/7 bg-white/70 text-foreground hover:-translate-y-0.5 hover:bg-white"}`}
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

      {!term && promotionalProducts.length > 0 ? (
        <ProductRail
          eyebrow="Preço especial agora"
          title="Ofertas ativas"
          description="Descontos válidos agora e confirmados novamente no servidor antes do pedido."
          icon={Gift}
          products={promotionalProducts}
          fallbackIcon={ProductFallbackIcon}
          onOpen={openProduct}
          isFavorite={preferences.isFavorite}
          onToggleFavorite={preferences.toggleFavorite}
        />
      ) : null}

      {!term && favoriteProducts.length > 0 ? (
        <ProductRail
          eyebrow="Salvos neste aparelho"
          title="Seus favoritos"
          description={`${favoriteProducts.length} ${favoriteProducts.length === 1 ? "item salvo" : "itens salvos"} nesta loja.`}
          icon={Heart}
          products={favoriteProducts}
          fallbackIcon={ProductFallbackIcon}
          onOpen={openProduct}
          isFavorite={preferences.isFavorite}
          onToggleFavorite={preferences.toggleFavorite}
        />
      ) : null}

      {!term && recentProducts.length >= 2 ? (
        <ProductRail
          eyebrow="Continue de onde parou"
          title="Vistos recentemente"
          description="Atalhos guardados somente neste aparelho."
          icon={History}
          products={recentProducts}
          fallbackIcon={ProductFallbackIcon}
          onOpen={openProduct}
          isFavorite={preferences.isFavorite}
          onToggleFavorite={preferences.toggleFavorite}
        />
      ) : null}

      {!term && spotlightProducts.length > 0 ? (
        <ProductRail
          eyebrow="Preferidos dos clientes"
          title={spotlightTitle}
          description={bestSellers.length > 0 ? "Calculado pelas vendas reais dos últimos 30 dias." : null}
          icon={Flame}
          products={spotlightProducts}
          fallbackIcon={ProductFallbackIcon}
          onOpen={openProduct}
          isFavorite={preferences.isFavorite}
          onToggleFavorite={preferences.toggleFavorite}
        />
      ) : null}

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
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
            <Reveal as="section" key={category.id} id={`categoria-${category.id}`} data-category-id={category.id} className="scroll-mt-52 py-8">
              <div className="flex items-end gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-black tracking-[-0.025em] text-foreground sm:text-2xl">{category.name}</h2>
                  {category.description ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{category.description}</p> : null}
                </div>
                <span className="shrink-0 pb-0.5 text-xs font-semibold text-muted-foreground tabular-nums">{items.length} {items.length === 1 ? "item" : "itens"}</span>
              </div>

              <ul className="mt-4 space-y-3">
                {items.map((product, productIndex) => {
                  const favorite = preferences.isFavorite(product.id);
                  const promotion = promotionFor(product);
                  const originalLabel = promotion ? originalPriceLabel(product, promotion) : null;
                  return (
                    <Reveal as="li" key={product.id} delay={Math.min(productIndex, 6) * 45}>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => openProduct(product.id)}
                          aria-label={product.is_sold_out ? `${product.name}, esgotado` : `Abrir ${product.name}`}
                          className="group flex w-full items-center gap-3 rounded-2xl border border-black/[0.055] bg-white p-3.5 text-left shadow-[0_8px_22px_rgba(61,37,25,.07)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(61,37,25,.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:gap-4 sm:p-4 disabled:opacity-55 disabled:hover:translate-y-0"
                          disabled={product.is_sold_out}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-start gap-2">
                              <p className="line-clamp-2 min-w-0 flex-1 text-[15px] font-extrabold leading-snug text-foreground sm:text-base">{product.name}</p>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                {promotion ? <span className="inline-flex max-w-32 items-center gap-1 truncate rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 sm:text-[11px]"><Gift className="size-3 shrink-0" /> {promotion.promotion_name}</span> : null}
                                {product.is_best_seller ? <span className="inline-flex items-center gap-1 rounded-full bg-highlight-soft px-2.5 py-1 text-[10px] font-black text-highlight-soft-foreground sm:text-[11px]"><Flame className="size-3" /> Mais pedido</span> : null}
                                {product.is_featured ? <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-bold text-brand sm:text-[11px]">Destaque</span> : null}
                              </div>
                            </div>
                            {product.description ? <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{product.description}</p> : null}
                            <div className="mt-2 flex flex-wrap items-end gap-x-2 gap-y-1">
                              {product.is_sold_out ? (
                                <p className="text-sm font-extrabold text-muted-foreground">Esgotado</p>
                              ) : promotion ? (
                                <div>
                                  {originalLabel ? <p className="text-[11px] font-semibold text-muted-foreground line-through tabular-nums">{originalLabel}</p> : null}
                                  <p className="text-sm font-extrabold text-emerald-700 tabular-nums">{currentPriceLabel(product)}</p>
                                </div>
                              ) : (
                                <p className="text-sm font-extrabold text-brand tabular-nums">{currentPriceLabel(product)}</p>
                              )}
                              {!product.is_sold_out ? <span className="pb-0.5 text-[11px] font-semibold text-muted-foreground">{product.has_variants || product.has_options ? "Escolher opções" : "Adicionar ao pedido"}</span> : null}
                            </div>
                          </div>

                          <div className="relative shrink-0">
                            {product.image_url ? (
                              <img src={product.image_url} alt="" loading="lazy" decoding="async" className="size-20 rounded-2xl object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025] sm:size-24" />
                            ) : (
                              <div className="grid size-20 place-items-center rounded-2xl bg-brand/10 text-brand sm:size-24"><ProductFallbackIcon className="size-7 sm:size-8" strokeWidth={1.8} /></div>
                            )}
                            {!product.is_sold_out ? (
                              <span className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full border-2 border-white bg-brand text-brand-foreground shadow-md transition-transform group-hover:scale-105" aria-hidden="true">
                                <Plus className="size-4" strokeWidth={2.5} />
                              </span>
                            ) : null}
                          </div>
                        </button>

                        <button
                          type="button"
                          aria-pressed={favorite}
                          aria-label={favorite ? `Remover ${product.name} dos favoritos` : `Adicionar ${product.name} aos favoritos`}
                          onClick={() => preferences.toggleFavorite(product.id)}
                          className="absolute right-2 top-2 z-10 grid size-11 place-items-center rounded-full border border-black/8 bg-white/95 text-foreground shadow-sm backdrop-blur transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:right-3 sm:top-3"
                        >
                          <Heart className={`size-5 ${favorite ? "fill-brand text-brand" : "text-foreground/70"}`} />
                        </button>
                      </div>
                    </Reveal>
                  );
                })}
              </ul>
            </Reveal>
          ))
        )}

        <Separator className="my-6 bg-black/8" />

        <footer className="space-y-4 pb-10 text-sm text-muted-foreground">
          {store.address_line ? <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0" /><span className="min-w-0">{store.address_line} — {store.city}/{store.state}</span></p> : null}
          {todayHours.length > 0 ? (
            <p className="flex items-start gap-2"><Clock className="mt-0.5 size-4 shrink-0" /><span>{WEEKDAY_LABELS[new Date().getDay()]}: {todayHours.map((h) => `${shortTime(h.opens_at)} às ${shortTime(h.closes_at)}`).join(", ")}</span></p>
          ) : null}
          <div className="flex flex-col gap-2 border-t border-black/5 pt-5 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p>Cardápio digital com Comandiva.</p>
            <a href="/criar-loja" className="font-bold text-brand transition-opacity hover:opacity-75">Tem uma loja? Crie seu cardápio no Comandiva →</a>
          </div>
        </footer>
      </div>

      <CartBar slug={slug} />

      {isMobile ? (
        <Sheet open={Boolean(produto)} onOpenChange={(open) => !open && closeProduct()}>
          <SheetContent side="bottom" className="flex h-[min(92dvh,52rem)] max-h-[calc(100dvh-env(safe-area-inset-top))] flex-col gap-0 rounded-t-2xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <SheetHeader className="px-0"><SheetTitle className="sr-only">Detalhes do item</SheetTitle></SheetHeader>
            {produto ? <ProductConfigurator slug={slug} productId={produto} storeOpen={isOpen} editLineId={linha ?? null} onClose={closeProduct} /> : null}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={Boolean(produto)} onOpenChange={(open) => !open && closeProduct()}>
          <DialogContent className="flex h-[min(85dvh,52rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-2xl p-4">
            <DialogHeader className="p-0"><DialogTitle className="sr-only">Detalhes do item</DialogTitle></DialogHeader>
            {produto ? <ProductConfigurator slug={slug} productId={produto} storeOpen={isOpen} editLineId={linha ?? null} onClose={closeProduct} /> : null}
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}
