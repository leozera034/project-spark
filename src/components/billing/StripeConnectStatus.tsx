import { useState } from "react";
import { ArrowUpRight, CreditCard, Landmark, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { beginStripeConnectOnboarding } from "@/lib/stripe-connect.functions";
import type { StripeConnectStatus as StripeConnectStatusData, StripeRuntimeReadiness } from "@/lib/stripe-connect.functions";

function formatBps(value: number | null | undefined) {
  if (!Number.isFinite(value)) return null;
  return `${((value ?? 0) / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

export function StripeConnectStatus({
  storeId,
  status,
  readiness,
  loading,
  onRefresh,
}: {
  storeId: string;
  status?: StripeConnectStatusData;
  readiness?: StripeRuntimeReadiness;
  loading?: boolean;
  onRefresh?: () => void | Promise<void>;
}) {
  const [starting, setStarting] = useState(false);
  if (loading) return <div className="h-44 animate-pulse rounded-[24px] border border-border bg-muted/45" />;

  const platformReady = readiness?.ready_for_connect === true;
  const accountReady = status?.connected === true && status.charges_enabled === true && status.payouts_enabled === true;
  const requirements = Array.isArray(status?.requirements_currently_due) ? status.requirements_currently_due : [];

  async function startOnboarding() {
    if (starting || !platformReady || accountReady) return;
    setStarting(true);
    try {
      const result = await beginStripeConnectOnboarding({ data: { storeId } });
      if (result.alreadyReady) {
        toast.success("Sua conta de recebimento online já está pronta.");
        await onRefresh?.();
        return;
      }
      if (!result.onboardingUrl) throw new Error("Não foi possível abrir o cadastro agora.");
      window.location.assign(result.onboardingUrl);
    } catch {
      toast.error("Não foi possível abrir a configuração de recebimentos agora.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <article className="panel overflow-hidden">
      <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Landmark className="size-5" /></span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-black text-foreground">Recebimento online</h2>
              <Badge variant={accountReady ? "success" : platformReady ? "warning" : "outline"}>
                {accountReady ? "Pronto para receber" : status?.connected ? "Cadastro em andamento" : platformReady ? "Pronto para configurar" : "Indisponível"}
              </Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Configure a conta que receberá os pagamentos online dos pedidos. Dados de cartão são processados pelo parceiro de pagamento e não ficam armazenados na Comandiva.
            </p>
            {!accountReady && platformReady ? (
              <button type="button" onClick={() => void startOnboarding()} disabled={starting} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-brand-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                {starting ? <Loader2 className="size-4 animate-spin" /> : <ArrowUpRight className="size-4" />}
                {status?.connected ? "Continuar cadastro" : "Configurar recebimentos"}
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid min-w-[230px] gap-2 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
          <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Receber pagamentos</span><strong className="text-foreground">{status?.charges_enabled ? "Liberado" : "Pendente"}</strong></div>
          <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Receber repasses</span><strong className="text-foreground">{status?.payouts_enabled ? "Liberado" : "Pendente"}</strong></div>
          {formatBps(status?.application_fee_bps) ? <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Taxa Comandiva</span><strong className="text-foreground">{formatBps(status?.application_fee_bps)}</strong></div> : null}
        </div>
      </div>

      {requirements.length > 0 ? (
        <div className="border-t border-border bg-warning-soft/45 px-5 py-4 sm:px-6"><div className="flex items-start gap-2 text-sm text-warning-soft-foreground"><TriangleAlert className="mt-0.5 size-4 shrink-0" /><p><strong>Cadastro incompleto.</strong> Ainda existem {requirements.length} etapa{requirements.length === 1 ? "" : "s"} para liberar totalmente os recebimentos.</p></div></div>
      ) : accountReady ? (
        <div className="border-t border-border bg-success-soft/45 px-5 py-4 sm:px-6"><div className="flex items-start gap-2 text-sm text-success"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><p><strong>Tudo pronto.</strong> A loja está apta a receber pagamentos e repasses online.</p></div></div>
      ) : (
        <div className="border-t border-border bg-muted/25 px-5 py-4 sm:px-6"><div className="flex items-start gap-2 text-sm text-muted-foreground"><CreditCard className="mt-0.5 size-4 shrink-0" /><p>O cadastro financeiro é concluído em ambiente seguro do parceiro de pagamento.</p></div></div>
      )}
    </article>
  );
}
