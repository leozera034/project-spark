import { createFileRoute } from "@tanstack/react-router";
import {
  Bot,
  CreditCard,
  MapPin,
  Megaphone,
  MessageCircle,
  ReceiptText,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";

import { useAuth } from "@/auth/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStoreAddons } from "@/store/addons/store-addons.queries";
import type { StoreAddon } from "@/lib/store-addons.functions";

export const Route = createFileRoute("/app/loja/modulos")({
  head: () => ({
    meta: [
      { title: "Módulos | Comandiva" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: StoreModulesPage,
});

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const ICONS = {
  whatsapp_automation: MessageCircle,
  ai_assistant: Bot,
  growth_pro: TrendingUp,
  smart_delivery: MapPin,
  reputation: Star,
  fiscal: ReceiptText,
  payments: CreditCard,
  marketing_pro: Megaphone,
  ads: Sparkles,
} as const;

function statusLabel(status: StoreAddon["availability_status"]) {
  if (status === "available") return "Disponível";
  if (status === "beta") return "Beta";
  if (status === "retired") return "Encerrado";
  return "Planejado";
}

function billingLabel(model: StoreAddon["billing_model"]) {
  if (model === "metered") return "Por uso";
  if (model === "hybrid") return "Mensalidade + uso";
  return "Mensalidade fixa";
}

function subscriptionLabel(status: NonNullable<StoreAddon["subscription"]>["status"]) {
  if (status === "active") return "Ativo";
  if (status === "trial") return "Em teste";
  if (status === "past_due") return "Pagamento pendente";
  if (status === "grace_period") return "Em carência";
  if (status === "suspended") return "Suspenso";
  if (status === "cancelled") return "Cancelado";
  if (status === "complimentary") return "Cortesia";
  return "Pendente";
}

function StoreModulesPage() {
  const { authContext } = useAuth();
  const storeId = authContext?.store_ids?.[0] ?? null;
  const addons = useStoreAddons(storeId);

  if (!storeId) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">
        Nenhuma loja vinculada a esta conta.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#4B1D6D] p-6 text-white shadow-e2 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-[#FF6A4D]/20 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold">
            <Sparkles className="size-3.5 text-[#FFB4A2]" /> Comandiva Modules
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Módulos e automações</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
            Recursos adicionais são ativados por loja. Integrações com custo variável terão franquia, medição e limite para evitar cobranças inesperadas.
          </p>
        </div>
      </header>

      <Card className="border-dashed">
        <CardContent className="p-5 text-sm text-muted-foreground">
          Nenhuma integração paga foi ativada. O catálogo abaixo já está ligado ao novo motor de add-ons, mas preços e cobrança só serão liberados após homologação de cada provedor.
        </CardContent>
      </Card>

      {addons.isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Carregando módulos...</div>
      ) : addons.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Não foi possível carregar os módulos agora.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(addons.data?.items ?? []).map((addon) => {
            const Icon = ICONS[addon.code as keyof typeof ICONS] ?? Sparkles;
            return (
              <Card key={addon.code} className="overflow-hidden">
                <CardHeader className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <Badge variant={addon.availability_status === "available" ? "default" : "secondary"}>
                      {statusLabel(addon.availability_status)}
                    </Badge>
                  </div>
                  <div>
                    <CardTitle className="text-lg">{addon.name}</CardTitle>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{addon.description}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{billingLabel(addon.billing_model)}</Badge>
                    {addon.subscription ? (
                      <Badge variant="outline">{subscriptionLabel(addon.subscription.status)}</Badge>
                    ) : null}
                  </div>

                  <div className="rounded-2xl bg-muted/50 p-4">
                    {addon.monthly_price ? (
                      <>
                        <p className="text-2xl font-black">
                          {brl.format(addon.monthly_price.amount_cents / 100)}
                          <span className="text-sm font-medium text-muted-foreground">/mês</span>
                        </p>
                        {addon.monthly_price.included_units !== null ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Inclui {addon.monthly_price.included_units.toLocaleString("pt-BR")} unidades de uso.
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-muted-foreground">Preço ainda não publicado</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
