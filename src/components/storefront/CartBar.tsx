/**
 * Barra flutuante do carrinho, presente no cardápio.
 * Mostra sempre o total autoritativo do servidor quando disponível.
 */
import { Link } from "@tanstack/react-router";
import { Loader2, ShoppingBag, TriangleAlert } from "lucide-react";

import { brl } from "@/components/storefront/format";
import { Button } from "@/components/ui/button";
import { useCart } from "@/storefront/cart/cart.context";

export function CartBar({ slug }: { slug: string }) {
  const { hydrated, itemCount, total, quoteState, hasBlockingIssues } = useCart();

  if (!hydrated || itemCount === 0) return null;

  const units = itemCount;


  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 glass-bar animate-[cart-bar-in_320ms_cubic-bezier(0.22,1,0.36,1)_both] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-3xl px-1 sm:px-2">
        <Button asChild className="group h-14 w-full justify-between rounded-2xl px-4 text-base shadow-e2 transition-shadow duration-200 hover:shadow-e3">
          <Link to="/loja/$slug/carrinho" params={{ slug }}>
            <span className="flex items-center gap-2">
              <ShoppingBag className="size-5 transition-transform duration-300 ease-out group-hover:-translate-y-0.5" />
              Ver carrinho · {units} {units === 1 ? "item" : "itens"}
            </span>
            <span className="flex items-center gap-2 tabular-nums">
              {hasBlockingIssues ? <TriangleAlert className="size-4" /> : null}
              {quoteState === "loading" ? <Loader2 className="size-4 animate-spin" /> : brl(total)}
            </span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
