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
  warning: "border-warning/30 bg-warning-soft/65 text-foreground",
  danger: "border-danger/30 bg-danger-soft/55 text-foreground",
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
        description: "Escolha um plano para manter os recursos pagos. Seu cardápio, pedidos e histórico continuam preservados.",
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
        actionLabel: "Regularizar pagamento",
        actionTo: "/app/loja/plano",
      };
    case "restricted_growth":
      return {
        title: "Alguns recursos extras estão pausados",
        description: "Pedidos e cardápio continuam funcionando. Regularize o pagamento para reativar campanhas e mensagens automáticas.",
        tone: "warning",
        icon: AlertTriangle,
        actionLabel: "Regularizar pagamento",
        actionTo: "/app/loja/plano",
      };
    case "restricted_writes":
      return {
        title: "Algumas alterações estão pausadas",
        description: "A loja continua operando, mas mudanças administrativas ficam bloqueadas até a regularização do pagamento.",
        tone: "warning",
        icon: AlertTriangle,
        actionLabel: "Regularizar pagamento",
        actionTo: "/app/loja/plano",
      };
    case "suspended_orders":
      return {
        title: "Novos pedidos temporariamente pausados",
        description: "Pedidos existentes continuam acessíveis. Regularize o pagamento para voltar a receber novos pedidos.",
        tone: "danger",
        icon: AlertTriangle,
        actionLabel: "Regularizar agora",
        actionTo: "/app/loja/plano",
      };
    case "trial_expired":
      return {
        title: "Período de teste encerrado",
        description: "Sua conta está sendo ajustada para o plano Grátis. Cardápio, pedidos e histórico continuam preservados.",
        tone: "muted",
        icon: Clock3,
        actionLabel: "Ver planos",
        actionTo: "/app/loja/plano",
      };
    case "billing_unconfigured":
      return {
        title: "Conta quase pronta",
        description: "Conclua a configuração comercial para liberar o recebimento de novos pedidos.",
        tone: "warning",
        icon: AlertTriangle,
        actionLabel: "Concluir configuração",
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
      <div role={copy.tone === "danger" ? "alert" : "status"} aria-live={copy.tone === "danger" ? "assertive" : "polite"} className={cn("mx-auto w-full max-w-7xl rounded-2xl border px-4 py-3 shadow-sm sm:px-5", toneClass[copy.tone])}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-background/80 shadow-sm"><Icon className="size-4.5" aria-hidden="true" /></div>
            <div className="min-w-0"><p className="text-sm font-bold leading-5">{copy.title}</p><p className="mt-0.5 text-sm leading-5 text-muted-foreground">{copy.description}</p></div>
          </div>
          {copy.actionLabel && copy.actionTo ? (
            <Link to={copy.actionTo as never} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background/80 px-4 text-sm font-semibold shadow-sm transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{copy.actionLabel}</Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
