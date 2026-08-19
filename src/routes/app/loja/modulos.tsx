import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  Bot,
  CheckCircle2,
  CreditCard,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  ReceiptText,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";

import { AddonPurchaseReadiness } from "@/components/store/AddonPurchaseReadiness";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StoreAddon } from "@/lib/store-addons.functions";
import { useStoreAddons } from "@/store/addons/store-addons.queries";
import { useStoreWhatsAppReadiness } from "@/store/growth/store-whatsapp.queries";
import { useStoreEmailReadiness } from "@/store/integrations/store-email.queries";
import { useStorePushReadiness } from "@/store/integrations/store-push.queries";
import { useStoreSmartDeliveryReadiness } from "@/store/integrations/store-smart-delivery.queries";
import { useStoreScope } from "@/store-scope/StoreScopeProvider";

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

function providerLabel(provider: string | null | undefined) {
  if (provider === "meta_whatsapp") return "Meta WhatsApp";
  if (provider === "360dialog_whatsapp") return "360dialog";
  if (provider === "twilio_whatsapp") return "Twilio";
  return "Nenhum conectado";
}

function StoreModulesPage() {
  const { storeId } = useStoreScope();
  const addons = useStoreAddons(storeId);
  const whatsapp = useStoreWhatsAppReadiness(storeId);
  const email = useStoreEmailReadiness(storeId);
  const push = useStorePushReadiness(storeId);
  const smartDelivery = useStoreSmartDeliveryReadiness(storeId);
  const canViewBilling = addons.data?.can_view_billing ?? false;

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
          {addons.data && !canViewBilling
            ? "Você pode conhecer os módulos disponíveis, mas valores e estado de cobrança ficam visíveis apenas ao proprietário da loja."
            : "Nenhuma integração paga foi ativada. O catálogo abaixo já está ligado ao motor de add-ons; a contratação só será liberada quando preço e provedor de cobrança estiverem homologados."}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-success/20">
        <CardHeader className="border-b border-border bg-success-soft/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="size-5 text-success" /> WhatsApp no Comandiva
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                O modo assistido continua gratuito. O automático só entra quando add-on, provider e template estiverem prontos.
              </p>
            </div>
            <Badge variant="outline" className="border-success/30 bg-background/80 text-success">
              <CheckCircle2 className="mr-1 size-3.5" /> Assistido ativo
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-3">
          <ReadinessItem
            label="Add-on automático"
            value={whatsapp.data?.automatic_entitled ? "Ativo" : "Não contratado"}
            ready={Boolean(whatsapp.data?.automatic_entitled)}
          />
          <ReadinessItem
            label="Provider"
            value={providerLabel(whatsapp.data?.provider)}
            ready={Boolean(whatsapp.data?.provider_connected)}
          />
          <ReadinessItem
            label="Templates aprovados"
            value={String(whatsapp.data?.templates_approved ?? 0)}
            ready={(whatsapp.data?.templates_approved ?? 0) > 0}
          />
          <div className="sm:col-span-3 flex flex-col gap-3 rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              {whatsapp.isError
                ? "Não foi possível consultar o estado do WhatsApp agora. Nenhum envio automático é liberado sem validação do backend."
                : whatsapp.data?.ready_for_automatic
                  ? "Infraestrutura pronta para envio automático. O worker do provider ainda precisa estar homologado antes de liberar disparos reais."
                  : "Envio automático permanece bloqueado. O Comandiva não consome API paga enquanto os pré-requisitos acima não estiverem completos."}
            </span>
            <Button asChild variant="outline" className="shrink-0">
              <Link to="/app/loja/whatsapp">Abrir central</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="size-5 text-primary" /> E-mail transacional
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Outbox, idempotência e suppression já fazem parte do core. O envio real só entra com domínio próprio do Comandiva e provider validado.
              </p>
            </div>
            <Badge variant={email.data?.ready_for_send ? "default" : "outline"}>
              {email.data?.ready_for_send ? "Provider pronto" : "Envio bloqueado"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-4">
          <ReadinessItem label="Core transacional" value={email.data?.transactional_core_ready ? "Pronto" : "Indisponível"} ready={Boolean(email.data?.transactional_core_ready)} />
          <ReadinessItem label="API key" value={email.data?.api_key_configured ? "Configurada" : "Pendente"} ready={Boolean(email.data?.api_key_configured)} />
          <ReadinessItem label="Domínio Comandiva" value={email.data?.domain_verified ? (email.data.sending_domain ?? "Verificado") : "Não configurado"} ready={Boolean(email.data?.domain_verified)} />
          <ReadinessItem label="Webhook" value={email.data?.webhook_secret_configured ? "Configurado" : "Pendente"} ready={Boolean(email.data?.webhook_secret_configured)} />
          <div className="sm:col-span-4 rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
            {email.isError
              ? "Não foi possível consultar a infraestrutura de e-mail. O worker permanece bloqueado por segurança."
              : email.data?.ready_for_send
                ? "A infraestrutura do provider está pronta para o worker transacional."
                : "Nenhum e-mail real será enviado enquanto o domínio próprio, a chave do provider e o webhook não estiverem validados. Domínios de outros projetos não são reutilizados."}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Bell className="size-5 text-primary" /> Push operacional · FCM</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">O backend de push já possui outbox, deduplicação, retry, invalidação de token e worker agendado. Nenhuma notificação é enviada sem o Firebase homologado.</p>
            </div>
            <Badge variant={push.data?.ready_for_send ? "default" : "outline"}>{push.data?.ready_for_send ? "Backend FCM pronto" : "FCM bloqueado"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <ReadinessItem label="Core Push" value={push.data?.push_core_ready ? "Pronto" : "Indisponível"} ready={Boolean(push.data?.push_core_ready)} />
          <ReadinessItem label="Credencial Firebase" value={push.data?.credentials_configured ? "Configurada" : "Pendente"} ready={Boolean(push.data?.credentials_configured)} />
          <ReadinessItem label="FCM HTTP v1" value={push.data?.cloud_messaging_api_enabled ? "Habilitada" : "Não validada"} ready={Boolean(push.data?.cloud_messaging_api_enabled)} />
          <ReadinessItem label="Validate-only" value={push.data?.validate_only_verified ? "Validado" : "Pendente"} ready={Boolean(push.data?.validate_only_verified)} />
          <ReadinessItem label="Tokens frescos" value={`${push.data?.fresh_tokens ?? 0} de ${push.data?.active_tokens ?? 0}`} ready={(push.data?.fresh_tokens ?? 0) > 0} />
          <div className="sm:col-span-2 lg:col-span-5 rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
            {push.isError
              ? "Não foi possível consultar o Firebase agora. O worker permanece fail-closed."
              : push.data?.ready_for_send
                ? "O backend FCM está homologado. A entrega no aparelho ainda depende do app nativo do entregador registrar um token real e tratar foreground/background/toque."
                : "O worker e o gatilho de nova entrega já existem, mas permanecem sem envio real até configurar FIREBASE_PROJECT_ID e a conta de serviço correta. O shell Android do entregador também continua sendo um gate separado."}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><MapPin className="size-5 text-primary" /> Entrega inteligente · ETA e rotas</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Bairro continua como fallback gratuito. Coordenadas permitem estimativa local sem API; rotas reais entram somente com add-on e provider homologado.</p>
            </div>
            <Badge variant={smartDelivery.data?.ready_for_smart_routes ? "default" : "outline"}>{smartDelivery.data?.ready_for_smart_routes ? "Smart Delivery pronto" : "Fallback protegido"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <ReadinessItem label="ETA por bairro" value={`${smartDelivery.data?.static_neighborhood_count ?? 0} áreas`} ready={Boolean(smartDelivery.data?.static_neighborhood_eta_available)} />
          <ReadinessItem label="Coordenada da loja" value={smartDelivery.data?.store_coordinates_set ? "Definida" : "Pendente"} ready={Boolean(smartDelivery.data?.store_coordinates_set)} />
          <ReadinessItem label="Aproximação local" value={smartDelivery.data?.local_approximation_ready ? "Disponível" : "Aguardando localização"} ready={Boolean(smartDelivery.data?.local_approximation_ready)} />
          <ReadinessItem label="Add-on Smart Delivery" value={smartDelivery.data?.smart_delivery_entitled ? "Ativo" : "Não contratado"} ready={Boolean(smartDelivery.data?.smart_delivery_entitled)} />
          <ReadinessItem label="Google Routes" value={smartDelivery.data?.provider_ready ? "Homologado" : "Bloqueado"} ready={Boolean(smartDelivery.data?.provider_ready)} />
          <div className="sm:col-span-2 lg:col-span-5 flex flex-col gap-3 rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              {smartDelivery.isError
                ? "Não foi possível consultar o núcleo de rotas. O ETA por bairro continua funcionando e nenhuma API paga é chamada."
                : smartDelivery.data?.ready_for_smart_routes
                  ? "Loja, entitlement e provider estão prontos para rotas inteligentes. Chamadas do Google são medidas e limitadas; respostas Google não são persistidas em cache pelo Comandiva."
                  : smartDelivery.data?.local_approximation_ready
                    ? "A loja já pode usar distância e tempo aproximados sem custo de API. Google Routes permanece desligado até preço, billing e credencial serem homologados."
                    : "O checkout continua usando ETA e taxa por bairro. Capture a localização da loja para habilitar a camada gratuita de aproximação sem alterar a cobrança do pedido."}
            </span>
            <Button asChild variant="outline" className="shrink-0"><Link to="/app/loja/configuracoes/endereco">Configurar localização</Link></Button>
          </div>
        </CardContent>
      </Card>

      {addons.isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Carregando módulos...</div>
      ) : addons.isError ? (
        <Card><CardContent className="p-6 text-sm text-destructive">Não foi possível carregar os módulos agora.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(addons.data?.items ?? []).map((addon) => {
            const Icon = ICONS[addon.code as keyof typeof ICONS] ?? Sparkles;
            return (
              <Card key={addon.code} className="overflow-hidden">
                <CardHeader className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-5" /></div>
                    <Badge variant={addon.availability_status === "available" ? "default" : "secondary"}>{statusLabel(addon.availability_status)}</Badge>
                  </div>
                  <div><CardTitle className="text-lg">{addon.name}</CardTitle><p className="mt-2 text-sm leading-6 text-muted-foreground">{addon.description}</p></div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{billingLabel(addon.billing_model)}</Badge>
                    {addon.subscription ? <Badge variant="outline">{subscriptionLabel(addon.subscription.status)}</Badge> : null}
                  </div>
                  <div className="rounded-2xl bg-muted/50 p-4">
                    {addon.monthly_price ? (
                      <>
                        <p className="text-2xl font-black">{brl.format(addon.monthly_price.amount_cents / 100)}<span className="text-sm font-medium text-muted-foreground">/mês</span></p>
                        {addon.monthly_price.included_units !== null ? <p className="mt-1 text-xs text-muted-foreground">Inclui {addon.monthly_price.included_units.toLocaleString("pt-BR")} unidades de uso.</p> : null}
                      </>
                    ) : <p className="text-sm font-semibold text-muted-foreground">{canViewBilling ? "Preço ainda não publicado" : "Informação comercial restrita ao proprietário"}</p>}
                  </div>
                  <AddonPurchaseReadiness storeId={storeId} addon={addon} canViewBilling={canViewBilling} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReadinessItem({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className={`size-2.5 rounded-full ${ready ? "bg-success" : "bg-muted-foreground/40"}`} />
        <p className="font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
