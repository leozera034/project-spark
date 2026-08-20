import { Link } from "@tanstack/react-router";
import { AlertTriangle, Clock3, CreditCard, Gift, ShieldCheck, WalletCards } from "lucide-react";

import type { StoreBillingAccess } from "@/lib/store-billing.functions";
import { cn } from "@/lib/utils";

type BannerTone = "brand" | "warning" | "danger" | "muted";

type BannerCopy = {
  title: string;
  description: string;
  tone: BannerTone;
  icon: typeof ShieldCheck;
  actionLabel?: string;
  actionTo?: "/app/loja/plano" | "/app/loja/configuracoes";
};

const toneClass: Record<BannerTone, string> = {
  brand: "border-brand/20 bg-brand/5 text-foreground",
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

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

function formatMoney(cents: number | null | undefined, currency = "BRL") {
  if (cents == null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL" }).format(cents / 100);
}

function planLabel(code: string | null) {
  if (!code) return "Comandiva";
  const labels: Record<string, string> = {
    gratis: "Grátis",
    essencial: "Essencial",
    profissional: "Profissional",
    avancado: "Avançado",
  };
  return labels[code] ?? code;
}

function copyFor(access: StoreBillingAccess): BannerCopy | null {
  switch (access.stage) {
    case "full": {
      if (access.billing_source === "manual_access") {
        return {
          title: `Plano ${planLabel(access.plan_code)} · acesso administrativo`,
          description: "Os recursos estão liberados, mas não existe assinatura Stripe confirmada para esta loja. Isso não é mensalidade paga.",
          tone: "warning",
          icon: WalletCards,
          actionLabel: "Configurar cobrança",
          actionTo: "/app/loja/plano",
        };
      }
      const renewal = formatDate(access.next_charge_at ?? access.current_period_end);
      return {
        title: `Plano ${planLabel(access.plan_code)} · cobrança Stripe confirmada`,
        description: renewal
          ? `Assinatura regular. Próxima renovação em ${renewal}.`
          : "Assinatura regular confirmada pelo provedor de pagamento.",
        tone: "muted",
        icon: ShieldCheck,
        actionLabel: "Ver plano e cobrança",
        actionTo: "/app/loja/plano",
      };
    }
    case "free":
      return {
        title: "Plano Grátis",
        description: "Sua loja está no plano gratuito e não possui mensalidade recorrente. Você pode comparar e contratar um plano pago quando quiser.",
        tone: "muted",
        icon: ShieldCheck,
        actionLabel: "Ver planos",
        actionTo: "/app/loja/plano",
      };
    case "trial": {
      const days = daysUntil(access.trial_ends_at);
      return {
        title: `Teste do plano ${planLabel(access.plan_code)}`,
        description:
          days === null
            ? "Seu período gratuito está ativo. Você pode conhecer os recursos antes de escolher um plano."
            : days === 0
              ? "Seu período gratuito termina hoje. Se você não assinar, sua loja continua no plano Grátis sem perder cardápio ou histórico."
              : `Faltam ${days} dia${days === 1 ? "" : "s"} para o fim do teste. Se você não assinar, sua loja continua no plano Grátis sem perder cardápio ou histórico.`,
        tone: "brand",
        icon: Clock3,
        actionLabel: "Ver planos",
        actionTo: "/app/loja/plano",
      };
    }
    case "complimentary": {
      const days = daysUntil(access.complimentary_until);
      return {
        title: `Cortesia do plano ${planLabel(access.plan_code)}`,
        description:
          days === null
            ? "Sua loja está em período de cortesia concedido pela equipe Comandiva."
            : `Sua cortesia permanece ativa por mais ${days} dia${days === 1 ? "" : "s"}.`,
        tone: "brand",
        icon: Gift,
        actionLabel: "Ver plano",
        actionTo: "/app/loja/plano",
      };
    }
    case "notice":
      return {
        title: `Pagamento pendente · Plano ${planLabel(access.plan_code)}`,
        description: `A cobrança está em atraso há ${access.overdue_days} dia${access.overdue_days === 1 ? "" : "s"}. A operação continua normal por enquanto.`,
        tone: "warning",
        icon: CreditCard,
        actionLabel: "Regularizar",
        actionTo: "/app/loja/plano",
      };
    case "restricted_growth":
      return {
        title: "Recursos de crescimento pausados",
        description: `Pagamento em atraso há ${access.overdue_days} dias. Pedidos e cardápio continuam funcionando, mas campanhas e automações ficam pausadas até a regularização.`,
        tone: "warning",
        icon: AlertTriangle,
        actionLabel: "Regularizar",
        actionTo: "/app/loja/plano",
      };
    case "restricted_writes":
      return {
        title: "Alterações administrativas pausadas",
        description: `Pagamento em atraso há ${access.overdue_days} dias. A loja continua recebendo e processando pedidos, mas alterações de cardápio, equipe e configurações ficam pausadas.`,
        tone: "warning",
        icon: AlertTriangle,
        actionLabel: "Regularizar",
        actionTo: "/app/loja/plano",
      };
    case "suspended_orders":
      return {
        title: "Novos pedidos temporariamente pausados",
        description: `Pagamento em atraso há ${access.overdue_days} dias. Pedidos já existentes continuam acessíveis para conclusão e nenhum dado foi apagado.`,
        tone: "danger",
        icon: AlertTriangle,
        actionLabel: "Regularizar agora",
        actionTo: "/app/loja/plano",
      };
    case "trial_expired":
      return {
        title: "Período de teste encerrado",
        description: "Estamos ajustando sua conta para o plano Grátis. Seu cardápio e histórico permanecem preservados.",
        tone: "muted",
        icon: Clock3,
        actionLabel: "Ver planos",
        actionTo: "/app/loja/plano",
      };
    case "billing_unconfigured":
      return {
        title: "Plano ainda não configurado",
        description: "A equipe Comandiva precisa concluir a configuração comercial desta loja antes de liberar novos pedidos.",
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
  const planPrice = formatMoney(access.plan_amount_cents, access.currency ?? "BRL");
  const lastPaid = formatMoney(access.last_paid_amount_cents, access.currency ?? "BRL");
  const lastPaidAt = formatDate(access.last_paid_at);
  const nextCharge = formatDate(access.next_charge_at ?? access.current_period_end);

  return (
    <div className="px-3 pt-3 sm:px-6 lg:px-8">
      <div
        role={copy.tone === "danger" ? "alert" : "status"}
        className={cn(
          "mx-auto w-full max-w-7xl rounded-2xl border px-4 py-3 shadow-sm sm:px-5",
          toneClass[copy.tone],
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-background/80 shadow-sm">
              <Icon className="size-4.5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-5">{copy.title}</p>
              <p className="mt-0.5 text-sm leading-5 opacity-80">{copy.description}</p>
            </div>
          </div>

          {copy.actionLabel && copy.actionTo ? (
            <Link
              to={copy.actionTo as never}
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-current/15 bg-background/80 px-4 text-sm font-semibold shadow-sm transition hover:bg-background"
            >
              {copy.actionLabel}
            </Link>
          ) : null}
        </div>

        <div className="mt-3 grid gap-2 border-t border-current/10 pt-3 text-xs sm:grid-cols-3">
          <span><strong>Valor do plano:</strong> {planPrice ? `${planPrice}/${access.billing_interval === "annual" ? "ano" : "mês"}` : "—"}</span>
          <span><strong>Último pagamento:</strong> {lastPaid && lastPaidAt ? `${lastPaid} em ${lastPaidAt}` : "nenhum pagamento confirmado"}</span>
          <span><strong>Próxima cobrança:</strong> {access.payment_verified && nextCharge ? nextCharge : "não agendada"}</span>
        </div>
      </div>
    </div>
  );
}
