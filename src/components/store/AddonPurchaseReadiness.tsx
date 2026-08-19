import { AlertCircle, CheckCircle2, ExternalLink, Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StoreAddon } from "@/lib/store-addons.functions";
import { useAddonCheckout, useAddonPurchasePreflight } from "@/store/addons/store-addons.queries";

function checkoutErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "ADDON_PURCHASE_NOT_READY") return "A contratação deixou de estar disponível. Atualize a página e confira as pendências.";
  if (code === "PROVIDER_PRICE_REQUIRES_RESYNC") return "O preço precisa ser sincronizado novamente com o Mercado Pago antes do checkout.";
  if (code === "MERCADO_PAGO_TEST_NOT_CONFIGURED") return "O ambiente de teste do Mercado Pago ainda não está configurado.";
  if (code === "ACCOUNT_EMAIL_REQUIRED") return "Sua conta precisa ter um e-mail válido para iniciar a assinatura de teste.";
  if (code === "CHECKOUT_IN_PROGRESS") return "Já existe uma tentativa sendo criada. Tente novamente em instantes.";
  if (code === "MERCADO_PAGO_UNREACHABLE") return "O Mercado Pago não respondeu agora. Nenhuma nova cobrança foi confirmada.";
  if (code === "MERCADO_PAGO_CHECKOUT_REJECTED") return "O Mercado Pago recusou a criação do checkout de teste.";
  if (code === "RATE_LIMITED") return "Muitas tentativas em pouco tempo. Aguarde antes de tentar novamente.";
  return "Não foi possível criar o checkout de teste.";
}

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
  const checkout = useAddonCheckout();

  async function openTestCheckout() {
    try {
      const result = await checkout.mutateAsync({
        storeId,
        addonCode: addon.code,
        billingInterval: "monthly",
        idempotencyKey: crypto.randomUUID(),
      });
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      toast.error(checkoutErrorMessage(error));
    }
  }

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
      <div className="space-y-3 rounded-xl border border-success/20 bg-success-soft/45 px-3 py-3 text-xs text-success">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
          <div>
            <p className="font-semibold">Disponível para checkout de teste</p>
            <p className="mt-0.5 text-success/80">
              Ambiente TEST do Mercado Pago. A ativação só ocorre depois da confirmação autoritativa do webhook.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={checkout.isPending}
          onClick={() => void openTestCheckout()}
        >
          {checkout.isPending ? (
            <><Loader2 className="size-3.5 animate-spin" /> Criando checkout…</>
          ) : (
            <><ExternalLink className="size-3.5" /> Abrir checkout TEST</>
          )}
        </Button>
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
