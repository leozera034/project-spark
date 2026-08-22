import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ExternalLink, Loader2, MessageCircle, Truck, Users, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StoreAddon } from "@/lib/store-addons.functions";
import { useAddonCheckout, useAddonPurchasePreflight, useStoreAddons } from "@/store/addons/store-addons.queries";
import { useStoreScope } from "@/store-scope/StoreScopeProvider";

export const Route = createFileRoute("/app/loja/modulos")({
  head: () => ({ meta: [{ title: "Recursos | Comandiva" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: StoreResourcesPage,
});

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trial", "grace_period", "complimentary"]);

function isAddonEnabled(addon: StoreAddon | undefined) {
  return Boolean(addon?.subscription && ACTIVE_SUBSCRIPTION_STATUSES.has(addon.subscription.status));
}

function checkoutErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "ADDON_PURCHASE_NOT_READY") return "A contratação ainda não está liberada para esta loja.";
  if (code === "PROVIDER_PRICE_REQUIRES_RESYNC") return "O preço deste recurso precisa ser atualizado antes da contratação.";
  if (code === "STRIPE_NOT_CONFIGURED") return "O pagamento deste recurso ainda não está disponível.";
  if (code === "ACCOUNT_EMAIL_REQUIRED") return "Adicione um e-mail válido à sua conta antes da compra.";
  if (code === "CHECKOUT_IN_PROGRESS") return "Já existe uma contratação sendo preparada. Tente novamente em instantes.";
  if (code === "STRIPE_UNREACHABLE") return "O serviço de pagamento não respondeu agora. Nenhuma cobrança foi criada.";
  if (code === "RATE_LIMITED") return "Muitas tentativas em pouco tempo. Aguarde alguns instantes.";
  return "Não foi possível abrir a contratação agora.";
}

function StoreResourcesPage() {
  const { storeId, selectedStore } = useStoreScope();
  const addons = useStoreAddons(storeId);
  const checkout = useAddonCheckout();
  const canViewBilling = addons.data?.can_view_billing ?? false;
  const automaticAddon = addons.data?.items.find((item) => item.code === "whatsapp_automation");
  const automaticEnabled = isAddonEnabled(automaticAddon);
  const shouldCheckPurchase = Boolean(
    storeId && canViewBilling && automaticAddon && !automaticEnabled && automaticAddon.availability_status === "available" && automaticAddon.monthly_price,
  );
  const preflight = useAddonPurchasePreflight(storeId, "whatsapp_automation", "monthly", shouldCheckPurchase);

  if (!storeId) return <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">Selecione uma loja para consultar os recursos disponíveis.</div>;

  const monthlyPrice = automaticAddon?.monthly_price ? brl.format(automaticAddon.monthly_price.amount_cents / 100) : null;
  const blocker = preflight.data?.blockers?.[0]?.message ?? null;
  const canCheckout = Boolean(preflight.data?.ready && !checkout.isPending);

  async function startAutomaticCheckout() {
    if (!storeId || !automaticAddon || automaticEnabled || !canCheckout) return;
    try {
      const result = await checkout.mutateAsync({ storeId, addonCode: "whatsapp_automation", billingInterval: "monthly", idempotencyKey: crypto.randomUUID() });
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      toast.error(checkoutErrorMessage(error));
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand">Conta</p>
          {selectedStore ? <Badge variant="outline">{selectedStore.name}</Badge> : null}
        </div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight">Recursos</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Aqui aparecem apenas recursos que já existem no produto e podem ser usados ou contratados agora.</p>
      </header>

      <Card className="overflow-hidden border-success/25">
        <CardHeader className="bg-success-soft/35">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-success-soft text-success"><MessageCircle className="size-5" /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2"><CardTitle>WhatsApp Automático</CardTitle>{automaticEnabled ? <Badge variant="success">Ativo</Badge> : <Badge variant="outline">Opcional</Badge>}</div>
                <CardDescription className="mt-1">Avisos automáticos de pedido, mensagens personalizadas e envio manual pelo mesmo número conectado.</CardDescription>
              </div>
            </div>
            {canViewBilling && monthlyPrice ? <p className="shrink-0 font-display text-2xl font-black">{monthlyPrice}<span className="ml-1 text-xs font-semibold text-muted-foreground">/mês</span></p> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {["Conexão por QR Code", "Avisos por status do pedido", "Mensagens editáveis", "Histórico de mensagens"].map((item) => <div key={item} className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted/30 p-3 text-sm"><CheckCircle2 className="size-4 shrink-0 text-success" /> {item}</div>)}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {automaticEnabled ? (
              <Button asChild><Link to="/app/loja/whatsapp">Gerenciar WhatsApp</Link></Button>
            ) : canViewBilling ? (
              <Button onClick={() => void startAutomaticCheckout()} disabled={!canCheckout}>
                {checkout.isPending || preflight.isLoading ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
                {preflight.isLoading ? "Verificando…" : preflight.data?.ready ? "Contratar" : "Indisponível"}
              </Button>
            ) : <Badge variant="outline">Contratação pelo proprietário</Badge>}
            {!automaticEnabled && blocker ? <p className="text-xs text-muted-foreground">{blocker}</p> : null}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div><h2 className="font-display text-xl font-black">Incluídos na operação</h2><p className="mt-1 text-sm text-muted-foreground">Essas áreas já fazem parte da plataforma e não precisam ser ativadas aqui.</p></div>
        <div className="grid gap-3 md:grid-cols-3">
          <ResourceCard icon={UtensilsCrossed} title="Cardápio" description="Produtos, categorias, adicionais, variações e disponibilidade." to="/app/loja/cardapio" />
          <ResourceCard icon={Truck} title="Entregas" description="Equipe, taxas, distância, devoluções e atribuição de pedidos." to="/app/loja/entregas" />
          <ResourceCard icon={Users} title="Clientes" description="Histórico de compras, recorrência, VIP e clientes inativos." to="/app/loja/crescimento" />
        </div>
      </section>
    </div>
  );
}

function ResourceCard({ icon: Icon, title, description, to }: { icon: typeof Truck; title: string; description: string; to: string }) {
  return <Card><CardHeader><span className="mb-2 grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-5" /></span><CardTitle className="text-base">{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent><Button asChild variant="outline"><Link to={to as never}>Abrir</Link></Button></CardContent></Card>;
}
