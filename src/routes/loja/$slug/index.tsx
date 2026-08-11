import { useMemo, useState } from "react";
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
import type { PublicCatalog, PublicStorePayload } from "@/lib/storefront.server";
import { ThemeToggle } from "@/components/ThemeToggle";

const parentRoute = getRouteApi("/loja/$slug");

export const Route = createFileRoute("/loja/$slug/")({ component: StorefrontPage });

function StorefrontPage() {
  const { store: storePayload, catalog } = parentRoute.useLoaderData() as {
    store: PublicStorePayload;
    catalog: PublicCatalog;
  };
  const { slug } = parentRoute.useParams();
  const { produto, linha } = parentRoute.useSearch();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { store, settings, hours, is_open: isOpen } = storePayload;

  const grouped = useMemo(() => {
    const needle = foldText(term);
    const filtered = needle
      ? catalog.products.filter((p) => foldText(p.name).includes(needle) || foldText(p.description ?? "").includes(needle))
      : catalog.products;
    return catalog.categories
      .map((category) => ({ category, items: filtered.filter((p) => p.category_id === category.id) }))
      .filter((entry) => entry.items.length > 0);
  }, [catalog, term]);

  const todayHours = hours.filter((h) => h.weekday === new Date().getDay());
  const openProduct = (id: string) => navigate({ to: "/loja/$slug", params: { slug }, search: { produto: id } });
  const closeProduct = () => navigate({ to: "/loja/$slug", params: { slug }, search: {}, replace: true });

  return (
    <main
      className="min-h-svh bg-[#f7f5f0] pb-32 text-[#071318] dark:bg-background dark:text-foreground"
      style={{ "--brand": settings.brand_primary, "--brand-accent": settings.brand_accent } as React.CSSProperties}
    >
      <OrderingContextBar />

      <header className="relative overflow-hidden bg-[#071318] text-white">
        <div className="absolute inset-0 opacity-50" style={{ background: `radial-gradient(circle at 76% 20%, ${settings.brand_primary}55, transparent 30%), linear-gradient(135deg, #071318 15%, ${settings.brand_accent}22 100%)` }} />
        {settings.cover_url ? (
          <img src={settings.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-luminosity" fetchPriority="high" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-[#071318]/20 via-[#071318]/56 to-[#071318]" />
        <ThemeToggle className="absolute right-4 top-4 z-20 border-white/12 bg-[#071318]/60 text-white backdrop-blur sm:right-6" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 pb-8 pt-16 sm:px-6 sm:pb-10 sm:pt-24">
          <div className="flex min-w-0 items-end gap-4 sm:gap-5">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt={store.name} className="size-20 shrink-0 rounded-[24px] border-4 border-white/12 object-cover shadow-[0_20px_50px_rgba(0,0,0,.3)] sm:size-24" />
            ) : (
              <div className="grid size-20 shrink-0 place-items-center rounded-[24px] border border-white/12 bg-white/8 shadow-[0_20px_50px_rgba(0,0,0,.3)] sm:size-24"><Store className="size-9 text-white/55" /></div>
            )}
            <div className="min-w-0 pb-1">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-white/42">Cardápio online</p>
              <h1 className="pa-display mt-1 truncate text-[clamp(1.8rem,7vw,3.4rem)] font-bold leading-none">{store.name}</h1>
              <p className="mt-2 text-sm text-white/56">{store.segment ? `${store.segment} · ` : ""}{store.city}/{store.state}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-extrabold ${isOpen ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/5 text-white/52"}`}>
              <span className={`size-1.5 rounded-full ${isOpen ? "bg-emerald-300" : "bg-white/35"}`} aria-hidden="true" />
              {isOpen ? "Aberta agora" : "Fechada"}
            </span>
            {store.accepts_delivery ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/62">Entrega</span> : null}
            {store.accepts_pickup ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/62">Retirada</span> : null}
            {settings.min_order_amount > 0 ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/62">Mínimo {brl(settings.min_order_amount)}</span> : null}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/62"><Clock className="size-3" /> ~{settings.default_prep_minutes} min</span>
          </div>

          {!isOpen && settings.closed_message ? <p className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-300/8 p-4 text-sm text-amber-100/78">{settings.closed_message}</p> : null}
          {isOpen && settings.welcome_message ? <p className="mt-5 max-w-2xl text-sm leading-6 text-white/55">{settings.welcome_message}</p> : null}
        </div>
      </header>

      <div className="sticky top-0 z-20 border-b border-[#071318]/8 bg-[#f7f5f0]/91 backdrop-blur-xl dark:border-border/70 dark:bg-background/90">
        <div className="mx-auto max-w-4xl space-y-3 px-4 py-3 sm:px-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#778186]" />
            <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="O que você quer pedir?" aria-label="Buscar no cardápio" className="h-13 rounded-2xl border-[#071318]/9 bg-white pl-11 pr-11 text-base shadow-[0_6px_24px_rgba(7,19,24,.05)] dark:bg-card" />
            {term ? <button type="button" aria-label="Limpar busca" onClick={() => setTerm("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#778186] transition hover:text-[#071318]"><X className="size-4" /></button> : null}
          </div>
          {grouped.length > 1 ? (
            <nav className="rail -mx-4 gap-2 px-4 pb-1 sm:-mx-6 sm:px-6">
              {grouped.map(({ category }) => (
                <a key={category.id} href={`#categoria-${category.id}`} onClick={() => setActiveCategory(category.id)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition ${activeCategory === category.id ? "border-transparent bg-[#071318] text-white dark:bg-primary dark:text-primary-foreground" : "border-[#071318]/9 bg-white text-[#58656a] hover:border-[#071318]/18 dark:bg-card dark:text-muted-foreground"}`}>{category.name}</a>
              ))}
            </nav>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {grouped.length === 0 ? (
          <EmptyState className="mt-8" icon={ShoppingBag} title={term ? "Nenhum item encontrado" : "Cardápio em preparo"} description={term ? `Não achamos nada para “${term}”. Tente outra palavra ou veja todas as categorias.` : "Esta loja ainda não publicou itens no cardápio. Volte em instantes."} action={term ? <Button variant="outline" size="sm" onClick={() => setTerm("")}>Limpar busca</Button> : null} />
        ) : (
          grouped.map(({ category, items }) => (
            <Reveal as="section" key={category.id} id={`categoria-${category.id}`} className="scroll-mt-36 py-8">
              <div>
                <div className="flex items-end justify-between gap-3">
                  <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#0d9f91]">Categoria</p><h2 className="pa-display mt-1 text-2xl font-bold tracking-tight">{category.name}</h2></div>
                  <span className="rounded-full bg-[#071318]/5 px-2.5 py-1 text-[11px] font-bold text-[#778186] dark:bg-muted">{items.length} {items.length === 1 ? "item" : "itens"}</span>
                </div>
                {category.description ? <p className="mt-2 max-w-xl text-sm text-[#778186] dark:text-muted-foreground">{category.description}</p> : null}
              </div>

              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {items.map((product, productIndex) => (
                  <Reveal as="li" key={product.id} delay={Math.min(productIndex, 6) * 45}>
                    <button type="button" onClick={() => openProduct(product.id)} className="group flex h-full w-full overflow-hidden rounded-[22px] border border-[#071318]/8 bg-white p-3 text-left shadow-[0_8px_28px_rgba(7,19,24,.045)] transition duration-200 hover:-translate-y-0.5 hover:border-[#071318]/14 hover:shadow-[0_16px_40px_rgba(7,19,24,.08)] disabled:opacity-55 disabled:hover:translate-y-0 dark:border-border dark:bg-card" disabled={product.is_sold_out}>
                      <div className="flex min-w-0 flex-1 flex-col p-1.5 pr-3">
                        <div className="flex items-start gap-2">
                          <p className="min-w-0 flex-1 font-extrabold leading-5">{product.name}</p>
                          {product.is_featured ? <span className="shrink-0 rounded-full bg-[#12d8c1]/10 px-2 py-0.5 text-[10px] font-black text-[#0d9f91]">Destaque</span> : null}
                        </div>
                        {product.description ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#778186] dark:text-muted-foreground">{product.description}</p> : null}
                        <p className={`mt-auto pt-4 text-sm font-black tabular-nums ${product.is_sold_out ? "text-[#9aa2a5]" : "text-[#0d9f91]"}`}>{product.is_sold_out ? "Esgotado" : product.from_price !== null && product.has_variants ? `a partir de ${brl(product.from_price)}` : brl(product.base_price)}</p>
                      </div>
                      {product.image_url ? <img src={product.image_url} alt="" loading="lazy" decoding="async" className="size-24 shrink-0 rounded-[18px] object-cover transition duration-300 group-hover:scale-[1.025] sm:size-28" /> : <div className="grid size-24 shrink-0 place-items-center rounded-[18px] bg-[#071318]/4 text-[#9aa2a5] sm:size-28"><ShoppingBag className="size-6" /></div>}
                    </button>
                  </Reveal>
                ))}
              </ul>
            </Reveal>
          ))
        )}

        <Separator className="my-6" />
        <footer className="space-y-4 pb-12 text-sm text-[#778186] dark:text-muted-foreground">
          {store.address_line ? <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0" />{store.address_line} — {store.city}/{store.state}</p> : null}
          {todayHours.length > 0 ? <p className="flex items-start gap-2"><Clock className="mt-0.5 size-4 shrink-0" />{WEEKDAY_LABELS[new Date().getDay()]}: {todayHours.map((h) => `${shortTime(h.opens_at)} às ${shortTime(h.closes_at)}`).join(", ")}</p> : null}
          <p className="text-xs font-semibold text-[#9aa2a5]">Pedido online com Pediu Aqui.</p>
        </footer>
      </div>

      <CartBar slug={slug} />
      <Sheet open={Boolean(produto)} onOpenChange={(open) => !open && closeProduct()}>
        <SheetContent side="bottom" className="flex h-[92svh] flex-col gap-0 rounded-t-[28px] px-4 pb-3 sm:mx-auto sm:max-w-2xl">
          <SheetHeader className="px-0"><SheetTitle className="sr-only">Detalhes do item</SheetTitle></SheetHeader>
          {produto ? <ProductConfigurator slug={slug} productId={produto} storeOpen={isOpen} editLineId={linha ?? null} onClose={closeProduct} /> : null}
        </SheetContent>
      </Sheet>
    </main>
  );
}
