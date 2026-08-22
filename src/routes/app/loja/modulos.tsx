import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Link2,
  Loader2,
  MessageCircle,
  Percent,
  Sparkles,
  Star,
  Truck,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { StoreAddon } from "@/lib/store-addons.functions";
import {
  useAddonCheckout,
  useAddonPurchasePreflight,
  useStoreAddons,
} from "@/store/addons/store-addons.queries";
import { useStoreScope } from "@/store-scope/StoreScopeProvider";

export const Route = createFileRoute("/app/loja/modulos")({
  head: () => ({
    meta: [
      { title: "Módulos e automações | Comandiva" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: StoreModulesPage,
});

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trial",
  "grace_period",
  "complimentary",
]);

function isAddonEnabled(addon: StoreAddon | undefined) {
  return Boolean(addon?.subscription && ACTIVE_SUBSCRIPTION_STATUSES.has(addon.subscription.status));
}

function checkoutErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "ADDON_PURCHASE_NOT_READY") return "A contratação ainda não está liberada para esta loja.";
  if (code === "PROVIDER_PRICE_REQUIRES_RESYNC") return "O preço precisa ser sincronizado novamente com a Stripe.";
  if (code === "STRIPE_NOT_CONFIGURED") return "A Stripe ainda não está pronta para esta contratação.";
  if (code === "ACCOUNT_EMAIL_REQUIRED") return "Sua conta precisa ter um e-mail válido antes da compra.";
  if (code === "CHECKOUT_IN_PROGRESS") return "Já existe um checkout sendo preparado. Tente novamente em instantes.";
  if (code === "STRIPE_UNREACHABLE") return "A Stripe não respondeu agora. Nenhuma cobrança foi criada.";
  if (code === "STRIPE_CHECKOUT_REJECTED") return "A Stripe recusou a criação do checkout.";
  if (code === "RATE_LIMITED") return "Muitas tentativas em pouco tempo. Aguarde alguns instantes.";
  return "Não foi possível abrir o checkout agora.";
}

