import { Link } from "@tanstack/react-router";
import { AlertTriangle, Clock3, CreditCard } from "lucide-react";

import type { StoreBillingAccess } from "@/lib/store-billing.functions";
import { cn } from "@/lib/utils";

type BannerTone = "warning" | "danger" | "muted";
type BannerCopy = {
  title: string;
  description: string;
  tone: BannerTone;
  icon: typeof AlertTriangle;
  actionLabel?: string;
  actionTo?: "/app/loja/plano" | "/app/loja/configuracoes";
};

const toneClass: Record<BannerTone, string> = {
  warning: "border-amber-300/70 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100",
  danger: "border-destructive/35 bg-destructive/5 text-foreground",
  muted: "border-border bg-muted/45 text-foreground",
};

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 86_400_000));
}

function copyFor(access: StoreBillingAccess): BannerCopy | null {
  switch (access.stage) {
    case "full":
    case "free":
    case "complimentary":
      return null;
    case "trial": {
      const days = daysUntil(access.trial_ends_at);
      if (days === null || days > 3) return null;
      return {
        title: days === 0 ? "Seu teste termina hoje" : `Seu teste termina em ${days} dia${days === 1 ? "" : "s"}`,
        description: "Confira os planos para manter os recursos pagos. Seu cardápio e histórico permanecem preservados.",
        tone: "warning",
        icon: Clock3,
        actionLabel: "Ver planos",
        actionTo: "/app/loja/plano",
      };
    }
    case "notice":
      return {
        title: "Pagamento pendente",
        description: `Existe uma cobrança em atraso há ${access.overdue_days} dia${access.overdue_days === 1 ? "" : "s"}. A operação continua normal por enquanto.`,
        tone: "warning",
        icon: CreditCard,
        actionLabel: "Regularizar",
        actionTo: "/app/loja/plano",
      };
    case "restricted_growth":
      return {
        title: "Recursos de crescimento pausados",
        description: "Pedidos e cardápio continuam funcionando. Regularize a cobrança para reativar campanhas e automações.",
        tone: "warning",
        icon: AlertTriangle,
        actionLabel: "Regularizar",
        actionTo: "/app/loja/plano",
      };
    case "restricted_writes":
      return {
        title: "Algumas alterações estão pausadas",
        description: "A loja continua operando, mas mudanças administrativas ficam bloqueadas até a regularização.",
        tone: "warning",
        icon: AlertTriangle,
        actionLabel: "Regularizar",
        actionTo: "/app/loja/plano",
      };
    case "suspended_orders":
      return {
        title: "Novos pedidos temporariamente pausados",
        description: "Pedidos existentes continuam acessíveis. Regularize a cobrança para voltar a receber novos pedidos.",
        tone: "danger",
        icon: AlertTriangle,
        actionLabel: "Regularizar agora",
        actionTo: "/app/loja/plano",
      };
    case "trial_expired":
      return {
        title: "Período de teste encerrado",
        description: "Sua conta está sendo ajustada para o plano Grátis. Cardápio e histórico continuam preservados.",
        tone: "muted",
        icon: Clock3,
        actionLabel: "Ver planos",
        actionTo: "/app/loja/plano",
      };
    case "billing_unconfigured":
      return {
        title: "Configuração comercial pendente",
        description: "A configuração da conta precisa ser concluída antes de liberar novos pedidos.",
        tone: "warning",
        icon: AlertTriangle,
        actionLabel: "Abrir configurações",
        actionTo: "/app/loja/configuracoes",
      };
    default:
      return null;
  }
}

export function BillingStatusBanner({ access }: { access: StoreBillingAccess }) {
  const copy = copyFor(access);
  if (!copy) return null;

  const Icon = copy.icon;
  return (
    <div className="px-3 pt-3 sm:px-6 lg:px-8">
      <div role={copy.tone === "danger" ? "alert" : "status"} className={cn("mx-auto w-full max-w-7xl rounded-2xl border px-4 py-3 shadow-sm sm:px-5", toneClass[copy.tone])}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-background/80 shadow-sm"><Icon className="size-4.5" aria-hidden="true" /></div>
            <div className="min-w-0"><p className="text-sm font-bold leading-5">{copy.title}</p><p className="mt-0.5 text-sm leading-5 opacity-80">{copy.description}</p></div>
          </div>
          {copy.actionLabel && copy.actionTo ? (
            <Link to={copy.actionTo as never} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-current/15 bg-background/80 px-4 text-sm font-semibold shadow-sm transition hover:bg-background">{copy.actionLabel}</Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
