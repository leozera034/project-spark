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
    <div className="sticky top-0 z-30 border-b border-border bg-background/92 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand/15 bg-brand-soft text-brand-soft-foreground">
          {isDelivery ? <MapPin aria-hidden="true" className="size-4" /> : <Store aria-hidden="true" className="size-4" />}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{orderingContext.firstName}</span>
          {" · "}
          {isDelivery
            ? `Entrega em ${shortAddressLine(orderingContext.address)}`
            : "Retirada no estabelecimento"}
        </p>
        <Button variant="outline" size="sm" className="tappable min-h-[40px] shrink-0 rounded-xl active:scale-[0.97]" onClick={reopenWizard}>
          Alterar
        </Button>
      </div>
    </div>
  );
}