function StoreModulesPage() {
  const { storeId } = useStoreScope();
  const addons = useStoreAddons(storeId);
  const checkout = useAddonCheckout();
  const canViewBilling = addons.data?.can_view_billing ?? false;
  const automaticAddon = addons.data?.items.find((item) => item.code === "whatsapp_automation");
  const automaticEnabled = isAddonEnabled(automaticAddon);
  const shouldCheckPurchase = Boolean(
    storeId
      && canViewBilling
      && automaticAddon
      && !automaticEnabled
      && automaticAddon.availability_status === "available"
      && automaticAddon.monthly_price,
  );
  const preflight = useAddonPurchasePreflight(
    storeId,
    "whatsapp_automation",
    "monthly",
    shouldCheckPurchase,
  );

  if (!storeId) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">
        Nenhuma loja vinculada a esta conta.
      </div>
    );
  }

  const monthlyPrice = automaticAddon?.monthly_price
    ? brl.format(automaticAddon.monthly_price.amount_cents / 100)
    : "R$ 39,90";
  const blocker = preflight.data?.blockers?.[0]?.message ?? null;
  const canCheckout = Boolean(preflight.data?.ready && !checkout.isPending);

  async function startAutomaticCheckout() {
    if (!storeId || !automaticAddon || automaticEnabled || !canCheckout) return;
    try {
      const result = await checkout.mutateAsync({
        storeId,
        addonCode: "whatsapp_automation",
        billingInterval: "monthly",
        idempotencyKey: crypto.randomUUID(),
      });
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      toast.error(checkoutErrorMessage(error));
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-3 pb-28 pt-4 sm:px-6 sm:pb-8 sm:pt-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[28px] bg-[#32105C] px-5 py-7 text-white shadow-e2 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-14 -top-16 size-64 rounded-full bg-[#7C3AED]/35 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-24 size-48 rounded-full bg-[#FF6A4D]/20 blur-3xl" />
        <div className="relative grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/85">
              <Sparkles className="size-3.5 text-[#FFC286]" /> Módulos e automações
            </div>
            <h1 className="font-display text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
              Ative só o que vale a pena agora
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              Uma página mais simples: o que já funciona, o que pode ser contratado hoje e o que realmente entra nas próximas fases do Comandiva.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 lg:w-[390px]">
            <HeroMetric icon={Star} label="5 módulos" detail="priorizados" />
            <HeroMetric icon={BadgeDollarSign} label="Baixo custo" detail="primeiro" />
            <HeroMetric icon={Link2} label="Evolution" detail="integrado" />
          </div>
        </div>
      </section>

      <Card className="overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-50/90 via-white to-white shadow-sm dark:from-emerald-950/20 dark:via-card dark:to-card">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700/80 dark:text-emerald-300/80">
                  Plano recomendado
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-2xl font-black tracking-tight">Automático</h2>
                  {automaticEnabled ? (
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                      {automaticAddon?.subscription?.status === "complimentary" ? "Cortesia ativa" : "Ativo"}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 max-w-md text-sm leading-5 text-muted-foreground">
                  Centraliza WhatsApp, avisos de pedido e templates automáticos. O envio manual já vem incluído.
                </p>
              </div>
            </div>

            <div className="shrink-0 sm:text-right">
              {canViewBilling ? (
                <>
                  <p className="font-display text-3xl font-black tracking-tight text-emerald-700 dark:text-emerald-300">
                    {monthlyPrice}
                    <span className="ml-1 text-sm font-bold text-emerald-700/70 dark:text-emerald-300/70">/mês</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Manual incluído, sem cobrança duplicada.</p>
                </>
              ) : (
                <p className="text-sm font-semibold text-muted-foreground">Valores visíveis ao proprietário.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary/70">Prioridade agora</p>
            <h2 className="mt-1 font-display text-2xl font-black tracking-tight">O que realmente vamos usar</h2>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex">Foco enxuto</Badge>
        </div>

        <PriorityModuleCard
          number="1"
          icon={MessageCircle}
          accent="emerald"
          title="WhatsApp da loja"
          description="Canal principal para contato e atualizações automáticas dos pedidos."
          label="Via Evolution API"
          status={automaticEnabled ? "Ativo" : "Pronto"}
          bullets={[
            "Conexão por QR Code",
            "Mensagens automáticas por status",
            "Templates editáveis",
            "Status de conexão ao vivo",
          ]}
          action={
            automaticEnabled ? (
              <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                <Link to="/app/loja/whatsapp">Gerenciar</Link>
              </Button>
            ) : canViewBilling ? (
              <Button
                type="button"
                size="sm"
                className="w-full bg-[#FF6A3D] text-white hover:bg-[#EE5A2D] sm:w-auto"
                onClick={() => void startAutomaticCheckout()}
                disabled={!canCheckout}
              >
                {checkout.isPending ? (
                  <><Loader2 className="size-4 animate-spin" /> Abrindo…</>
                ) : preflight.isLoading ? (
                  <><Loader2 className="size-4 animate-spin" /> Validando…</>
                ) : preflight.data?.ready ? (
                  <><ExternalLink className="size-4" /> Contratar</>
                ) : (
                  "Indisponível"
                )}
              </Button>
            ) : (
              <Badge variant="outline">Somente proprietário</Badge>
            )
          }
          note={!automaticEnabled && blocker ? blocker : undefined}
        />

        <PriorityModuleCard
          number="2"
          icon={Truck}
          accent="green"
          title="Entrega inteligente"
          description="Organiza retirada, entrega, bairros e regras operacionais sem depender de API paga."
          status="Pronto"
          bullets={[
            "Bairros e taxas",
            "Entrega e retirada",
            "Pedido mínimo",
            "Previsão de entrega",
          ]}
          action={
            <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
              <Link to="/app/loja/configuracoes/atendimento">Configurar</Link>
            </Button>
          }
        />

        <PriorityModuleCard
          number="3"
          icon={UtensilsCrossed}
          accent="purple"
          title="Cardápio inteligente"
          description="Melhora apresentação, disponibilidade e organização dos produtos."
          status="Pronto"
          bullets={[
            "Categorias e combos",
            "Adicionais e variações",
            "Controle de disponibilidade",
            "Destaques do cardápio",
          ]}
          action={
            <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
              <Link to="/app/loja/cardapio">Abrir</Link>
            </Button>
          }
        />

        <PriorityModuleCard
          number="4"
          icon={Percent}
          accent="orange"
          title="Cupons e campanhas"
          description="Aumenta conversão com ações simples antes de partir para ferramentas caras."
          status="Próxima fase"
          bullets={[
            "Cupom de desconto",
            "Upsell no pedido",
            "Combos promocionais",
            "Campanhas por link",
          ]}
          action={<Button size="sm" variant="outline" disabled className="w-full sm:w-auto">Planejado</Button>}
        />

        <PriorityModuleCard
          number="5"
          icon={Star}
          accent="gold"
          title="Fidelização e avaliações"
          description="Trabalha pós-venda, reputação e recorrência sem complicar a operação."
          status="Próxima fase"
          bullets={[
            "Pedir avaliação",
            "Recuperar clientes",
            "Pós-venda no WhatsApp",
            "Base de clientes",
          ]}
          action={<Button size="sm" variant="outline" disabled className="w-full sm:w-auto">Planejado</Button>}
        />
      </section>

      <section className="space-y-3">
        <div className="px-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Fora do foco inicial</p>
          <h2 className="mt-1 font-display text-xl font-black tracking-tight">O que saiu desta página</h2>
        </div>
        <Card className="border-dashed shadow-none">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap gap-2">
              {[
                "E-mail transacional complexo",
                "Ads",
                "Marketing Pro",
                "Fiscal automatizado",
                "IA paga sem limite",
              ].map((item) => (
                <Badge key={item} variant="outline" className="bg-muted/30 font-medium text-muted-foreground">
                  × {item}
                </Badge>
              ))}
            </div>
            <p className="text-sm leading-5 text-muted-foreground">
              Esses itens não somem do roadmap. Eles apenas deixam de competir por atenção enquanto o núcleo que já gera valor ainda está sendo consolidado.
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 shadow-[0_-10px_30px_rgba(43,20,58,0.08)] backdrop-blur sm:static sm:rounded-2xl sm:border sm:p-4 sm:shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-muted-foreground">
              {automaticEnabled ? "Automático já habilitado" : "Plano recomendado: Automático"}
            </p>
            {canViewBilling ? (
              <p className="font-display text-xl font-black tracking-tight">
                {monthlyPrice}<span className="ml-1 text-xs font-semibold text-muted-foreground">/mês</span>
              </p>
            ) : null}
          </div>

          {automaticEnabled ? (
            <Button asChild className="shrink-0 bg-[#FF6A3D] text-white hover:bg-[#EE5A2D]">
              <Link to="/app/loja/whatsapp"><MessageCircle className="size-4" /> Abrir WhatsApp</Link>
            </Button>
          ) : canViewBilling ? (
            <Button
              type="button"
              className="shrink-0 bg-[#FF6A3D] text-white hover:bg-[#EE5A2D]"
              disabled={!canCheckout}
              onClick={() => void startAutomaticCheckout()}
            >
              {checkout.isPending ? (
                <><Loader2 className="size-4 animate-spin" /> Abrindo…</>
              ) : preflight.isLoading ? (
                <><Loader2 className="size-4 animate-spin" /> Validando…</>
              ) : preflight.data?.ready ? (
                <><Zap className="size-4" /> Ativar automações</>
              ) : (
                "Compra indisponível"
              )}
            </Button>
          ) : (
            <Button type="button" disabled className="shrink-0">Somente proprietário</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function HeroMetric({
  icon: Icon,
  label,
  detail,
}: {
  icon: typeof Star;
  label: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/[0.08] px-3 py-3 text-center backdrop-blur-sm">
      <Icon className="mx-auto size-5 text-[#FFC286]" />
      <p className="mt-2 text-xs font-black leading-4 text-white">{label}</p>
      <p className="text-[10px] font-semibold text-white/55">{detail}</p>
    </div>
  );
}

type Accent = "emerald" | "green" | "purple" | "orange" | "gold";

const accentStyles: Record<Accent, { border: string; icon: string; dot: string }> = {
  emerald: {
    border: "border-l-emerald-500",
    icon: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  green: {
    border: "border-l-green-500",
    icon: "bg-green-500/10 text-green-700 dark:text-green-300",
    dot: "bg-green-500",
  },
  purple: {
    border: "border-l-violet-500",
    icon: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  orange: {
    border: "border-l-orange-500",
    icon: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  gold: {
    border: "border-l-amber-500",
    icon: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
};

function PriorityModuleCard({
  number,
  icon: Icon,
  accent,
  title,
  description,
  label,
  status,
  bullets,
  action,
  note,
}: {
  number: string;
  icon: typeof MessageCircle;
  accent: Accent;
  title: string;
  description: string;
  label?: string;
  status: "Pronto" | "Ativo" | "Próxima fase";
  bullets: string[];
  action: React.ReactNode;
  note?: string;
}) {
  const styles = accentStyles[accent];
  const ready = status === "Pronto" || status === "Ativo";

  return (
    <Card className={`overflow-hidden border-l-4 ${styles.border} shadow-sm`}>
      <CardContent className="p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(250px,0.9fr)_auto] lg:items-center">
          <div className="flex min-w-0 gap-3 sm:gap-4">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-muted text-xs font-black text-muted-foreground">{number}</span>
              <div className={`grid size-11 place-items-center rounded-2xl ${styles.icon}`}>
                <Icon className="size-5" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-black tracking-tight">{title}</h3>
                {label ? <Badge variant="outline" className="text-[10px]">{label}</Badge> : null}
              </div>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
              {note ? (
                <p className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs leading-4 text-amber-800 dark:text-amber-300">
                  {note}
                </p>
              ) : null}
            </div>
          </div>

          <ul className="grid gap-1.5 pl-10 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-1 lg:pl-0">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2">
                <span className={`mt-2 size-1.5 shrink-0 rounded-full ${styles.dot}`} />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2 pl-10 sm:flex-row sm:items-center sm:justify-between lg:pl-0 lg:flex-col lg:items-end">
            <Badge
              variant="outline"
              className={
                ready
                  ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300"
                  : "border-orange-500/25 bg-orange-500/[0.08] text-orange-700 dark:text-orange-300"
              }
            >
              {ready ? <CheckCircle2 className="mr-1 size-3.5" /> : <Clock3 className="mr-1 size-3.5" />}
              {status}
            </Badge>
            {action}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
