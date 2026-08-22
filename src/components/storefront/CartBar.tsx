/**
 * Barra flutuante do carrinho, presente no cardápio.
 * Mostra sempre o total autoritativo do servidor quando disponível e antecipa
 * bloqueios que o cliente precisa resolver antes do checkout.
 */
import { Link } from "@tanstack/react-router";
import { ArrowRight, Loader2, ShoppingBag, TriangleAlert } from "lucide-react";

import { brl } from "@/components/storefront/format";
import { Button } from "@/components/ui/button";
import { useCart } from "@/storefront/cart/cart.context";

export function CartBar({ slug }: { slug: string }) {
  const {
    hydrated,
    itemCount,
    subtotal,
    total,
    minimumOrderAmount,
    minimumOrderMet,
    quoteState,
    hasBlockingIssues,
  } = useCart();

  if (!hydrated || itemCount === 0) return null;

  const minimumDeficit =
    minimumOrderAmount !== null && !minimumOrderMet
      ? Math.max(minimumOrderAmount - subtotal, 0)
      : 0;

  const supportingText = hasBlockingIssues
    ? "Revise os itens antes de continuar"
    : quoteState === "loading"
      ? "Atualizando valores com a loja…"
      : minimumDeficit > 0
        ? `Faltam ${brl(minimumDeficit)} para o pedido mínimo`
        : `${itemCount} ${itemCount === 1 ? "produto" : "produtos"} no carrinho`;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
      <div className="mx-auto max-w-3xl rounded-[22px] border border-border bg-card/96 p-1.5 shadow-e3 backdrop-blur-2xl">
        <Button asChild className="group h-14 w-full justify-between rounded-[17px] px-3.5 text-base sm:px-4">
          <Link
            to="/loja/$slug/carrinho"
            params={{ slug }}
            aria-label={`Abrir carrinho com ${itemCount} ${itemCount === 1 ? "produto" : "produtos"}. Total ${brl(total)}.`}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-white/15">
                <ShoppingBag className="size-4.5 transition-transform duration-300 group-hover:-translate-y-0.5" />
                <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-white px-1 text-center text-[9px] font-black leading-4 text-brand shadow-sm" aria-hidden="true">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              </span>
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm font-bold">Ver carrinho</span>
                <span className="block truncate text-[11px] font-medium text-white/80" aria-live="polite">
                  {supportingText}
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2 tabular-nums">
              {hasBlockingIssues ? <TriangleAlert className="size-4" aria-hidden="true" /> : null}
              <span className="font-extrabold">
                {quoteState === "loading" ? <Loader2 className="size-4 animate-spin" aria-label="Atualizando total" /> : brl(total)}
              </span>
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
