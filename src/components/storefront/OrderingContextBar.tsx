/**
 * Barra fixa com o contexto confirmado da jornada.
 * Sempre permite trocar de modalidade ou de endereço.
 */
import { MapPin, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { shortAddressLine } from "@/storefront/customer/address-normalization";
import { useCustomerWizard } from "@/storefront/customer/customer-wizard.context";

export function OrderingContextBar() {
  const { orderingContext, reopenWizard } = useCustomerWizard();
  if (!orderingContext) return null;

  const isDelivery = orderingContext.type === "entrega";

  return (
    <div className="sticky top-0 z-30 border-b border-violet-300/10 bg-[#090510]/92 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-violet-300/10 bg-violet-500/10 text-violet-300">
          {isDelivery ? <MapPin aria-hidden="true" className="size-4" /> : <Store aria-hidden="true" className="size-4" />}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm text-white/55">
          <span className="font-bold text-white/88">{orderingContext.firstName}</span>
          {" · "}
          {isDelivery
            ? `Entrega em ${shortAddressLine(orderingContext.address)}`
            : "Retirada no estabelecimento"}
        </p>
        <Button variant="outline" size="sm" className="tappable min-h-[40px] rounded-xl border-violet-300/15 bg-white/[.025] active:scale-[0.97]" onClick={reopenWizard}>
          Alterar
        </Button>
      </div>
    </div>
  );
}
