import { useMemo, useState } from "react";
import { createFileRoute, getRouteApi, useNavigate, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Loader2,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { OrderingContextBar } from "@/components/storefront/OrderingContextBar";
import { UNIT_LABELS, brl } from "@/components/storefront/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { CART_MESSAGES, messageForLineStatus } from "@/storefront/cart/cart.errors";
import { useCart } from "@/storefront/cart/cart.context";
import type { PublicStorePayload } from "@/lib/storefront.server";

const parentRoute = getRouteApi("/loja/$slug");

export const Route = createFileRoute("/loja/$slug/carrinho")({
  head: () => ({
    meta: [
      { title: "Seu carrinho · Pediu Aqui" },
      {
        name: "description",
        content: "Revise os itens, as quantidades e os valores antes de finalizar o pedido.",
      },
      { property: "og:title", content: "Seu carrinho" },
      {
        property: "og:description",
        content: "Revise os itens, as quantidades e os valores antes de finalizar o pedido.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { slug } = parentRoute.useParams();
  const { store } = parentRoute.useLoaderData() as { store: PublicStorePayload };
  const navigate = useNavigate();
  const cart = useCart();
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);

  const loading = cart.quoteState === "loading";
  const offline = cart.quoteState === "offline";
  const stale = cart.quoteState !== "ready";

  const priceChanges = useMemo(
    () => cart.views.filter((view) => view.issues.includes("price_changed")).length,
    [cart.views],
  );

  const editLine = (lineId: string, productId: string) =>
    navigate({
      to: "/loja/$slug",
      params: { slug },
      search: { produto: productId, linha: lineId },
    });

  return (
    <main className="min-h-svh bg-background pb-40">
      <OrderingContextBar />

      <header className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
        <Button variant="ghost" size="icon" asChild aria-label="Voltar ao cardápio">
          <Link to="/loja/$slug" params={{ slug }}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">Seu carrinho</h1>
          <p className="truncate text-sm text-muted-foreground">{store.store.name}</p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4">
        {!cart.hydrated ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Carregando carrinho…</p>
        ) : cart.itemCount === 0 ? (
          <div className="py-16 text-center">
            <ShoppingBag className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Seu carrinho está vazio.</p>
            <Button asChild className="mt-5">
              <Link to="/loja/$slug" params={{ slug }}>
                Ver o cardápio
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {!cart.storageAvailable ? (
              <p className="mb-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                {CART_MESSAGES.storageUnavailable}
              </p>
            ) : null}

            {offline || cart.quoteState === "error" ? (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-dashed p-3 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <div className="flex-1">
                  <p>{cart.quoteMessage}</p>
                  <Button
                    variant="link"
                    className="h-auto p-0 text-sm"
                    onClick={cart.revalidate}
                  >
                    Tentar novamente
                  </Button>
                </div>
              </div>
            ) : null}

            {priceChanges > 0 ? (
              <p className="mb-4 rounded-lg border p-3 text-sm">
                {priceChanges === 1
                  ? "Um item teve o preço atualizado pela loja. Confira antes de continuar."
                  : `${priceChanges} itens tiveram o preço atualizado pela loja. Confira antes de continuar.`}
              </p>
            ) : null}

            <ul className="space-y-3">
              {cart.views.map(({ line, issues, total, unitPrice, quote }) => {
                const unit = UNIT_LABELS[line.unitLabel] ?? line.unitLabel ?? "un";
                const measured = line.saleMode === "measured";
                const displayName = quote?.productName ?? line.productNameSnapshot;

                return (
                  <li
                    key={line.lineId}
                    className={`rounded-xl border p-4 ${issues.length > 0 ? "border-destructive/50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{displayName}</p>
                        {line.variantNameSnapshot ? (
                          <p className="text-sm text-muted-foreground">
                            {line.variantNameSnapshot}
                          </p>
                        ) : null}
                        {line.selections.length > 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {line.selections
                              .map((s) =>
                                s.quantity > 1
                                  ? `${s.quantity}× ${s.nameSnapshot}`
                                  : s.nameSnapshot,
                              )
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        ) : null}
                        {line.notes ? (
                          <p className="mt-1 text-sm italic text-muted-foreground">
                            “{line.notes}”
                          </p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        {total !== null ? (
                          <p className="font-semibold tabular-nums">{brl(total)}</p>
                        ) : loading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <p className="text-sm text-muted-foreground tabular-nums">
                            {brl(line.lastKnownTotal)}
                          </p>
                        )}
                        {unitPrice !== null && line.quantity !== 1 ? (
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {brl(unitPrice)} / {measured ? unit : "un"}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {issues.length > 0 ? (
                      <div className="mt-3 space-y-1">
                        {issues.map((issue) => (
                          <p key={issue} className="flex items-center gap-2 text-sm text-destructive">
                            <TriangleAlert className="size-4 shrink-0" />
                            {messageForLineStatus(issue)}
                          </p>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`Diminuir quantidade de ${displayName}`}
                        onClick={() => cart.incrementLine(line.lineId, -1)}
                        disabled={line.quantity <= line.minimumQuantity}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="w-16 text-center text-base tabular-nums">
                        {line.quantity}
                        {measured ? ` ${unit}` : ""}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`Aumentar quantidade de ${displayName}`}
                        onClick={() => cart.incrementLine(line.lineId, 1)}
                      >
                        <Plus className="size-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        className="gap-2"
                        onClick={() => editLine(line.lineId, line.productId)}
                      >
                        <Pencil className="size-4" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        className="ml-auto gap-2 text-destructive"
                        onClick={() => cart.removeLine(line.lineId)}
                      >
                        <Trash2 className="size-4" />
                        Remover
                      </Button>
                    </div>

                    <div className="mt-2">
                      {editingNotes === line.lineId ? (
                        <Textarea
                          autoFocus
                          maxLength={280}
                          defaultValue={line.notes ?? ""}
                          placeholder="Ex.: sem cebola"
                          onBlur={(event) => {
                            cart.setNotes(line.lineId, event.target.value);
                            setEditingNotes(null);
                          }}
                        />
                      ) : (
                        <Button
                          variant="link"
                          className="h-auto p-0 text-sm"
                          onClick={() => setEditingNotes(line.lineId)}
                        >
                          {line.notes ? "Editar observação" : "Adicionar observação"}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex items-center justify-between">
              <Button variant="ghost" className="gap-2" onClick={cart.revalidate}>
                <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                Atualizar valores
              </Button>
              {confirmEmpty ? (
                <span className="flex items-center gap-2 text-sm">
                  Esvaziar tudo?
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      cart.emptyAll();
                      setConfirmEmpty(false);
                    }}
                  >
                    Sim
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmEmpty(false)}>
                    Não
                  </Button>
                </span>
              ) : (
                <Button
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setConfirmEmpty(true)}
                >
                  Esvaziar carrinho
                </Button>
              )}
            </div>

            <Separator className="my-5" />

            <dl className="space-y-2 rounded-xl border p-4 text-base">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{brl(cart.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {cart.deliveryFee === null ? "Retirada na loja" : "Taxa de entrega"}
                </dt>
                <dd className="tabular-nums">
                  {cart.deliveryFee === null ? "Sem taxa" : brl(cart.deliveryFee)}
                </dd>
              </div>
              <div className="flex justify-between border-t pt-2 text-lg font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{brl(cart.total)}</dd>
              </div>
              {stale ? (
                <p className="text-xs text-muted-foreground">
                  {loading ? "Recalculando com a loja…" : "Valores aguardando confirmação da loja."}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Valores calculados no servidor da loja.
                </p>
              )}
            </dl>

            {cart.minimumOrderAmount !== null && !cart.minimumOrderMet ? (
              <p className="mt-3 rounded-lg border p-3 text-sm">
                Faltam {brl(Math.max(cart.minimumOrderAmount - cart.subtotal, 0))} para atingir o
                pedido mínimo de {brl(cart.minimumOrderAmount)}.
              </p>
            ) : null}

            {cart.quote && !cart.quote.storeIsOpen ? (
              <p className="mt-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                {CART_MESSAGES.storeClosed}
              </p>
            ) : null}

            {cart.quote && !cart.quote.fulfillmentValid ? (
              <p className="mt-3 rounded-lg border p-3 text-sm">
                {CART_MESSAGES.fulfillmentChanged}
              </p>
            ) : null}
          </>
        )}
      </div>

      {cart.itemCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur">
          <div className="mx-auto max-w-3xl space-y-2">
            <Button className="h-13 w-full justify-between px-4 text-base" disabled={!cart.canCheckout}>
              <span>
                {loading
                  ? "Recalculando…"
                  : cart.hasBlockingIssues
                    ? "Revise os itens marcados"
                    : !cart.minimumOrderMet
                      ? CART_MESSAGES.minimumNotMet
                      : "Continuar para o checkout"}
              </span>
              <span className="tabular-nums">{brl(cart.total)}</span>
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              O checkout chega na próxima etapa. Nenhum pedido foi enviado ainda.
            </p>
          </div>
        </div>
      ) : null}

      {cart.hasBlockingIssues ? (
        <Badge className="sr-only">Itens com pendência no carrinho</Badge>
      ) : null}
    </main>
  );
}
