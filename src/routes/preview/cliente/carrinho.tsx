import { Link, createFileRoute } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/demo/States";
import { StickyAction, StoreFooter, StorePage, StoreStepHeader } from "@/components/demo/StoreShell";
import { Button } from "@/components/ui/button";
import { neighborhoodById } from "@/demo/data/demoStore";
import { useDemo } from "@/demo/state/useDemo";
import { formatBRL } from "@/demo/utils/format";
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/preview/cliente/carrinho")({
  head: demoHead(
    "Carrinho — Mercado Aurora",
    "Revise os itens, as observações e o total antes de finalizar o pedido.",
  ),
  component: Cart,
});

function Cart() {
  const { customer, updateCartLine, removeCartLine, store } = useDemo();
  const neighborhood = customer.address ? neighborhoodById(customer.address.neighborhoodId) : undefined;

  const subtotal = customer.cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const deliveryFee = customer.fulfillment === "entrega" ? (neighborhood?.deliveryFee ?? 0) : 0;
  const minimum = neighborhood?.minimumOrder ?? store.minimumOrder;
  const belowMinimum = customer.fulfillment === "entrega" && subtotal < minimum;
  const total = subtotal + deliveryFee;

  return (
    <div className="flex min-h-screen flex-col">
      <StoreStepHeader title="Seu carrinho" backTo="/preview/cliente/cardapio" />
      <StorePage className="flex-1">
        {customer.cart.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Seu carrinho está vazio"
            description="Volte ao cardápio e escolha o que você quer receber hoje."
          />
        ) : (
          <>
            <ul className="space-y-3">
              {customer.cart.map((line) => (
                <li key={line.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-foreground">{line.productName}</p>
                      {line.variationName ? (
                        <p className="text-sm text-muted-foreground">{line.variationName}</p>
                      ) : null}
                      {line.optionNames.length > 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {line.optionNames.join(", ")}
                        </p>
                      ) : null}
                      {line.note ? (
                        <p className="mt-1 text-sm italic text-muted-foreground">“{line.note}”</p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-base font-semibold text-foreground">
                      {formatBRL(line.unitPrice * line.quantity)}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="iconTouch"
                      aria-label={`Diminuir quantidade de ${line.productName}`}
                      onClick={() =>
                        updateCartLine(line.id, { quantity: Math.max(1, line.quantity - 1) })
                      }
                    >
                      <Minus aria-hidden="true" />
                    </Button>
                    <span className="w-8 text-center text-base font-semibold">{line.quantity}</span>
                    <Button
                      variant="outline"
                      size="iconTouch"
                      aria-label={`Aumentar quantidade de ${line.productName}`}
                      onClick={() => updateCartLine(line.id, { quantity: line.quantity + 1 })}
                    >
                      <Plus aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      className="ml-auto gap-2 text-danger"
                      onClick={() => removeCartLine(line.id)}
                    >
                      <Trash2 aria-hidden="true" />
                      Remover
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <dl className="mt-5 space-y-2 rounded-xl border border-border bg-surface p-4 text-base">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="text-foreground">{formatBRL(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {customer.fulfillment === "retirada" ? "Retirada na loja" : "Taxa de entrega"}
                </dt>
                <dd className="text-foreground">
                  {customer.fulfillment === "retirada" ? "Sem taxa" : formatBRL(deliveryFee)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-lg font-semibold">
                <dt>Total</dt>
                <dd>{formatBRL(total)}</dd>
              </div>
            </dl>

            {belowMinimum ? (
              <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
                Faltam {formatBRL(minimum - subtotal)} para atingir o pedido mínimo de{" "}
                {formatBRL(minimum)} neste bairro.
              </p>
            ) : null}

            <Button asChild variant="ghost" size="touch" className="mt-4 w-full">
              <Link to="/preview/cliente/cardapio">Continuar comprando</Link>
            </Button>
          </>
        )}
        <StoreFooter />
      </StorePage>

      {customer.cart.length > 0 ? (
        <StickyAction>
          <Button
            asChild={!belowMinimum}
            size="touch"
            variant="brand"
            className="h-13 w-full text-base"
            disabled={belowMinimum}
          >
            {belowMinimum ? (
              <span>Pedido mínimo não atingido</span>
            ) : (
              <Link to="/preview/cliente/checkout">Continuar para o checkout</Link>
            )}
          </Button>
        </StickyAction>
      ) : null}
    </div>
  );
}
