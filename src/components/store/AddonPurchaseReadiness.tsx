import { AlertCircle, CheckCircle2, Loader2, LockKeyhole, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StoreAddon } from "@/lib/store-addons.functions";
import { useAddonCheckout, useAddonPurchasePreflight } from "@/store/addons/store-addons.queries";

function checkoutErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "ADDON_PURCHASE_NOT_READY") return "Este recurso deixou de estar disponível para contratação. Atualize a página e tente novamente.";
  if (code === "PROVIDER_PRICE_REQUIRES_RESYNC") return "O preço deste recurso está sendo atualizado. Tente novamente em alguns instantes.";
  if (code === "STRIPE_NOT_CONFIGURED") return "O pagamento deste recurso ainda não está disponível.";
  if (code === "ACCOUNT_EMAIL_REQUIRED") return "Adicione um e-mail válido à sua conta antes de contratar.";
  if (code === "CHECKOUT_IN_PROGRESS") return "Já existe uma contratação sendo preparada. Aguarde alguns instantes.";
  if (code === "STRIPE_UNREACHABLE") return "O serviço de pagamento não respondeu agora. Nenhuma cobrança foi criada.";
  if (code === "STRIPE_CHECKOUT_REJECTED") return "Não foi possível abrir o pagamento desta contratação.";
  if (code === "RATE_LIMITED") return "Muitas tentativas em pouco tempo. Aguarde antes de tentar novamente.";
  return "Não foi possível iniciar a contratação agora.";
}

function subscriptionLabel(status: string) {
  if (status === "trial") return "Teste ativo";
  if (status === "grace_period") return "Ativo · cobrança pendente";
  if (status === "complimentary") return "Cortesia";
  return "Ativo";
}

export function AddonPurchaseReadiness({ storeId, addon, canViewBilling }: { storeId: string; addon: StoreAddon; canViewBilling: boolean }) {
  const shouldCheck = canViewBilling && addon.availability_status === "available" && Boolean(addon.monthly_price);
  const preflight = useAddonPurchasePreflight(storeId, addon.code, "monthly", shouldCheck);
  const checkout = useAddonCheckout();

  async function openCheckout() {
    try {
      const result = await checkout.mutateAsync({ storeId, addonCode: addon.code, billingInterval: "monthly", idempotencyKey: crypto.randomUUID() });
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      toast.error(checkoutErrorMessage(error));
    }
  }

  if (!canViewBilling) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
        <span>Somente o proprietário ou responsável financeiro pode contratar este recurso.</span>
      </div>
    );
  }

  if (addon.subscription && ["active", "trial", "grace_period", "complimentary"].includes(addon.subscription.status)) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-success/20 bg-success-soft/45 px-3 py-2.5 text-xs">
        <span className="flex items-center gap-2 font-semibold text-success"><CheckCircle2 className="size-3.5" /> Recurso habilitado</span>
        <Badge variant="success">{subscriptionLabel(addon.subscription.status)}</Badge>
      </div>
    );
  }

  if (addon.availability_status !== "available") {
    return <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">Este recurso ainda não está disponível para contratação.</div>;
  }
  if (!addon.monthly_price) {
    return <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">O valor deste recurso ainda está sendo preparado.</div>;
  }
  if (preflight.isLoading) {
    return <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground" role="status"><Loader2 className="size-3.5 animate-spin" /> Conferindo disponibilidade…</div>;
  }
  if (preflight.isError || !preflight.data) {
    return <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-soft/45 px-3 py-2.5 text-xs text-muted-foreground"><AlertCircle className="mt-0.5 size-3.5 shrink-0 text-warning" />Não foi possível conferir a contratação agora. Tente novamente.</div>;
  }

  if (preflight.data.ready) {
    return (
      <div className="space-y-3 rounded-xl border border-success/20 bg-success-soft/45 px-3 py-3 text-xs">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
          <div>
            <p className="font-semibold text-foreground">Pronto para contratar</p>
            <p className="mt-0.5 text-muted-foreground">O recurso será liberado automaticamente depois da confirmação do pagamento.</p>
          </div>
        </div>
        <Button type="button" size="sm" className="w-full" disabled={checkout.isPending} onClick={() => void openCheckout()}>
          {checkout.isPending ? <><Loader2 className="size-3.5 animate-spin" /> Preparando pagamento…</> : <><ShoppingBag className="size-3.5" /> Contratar agora</>}
        </Button>
      </div>
    );
  }

  const blocker = preflight.data.blockers[0];
  return (
    <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-soft/45 px-3 py-2.5 text-xs text-muted-foreground">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-warning" />
      <div><p className="font-semibold text-foreground">Contratação indisponível agora</p><p className="mt-0.5">{blocker?.message ?? "Ainda existem algumas pendências antes de liberar este recurso."}</p></div>
    </div>
  );
}
