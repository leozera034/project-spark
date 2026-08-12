/**
 * Barra fixa com o contexto confirmado da jornada.
 * Sempre permite trocar de modalidade ou de endereço.
 */
import { ChevronDown, MapPin, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { shortAddressLine } from "@/storefront/customer/address-normalization";
import { useCustomerWizard } from "@/storefront/customer/customer-wizard.context";

export function OrderingContextBar() {
  const { orderingContext, reopenWizard } = useCustomerWizard();
  if (!orderingContext) return null;

  const isDelivery = orderingContext.type === "entrega";

  return (
    <div className="sticky top-0 z-30 border-b border-violet-300/10 bg-[#08040e]/90 shadow-[0_12px_45px_rgba(0,0,0,.26)] backdrop-blur-2xl">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-[14px] border border-violet-300/10 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 text-violet-200 shadow-[inset_0_1px_rgba(255,255,255,.06)]">
          {isDelivery ? <MapPin aria-hidden="true" className="size-[18px]" /> : <Store aria-hidden="true" className="size-[18px]" />}
        </span>

        <button
          type="button"
          onClick={reopenWizard}
          className="group min-w-0 flex-1 text-left"
          aria-label="Alterar forma de recebimento"
        >
          <span className="block text-[10px] font-bold uppercase tracking-[.12em] text-violet-300/75">
            {isDelivery ? "Entregar em" : "Retirar em"}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-bold tracking-[-.015em] text-white/90">
              {isDelivery ? shortAddressLine(orderingContext.address) : "No estabelecimento"}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-white/40 transition-transform group-active:translate-y-0.5" />
          </span>
          <span className="block truncate text-[11px] font-medium text-white/40">
            Pedido de {orderingContext.firstName}
          </span>
        </button>

        <Button
          variant="outline"
          size="sm"
          className="tappable min-h-[40px] shrink-0 rounded-xl border-violet-300/15 bg-white/[.025] px-3 text-xs font-bold text-white/75 active:scale-[0.97]"
          onClick={reopenWizard}
        >
          Trocar
        </Button>
      </div>
    </div>
  );
}
