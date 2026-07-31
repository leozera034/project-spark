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
  const { hydrated, itemCount, total, quoteState, hasBlockingIssues, views } = useCart();

  if (!hydrated || itemCount === 0) return null;

  const units = views.reduce((sum, view) => sum + (view.line.saleMode === "measured" ? 1 : 1), 0);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur">
      <div className="mx-auto max-w-3xl">
        <Button asChild className="h-13 w-full justify-between px-4 text-base">
          <Link to="/loja/$slug/carrinho" params={{ slug }}>
            <span className="flex items-center gap-2">
              <ShoppingBag className="size-5" />
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
