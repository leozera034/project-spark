/**
 * Barra fixa com o contexto confirmado da jornada.
 * Sempre permite trocar modalidade, endereço ou nome sem abandonar o cardápio.
 */
import { MapPin, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { shortAddressLine } from "@/storefront/customer/address-normalization";
import { useCustomerWizard } from "@/storefront/customer/customer-wizard.context";

export function OrderingContextBar() {
  const { orderingContext, reopenWizard } = useCustomerWizard();
  if (!orderingContext) return null;

  const isDelivery = orderingContext.type === "entrega";
  const contextLabel = isDelivery ? "Entrega" : "Retirada";
  const destination = isDelivery
    ? shortAddressLine(orderingContext.address)
    : "Retirada no estabelecimento";

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/94 shadow-[0_6px_22px_rgba(58,35,24,.05)] backdrop-blur-2xl">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-brand/15 bg-brand-soft text-brand-soft-foreground shadow-sm">
          {isDelivery ? <MapPin aria-hidden="true" className="size-4.5" /> : <Store aria-hidden="true" className="size-4.5" />}
        </span>

        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-black uppercase tracking-[.12em] text-brand">
            <span>{contextLabel}</span>
            <span aria-hidden="true" className="text-muted-foreground/55">·</span>
            <span className="truncate text-muted-foreground">para {orderingContext.firstName}</span>
          </p>
          <p className="mt-0.5 truncate text-sm font-bold text-foreground" title={destination}>
            {destination}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="tappable min-h-[42px] shrink-0 rounded-xl px-3.5 font-bold active:scale-[0.97]"
          onClick={reopenWizard}
          aria-label={`Alterar ${contextLabel.toLowerCase()} e dados do pedido`}
        >
          Alterar
        </Button>
      </div>
    </div>
  );
}
