import { AlertCircle, CheckCircle2, LockKeyhole } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { StoreAddon } from "@/lib/store-addons.functions";
import { useAddonPurchasePreflight } from "@/store/addons/store-addons.queries";

export function AddonPurchaseReadiness({
  storeId,
  addon,
  canViewBilling,
}: {
  storeId: string;
  addon: StoreAddon;
  canViewBilling: boolean;
}) {
  const shouldCheck =
    canViewBilling &&
    addon.availability_status === "available" &&
    Boolean(addon.monthly_price);

  const preflight = useAddonPurchasePreflight(storeId, addon.code, "monthly", shouldCheck);

  if (!canViewBilling) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
        Situação de contratação visível ao proprietário ou gestor financeiro.
      </div>
    );
  }

  if (addon.subscription && ["active", "trial", "grace_period", "complimentary"].includes(addon.subscription.status)) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-success/20 bg-success-soft/45 px-3 py-2.5 text-xs">
        <span className="flex items-center gap-2 font-semibold text-success">
          <CheckCircle2 className="size-3.5" /> Módulo já habilitado
        </span>
        <Badge variant="outline">{addon.subscription.status}</Badge>
      </div>
    );
  }

  if (addon.availability_status !== "available") {
    return (
      <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        Contratação ainda não liberada para este módulo.
      </div>
    );
  }

  if (!addon.monthly_price) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        Preço comercial ainda não publicado.
      </div>
    );
  }

  if (preflight.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        Validando disponibilidade comercial…
      </div>
    );
  }

  if (preflight.isError || !preflight.data) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[.05] px-3 py-2.5 text-xs text-muted-foreground">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
        Não foi possível validar a contratação com esta permissão.
      </div>
    );
  }

  if (preflight.data.ready) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-success/20 bg-success-soft/45 px-3 py-2.5 text-xs text-success">
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
        <div>
          <p className="font-semibold">Disponível para contratar</p>
          <p className="mt-0.5 text-success/80">Checkout ainda não foi liberado nesta etapa.</p>
        </div>
      </div>
    );
  }

  const blocker = preflight.data.blockers[0];
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[.05] px-3 py-2.5 text-xs text-muted-foreground">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
      <div>
        <p className="font-semibold text-foreground">Contratação bloqueada</p>
        <p className="mt-0.5">{blocker?.message ?? "Ainda existem pré-requisitos comerciais pendentes."}</p>
      </div>
    </div>
  );
}
