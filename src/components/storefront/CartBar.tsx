/**
 * Barra flutuante do carrinho, presente no cardápio.
 * Mostra sempre o total autoritativo do servidor quando disponível.
 */
import { Link } from "@tanstack/react-router";
import { ArrowRight, Loader2, ShoppingBag, TriangleAlert } from "lucide-react";

import { brl } from "@/components/storefront/format";
import { Button } from "@/components/ui/button";
import { useCart } from "@/storefront/cart/cart.context";

export function CartBar({ slug }: { slug: string }) {
  const { hydrated, itemCount, total, quoteState, hasBlockingIssues } = useCart();

  if (!hydrated || itemCount === 0) return null;

  const units = itemCount;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto mx-auto max-w-3xl overflow-hidden rounded-[24px] border border-violet-300/12 bg-[#0a0511]/95 p-1.5 shadow-[0_28px_80px_rgba(0,0,0,.64),0_0_42px_rgba(124,58,237,.16)] backdrop-blur-2xl">
        {hasBlockingIssues ? (
          <div className="flex items-center gap-2 px-3.5 pb-1.5 pt-1 text-[11px] font-semibold text-amber-300/90">
            <TriangleAlert className="size-3.5" />
            Revise um item antes de finalizar
          </div>
        ) : null}

        <Button
          asChild
          className="group h-16 w-full justify-between rounded-[18px] bg-gradient-to-r from-violet-700 via-purple-600 to-fuchsia-500 px-3.5 text-base shadow-[inset_0_1px_rgba(255,255,255,.17),0_14px_40px_rgba(147,51,234,.22)] hover:brightness-105 sm:px-4"
        >
          <Link to="/loja/$slug/carrinho" params={{ slug }}>
            <span className="flex min-w-0 items-center gap-3">
              <span className="relative grid size-10 shrink-0 place-items-center rounded-[13px] border border-white/10 bg-black/15 shadow-inner">
                <ShoppingBag className="size-[18px] transition-transform duration-300 group-hover:-translate-y-0.5" />
                <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full border border-white/15 bg-white px-1 text-[10px] font-black leading-5 text-violet-800 shadow-lg">
                  {units > 99 ? "99+" : units}
                </span>
              </span>
              <span className="min-w-0 text-left">
                <span className="block truncate text-[15px] font-extrabold tracking-[-.02em]">
                  Ver meu pedido
                </span>
                <span className="block text-[11px] font-semibold text-white/65">
                  {units} {units === 1 ? "item selecionado" : "itens selecionados"}
                </span>
              </span>
            </span>

            <span className="flex items-center gap-2.5 tabular-nums">
              <span className="text-right">
                <span className="block text-[10px] font-semibold uppercase tracking-[.08em] text-white/55">
                  Total
                </span>
                <span className="block font-black tracking-[-.025em]">
                  {quoteState === "loading" ? <Loader2 className="size-4 animate-spin" /> : brl(total)}
                </span>
              </span>
              <span className="grid size-8 place-items-center rounded-full bg-white/12">
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            </span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
