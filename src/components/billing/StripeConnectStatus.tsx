import { CreditCard, Landmark, ShieldCheck, TriangleAlert } from "lucide-react";

import type { StripeConnectStatus as StripeConnectStatusData, StripeRuntimeReadiness } from "@/lib/stripe-connect.functions";
import { Badge } from "@/components/ui/badge";

function formatBps(value: number | null | undefined) {
  if (!Number.isFinite(value)) return null;
  return `${((value ?? 0) / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

export function StripeConnectStatus({
  status,
  readiness,
  loading,
}: {
  status?: StripeConnectStatusData;
  readiness?: StripeRuntimeReadiness;
  loading?: boolean;
}) {
  if (loading) return <div className="h-44 animate-pulse rounded-[24px] border border-border bg-muted/45" />;

  const platformReady = readiness?.ready_for_connect === true;
  const accountReady = status?.connected === true && status.charges_enabled === true && status.payouts_enabled === true;
  const requirements = Array.isArray(status?.requirements_currently_due) ? status.requirements_currently_due : [];

  return (
    <article className="panel overflow-hidden">
      <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-soft-foreground">
            <Landmark className="size-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-black text-foreground">Stripe Connect</h2>
              <Badge variant={accountReady ? "success" : platformReady ? "warning" : "outline"}>
                {accountReady ? "Pagamentos liberados" : status?.connected ? "Cadastro em andamento" : platformReady ? "Pronto para conectar" : "Indisponível"}
              </Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              O Stripe Connect vincula a conta de pagamentos da loja ao Comandiva. O dinheiro dos pedidos é processado na conta Stripe da própria loja; o Comandiva não armazena dados de cartão.
            </p>
          </div>
        </div>
        <div className="grid min-w-[230px] gap-2 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
          <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Plataforma</span><strong className="text-foreground">{platformReady ? "Pronta" : "Pendente"}</strong></div>
          <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Cobranças</span><strong className="text-foreground">{status?.charges_enabled ? "Ativas" : "Pendentes"}</strong></div>
          <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Repasses</span><strong className="text-foreground">{status?.payouts_enabled ? "Ativos" : "Pendentes"}</strong></div>
          {formatBps(status?.application_fee_bps) ? <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Taxa Comandiva</span><strong className="text-foreground">{formatBps(status?.application_fee_bps)}</strong></div> : null}
        </div>
      </div>

      {requirements.length > 0 ? (
        <div className="border-t border-border bg-warning-soft/45 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-2 text-sm text-warning-soft-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <p><strong>Cadastro incompleto.</strong> A Stripe ainda exige {requirements.length} requisito{requirements.length === 1 ? "" : "s"} antes de liberar totalmente a conta.</p>
          </div>
        </div>
      ) : accountReady ? (
        <div className="border-t border-border bg-success-soft/45 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-2 text-sm text-success">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <p><strong>Conta operacional.</strong> A loja está apta a receber pagamentos e repasses pelo Stripe Connect.</p>
          </div>
        </div>
      ) : (
        <div className="border-t border-border bg-muted/25 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <CreditCard className="mt-0.5 size-4 shrink-0" />
            <p>O onboarding será disponibilizado no painel da loja quando a conta conectada for criada.</p>
          </div>
        </div>
      )}
    </article>
  );
}
