import { useEffect, useMemo, useState } from "react";
import { createFileRoute, getRouteApi, useNavigate, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Flame,
  Loader2,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { OrderingContextBar } from "@/components/storefront/OrderingContextBar";
import { UNIT_LABELS, brl } from "@/components/storefront/format";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ListSkeleton } from "@/components/feedback/Skeletons";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { CART_MESSAGES, messageForLineStatus } from "@/storefront/cart/cart.errors";
import { useCart } from "@/storefront/cart/cart.context";
import { useCustomerWizard } from "@/storefront/customer/customer-wizard.context";
import type { PublicCatalog, PublicStorePayload } from "@/lib/storefront.server";

const parentRoute = getRouteApi("/loja/$slug");
type RecommendationSource = "copurchase" | "bestseller_fallback" | "local_fallback";

export const Route = createFileRoute("/loja/$slug/carrinho")({
  head: () => ({
    meta: [
      { title: "Seu carrinho · Comandiva" },
      { name: "description", content: "Revise os itens, as quantidades e os valores antes de finalizar o pedido." },
      { property: "og:title", content: "Seu carrinho" },
      { property: "og:description", content: "Revise os itens, as quantidades e os valores antes de finalizar o pedido." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { slug } = parentRoute.useParams();
  const { store, catalog } = parentRoute.useLoaderData() as { store: PublicStorePayload; catalog: PublicCatalog };
  const navigate = useNavigate();
  const cart = useCart();
  const wizard = useCustomerWizard();
  const isDelivery = wizard.orderingContext?.type === "entrega";
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [recommendationSource, setRecommendationSource] = useState<RecommendationSource>("local_fallback");

  const loading = cart.quoteState === "loading";
  const offline = cart.quoteState === "offline";
  const stale = cart.quoteState !== "ready";

  const priceChanges = useMemo(
    () => cart.views.filter((view) => view.issues.includes("price_changed")).length,
    [cart.views],
  );

  const cartProductIds = useMemo(
    () => Array.from(new Set(cart.lines.map((line) => line.productId))).sort(),
    [cart.lines],
  );
  const cartProductKey = cartProductIds.join(",");

  useEffect(() => {
    if (!cart.hydrated || cartProductIds.length === 0) {
      setRecommendedIds([]);
      setRecommendationSource("local_fallback");
      return;
    }

    const controller = new AbortController();
    let active = true;

    void fetch(`/api/public/storefront/${encodeURIComponent(slug)}/recomendacoes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productIds: cartProductIds }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("recommendations_unavailable");
        return response.json() as Promise<{ productIds?: unknown; source?: unknown }>;
      })
      .then((result) => {
        if (!active) return;
        const ids = Array.isArray(result.productIds)
          ? result.productIds.filter((id): id is string => typeof id === "string").slice(0, 6)
          : [];
        setRecommendedIds(ids);
        setRecommendationSource(result.source === "copurchase" ? "copurchase" : "bestseller_fallback");
      })
      .catch((error) => {
        if (!active || error instanceof DOMException && error.name === "AbortError") return;
        setRecommendedIds([]);
        setRecommendationSource("local_fallback");
      });

    return () => {
      active = false;
      controller.abort();
    };
    // `cartProductKey` representa de forma determinística o conjunto de produtos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.hydrated, cartProductKey, slug]);

  const suggestions = useMemo(() => {
    const inCart = new Set(cartProductIds);
    const byId = new Map(catalog.products.map((product) => [product.id, product] as const));
    const fromServer = recommendedIds
      .map((id) => byId.get(id))
      .filter((product): product is PublicCatalog["products"][number] =>
        Boolean(product) && !product!.is_sold_out && !inCart.has(product!.id),
      );

    if (fromServer.length > 0) return fromServer.slice(0, 6);

    const eligible = catalog.products.filter((product) => !product.is_sold_out && !inCart.has(product.id));
    const priority = eligible.filter((product) => product.is_best_seller || product.is_featured);
    const fallback = eligible.filter((product) => !product.is_best_seller && !product.is_featured);
    return [...priority, ...fallback].slice(0, 6);
  }, [catalog.products, cartProductIds, recommendedIds]);

  const recommendationDescription = recommendationSource === "copurchase"
    ? "Escolhas que costumam aparecer junto com produtos como os do seu carrinho."
    : recommendationSource === "bestseller_fallback"
      ? "A loja ainda não tem combinações suficientes; mostramos os mais pedidos disponíveis."
      : "Priorizamos destaques e itens populares que ainda não estão no carrinho.";

  const editLine = (lineId: string, productId: string) =>
    navigate({
      to: "/loja/$slug",
      params: { slug },
      search: { produto: productId, linha: lineId },
    });

  const openSuggestion = (productId: string) =>
    navigate({
      to: "/loja/$slug",
      params: { slug },
      search: { produto: productId },
    });

  return (
    <main className="storefront-global min-h-svh bg-background pb-[calc(10rem+env(safe-area-inset-bottom))]">
      <OrderingContextBar />

      <header className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
        <Button variant="ghost" size="icon" asChild aria-label="Voltar ao cardápio" className="size-11 shrink-0 rounded-full">
          <Link to="/loja/$slug" params={{ slug }}><ArrowLeft className="size-5" /></Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-black">Seu carrinho</h1>
          <p className="truncate text-sm text-muted-foreground">{store.store.name}{cart.itemCount > 0 ? ` · ${cart.itemCount} ${cart.itemCount === 1 ? "produto" : "produtos"}` : ""}</p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {!cart.hydrated ? (
          <ListSkeleton rows={3} className="py-6" />
        ) : cart.itemCount === 0 ? (
          <EmptyState
            className="my-10"
            icon={ShoppingBag}
            title="Seu carrinho está vazio"
            description="Escolha seus produtos e volte aqui para revisar quantidades, adicionais e valores antes de enviar o pedido."
            action={<Button asChild><Link to="/loja/$slug" params={{ slug }}>Explorar cardápio</Link></Button>}
          />
        ) : (
          <>
            {!cart.storageAvailable ? (
              <p className="mb-4 rounded-xl border border-border bg-surface-muted p-3.5 text-sm text-muted-foreground">{CART_MESSAGES.storageUnavailable}</p>
            ) : null}

            {offline || cart.quoteState === "error" ? (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft/40 p-3.5 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <p>{cart.quoteMessage}</p>
                  <Button variant="link" className="mt-1 h-auto min-h-8 p-0 text-sm font-bold" onClick={cart.revalidate}>Tentar novamente</Button>
                </div>
              </div>
            ) : null}

            {priceChanges > 0 ? (
              <p className="mb-4 rounded-xl border border-warning/30 bg-warning-soft/35 p-3.5 text-sm">
                <strong>{priceChanges === 1 ? "Um preço mudou." : `${priceChanges} preços mudaram.`}</strong>{" "}
                Confira os valores atualizados pela loja antes de continuar.
              </p>
            ) : null}

            <ul className="space-y-3">
              {cart.views.map(({ line, issues, total, unitPrice, quote }) => {
                const unit = UNIT_LABELS[line.unitLabel] ?? line.unitLabel ?? "un";
                const measured = line.saleMode === "measured";
                const displayName = quote?.productName ?? line.productNameSnapshot;
                const atMaximum = Boolean(line.maxQuantity && line.quantity >= line.maxQuantity);

                return (
                  <li key={line.lineId} className={`panel rounded-2xl p-4 ${issues.length > 0 ? "border-destructive/50" : ""}`}>
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-bold">{displayName}</p>
                        {line.variantNameSnapshot ? <p className="mt-0.5 break-words text-sm text-muted-foreground">{line.variantNameSnapshot}</p> : null}
                        {line.selections.length > 0 ? (
                          <p className="mt-0.5 break-words text-sm leading-relaxed text-muted-foreground">
                            {line.selections.map((s) => s.quantity > 1 ? `${s.quantity}× ${s.nameSnapshot}` : s.nameSnapshot).filter(Boolean).join(", ")}
                          </p>
                        ) : null}
                        {line.notes ? <p className="mt-1 break-words text-sm italic text-muted-foreground">“{line.notes}”</p> : null}
                      </div>
                      <div className="shrink-0 text-right">
                        {total !== null ? <p className="font-black tabular-nums">{brl(total)}</p> : loading ? <Loader2 className="ml-auto size-4 animate-spin" /> : <p className="text-sm text-muted-foreground tabular-nums">{brl(line.lastKnownTotal)}</p>}
                        {unitPrice !== null && line.quantity !== 1 ? <p className="text-xs text-muted-foreground tabular-nums">{brl(unitPrice)} / {measured ? unit : "un"}</p> : null}
                      </div>
                    </div>

                    {issues.length > 0 ? (
                      <div className="mt-3 space-y-1.5 rounded-xl bg-destructive/5 p-3">
                        {issues.map((issue) => (
                          <p key={issue} className="flex items-start gap-2 text-sm text-destructive">
                            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                            <span className="min-w-0">{messageForLineStatus(issue)}</span>
                          </p>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-xl bg-muted/35 p-1">
                        <Button variant="outline" size="icon" className="size-11 rounded-xl" aria-label={`Diminuir quantidade de ${displayName}`} onClick={() => cart.incrementLine(line.lineId, -1)} disabled={line.quantity <= line.minimumQuantity}>
                          <Minus className="size-4" />
                        </Button>
                        <span className="min-w-16 px-1 text-center text-sm font-black tabular-nums sm:text-base">
                          {line.quantity}{measured ? ` ${unit}` : ""}
                        </span>
                        <Button variant="outline" size="icon" className="size-11 rounded-xl" aria-label={`Aumentar quantidade de ${displayName}`} onClick={() => cart.incrementLine(line.lineId, 1)} disabled={atMaximum}>
                          <Plus className="size-4" />
                        </Button>
                      </div>

                      <Button variant="ghost" size="sm" className="min-h-11 gap-2" onClick={() => editLine(line.lineId, line.productId)}>
                        <Pencil className="size-4" /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="min-h-11 gap-2 text-destructive sm:ml-auto" onClick={() => cart.removeLine(line.lineId)}>
                        <Trash2 className="size-4" /> Remover
                      </Button>
                    </div>

                    <div className="mt-2">
                      {editingNotes === line.lineId ? (
                        <Textarea
                          aria-label="Observação do item"
                          autoFocus
                          maxLength={280}
                          defaultValue={line.notes ?? ""}
                          placeholder="Ex.: sem cebola, molho separado…"
                          className="min-h-20 rounded-xl"
                          onBlur={(event) => {
                            cart.setNotes(line.lineId, event.target.value);
                            setEditingNotes(null);
                          }}
                        />
                      ) : (
                        <Button variant="link" className="h-auto min-h-9 max-w-full whitespace-normal p-0 text-left text-sm" onClick={() => setEditingNotes(line.lineId)}>
                          {line.notes ? "Editar observação" : "Adicionar observação"}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {suggestions.length > 0 ? (
              <section className="mt-6 rounded-2xl border border-border bg-muted/20 py-4" aria-labelledby="cart-suggestions-title">
                <div className="px-4">
                  <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[.12em] text-brand"><Sparkles className="size-4" /> Complete seu pedido</p>
                  <h2 id="cart-suggestions-title" className="mt-1 text-lg font-black">Peça também</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{recommendationDescription}</p>
                </div>
                <div className="mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
                  {suggestions.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => openSuggestion(product.id)}
                      className="w-[150px] shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-background text-left shadow-sm transition active:scale-[.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <div className="relative aspect-[4/3] bg-brand/8">
                        {product.image_url ? <img src={product.image_url} alt="" loading="lazy" decoding="async" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-brand"><ShoppingBag className="size-7" /></div>}
                        {product.is_best_seller ? <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/95 px-2 py-1 text-[10px] font-black text-brand shadow-sm"><Flame className="size-3" /> Popular</span> : null}
                        <span className="absolute bottom-2 right-2 grid size-10 place-items-center rounded-full border-2 border-background bg-brand text-brand-foreground shadow-md" aria-hidden="true"><Plus className="size-4" /></span>
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-2 min-h-10 text-sm font-extrabold leading-snug">{product.name}</p>
                        <p className="mt-2 text-sm font-black text-brand tabular-nums">{product.from_price !== null && product.has_variants ? `a partir de ${brl(product.from_price)}` : brl(product.base_price)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="ghost" className="min-h-11 justify-start gap-2 sm:justify-center" onClick={cart.revalidate} disabled={loading}>
                <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Atualizando valores" : "Atualizar valores"}
              </Button>
              {confirmEmpty ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 p-2 text-sm">
                  <span className="font-semibold">Esvaziar tudo?</span>
                  <Button size="sm" className="min-h-10" variant="destructive" onClick={() => { cart.emptyAll(); setConfirmEmpty(false); }}>Sim</Button>
                  <Button size="sm" className="min-h-10" variant="ghost" onClick={() => setConfirmEmpty(false)}>Não</Button>
                </div>
              ) : (
                <Button variant="ghost" className="min-h-11 justify-start text-destructive sm:justify-center" onClick={() => setConfirmEmpty(true)}>Esvaziar carrinho</Button>
              )}
            </div>

            <Separator className="my-5" />

            <dl className="panel space-y-2 rounded-2xl p-4 text-base">
              <div className="flex min-w-0 justify-between gap-4"><dt className="min-w-0 text-muted-foreground">Subtotal</dt><dd className="shrink-0 font-semibold tabular-nums">{brl(cart.subtotal)}</dd></div>
              <div className="flex min-w-0 justify-between gap-4">
                <dt className="min-w-0 text-muted-foreground">{isDelivery ? "Taxa de entrega" : "Retirada na loja"}</dt>
                <dd className="shrink-0 font-semibold tabular-nums">{isDelivery ? cart.quoteState === "ready" && cart.deliveryFee !== null ? brl(cart.deliveryFee) : "A calcular" : "Sem taxa"}</dd>
              </div>
              <div className="flex min-w-0 justify-between gap-4 border-t pt-2 text-lg font-black"><dt>Total</dt><dd className="shrink-0 tabular-nums">{brl(cart.total)}</dd></div>
              <p className="text-xs leading-relaxed text-muted-foreground">{stale ? loading ? "Recalculando com a loja…" : "Valores aguardando confirmação da loja." : "Valores confirmados pelo servidor da loja."}</p>
            </dl>

            {cart.minimumOrderAmount !== null && !cart.minimumOrderMet ? (
              <div className="mt-3 rounded-xl border border-warning/30 bg-warning-soft/35 p-3.5 text-sm">
                <p><strong>Faltam {brl(Math.max(cart.minimumOrderAmount - cart.subtotal, 0))}</strong> para atingir o pedido mínimo de {brl(cart.minimumOrderAmount)}.</p>
                <Button asChild variant="outline" size="sm" className="mt-3 min-h-10 bg-background"><Link to="/loja/$slug" params={{ slug }}>Adicionar mais produtos</Link></Button>
              </div>
            ) : null}

            {cart.quote && !cart.quote.storeIsOpen ? <p className="mt-3 rounded-xl border border-border bg-surface-muted p-3.5 text-sm text-muted-foreground">{CART_MESSAGES.storeClosed}</p> : null}
            {cart.quote && !cart.quote.fulfillmentValid ? <p className="mt-3 rounded-xl border border-warning/30 bg-warning-soft/35 p-3.5 text-sm">{CART_MESSAGES.fulfillmentChanged}</p> : null}
          </>
        )}
      </div>

      {cart.itemCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-14px_34px_rgba(58,35,24,.08)] backdrop-blur-xl sm:px-4">
          <div className="mx-auto max-w-3xl space-y-2">
            <Button className="min-h-14 w-full gap-3 rounded-2xl px-4 text-base font-black" disabled={!cart.canCheckout} onClick={() => navigate({ to: "/loja/$slug/checkout", params: { slug } })}>
              <span className="min-w-0 flex-1 text-left leading-tight">
                {loading ? "Recalculando…" : cart.hasBlockingIssues ? "Revise os produtos marcados" : !cart.minimumOrderMet ? CART_MESSAGES.minimumNotMet : "Continuar para finalizar"}
              </span>
              <span className="shrink-0 tabular-nums">{brl(cart.total)}</span>
            </Button>
            <p className="px-1 text-center text-[11px] leading-relaxed text-muted-foreground">Nenhum pedido foi enviado ainda. Pagamento e contato são confirmados na próxima tela.</p>
          </div>
        </div>
      ) : null}

      {cart.hasBlockingIssues ? <Badge className="sr-only">Produtos com pendência no carrinho</Badge> : null}
    </main>
  );
}
