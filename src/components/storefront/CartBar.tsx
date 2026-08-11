/** Barra flutuante do carrinho com total autoritativo do servidor. */
import { Link } from "@tanstack/react-router";
import { ArrowRight, Loader2, ShoppingBag, TriangleAlert } from "lucide-react";

import { brl } from "@/components/storefront/format";
import { useCart } from "@/storefront/cart/cart.context";

export function CartBar({ slug }: { slug: string }) {
  const { hydrated, itemCount, total, quoteState, hasBlockingIssues } = useCart();
  if (!hydrated || itemCount === 0) return null;
  const units = itemCount;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#071318]/8 bg-[#f7f5f0]/92 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl dark:border-border/70 dark:bg-background/92">
      <div className="mx-auto max-w-4xl px-1 sm:px-2">
        <Link
          to="/loja/$slug/carrinho"
          params={{ slug }}
          className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl bg-[#071318] px-4 py-3 text-white shadow-[0_16px_42px_rgba(7,19,24,.2)] transition hover:-translate-y-0.5 dark:bg-primary dark:text-primary-foreground"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#12d8c1]/12 text-[#12d8c1] dark:bg-primary-foreground/10 dark:text-primary-foreground"><ShoppingBag className="size-4" /></span>
            <span className="min-w-0"><span className="block text-sm font-extrabold">Ver carrinho</span><span className="block text-[10px] font-semibold text-white/46 dark:text-primary-foreground/60">{units} {units === 1 ? "item" : "itens"}</span></span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm font-black tabular-nums">{hasBlockingIssues ? <TriangleAlert className="size-4 text-amber-300" /> : null}{quoteState === "loading" ? <Loader2 className="size-4 animate-spin" /> : brl(total)}</span>
            <ArrowRight className="size-4 text-[#12d8c1] transition group-hover:translate-x-1" />
          </span>
        </Link>
      </div>
    </div>
  );
}
