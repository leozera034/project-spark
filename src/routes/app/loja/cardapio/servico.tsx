import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness, CheckCircle2, Clock3, CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useCatalog } from "@/catalog/CatalogProvider";
import {
  createProfessionalServiceCheckout,
  listProfessionalServiceOrders,
  listProfessionalServices,
  requestProfessionalService,
  type ProfessionalServiceOrder,
} from "@/catalog/professional-services";
import { PageHeader } from "@/components/catalog/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/app/loja/cardapio/servico")({ component: MenuImplementationServicePage });

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function MenuImplementationServicePage() {
  const { storeId } = useCatalog();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const services = useQuery({
    queryKey: ["catalog", "professional-services", storeId],
    enabled: Boolean(storeId),
    queryFn: () => listProfessionalServices(storeId!),
    retry: false,
  });
  const orders = useQuery({
    queryKey: ["catalog", "professional-service-orders", storeId],
    enabled: Boolean(storeId),
    queryFn: () => listProfessionalServiceOrders(storeId!),
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data as ProfessionalServiceOrder[] | undefined;
      return data?.some((item) => item.status === "awaiting_payment") ? 5000 : false;
    },
  });
  const service = services.data?.find((item) => item.code === "menu_implementation") ?? null;
  const openOrder = orders.data?.find((item) => ["requested", "awaiting_payment", "paid", "in_progress"].includes(item.status)) ?? null;

  const checkout = useMutation({
    mutationFn: async (orderId: string) => {
      if (!storeId) throw new Error("Loja não selecionada.");
      return createProfessionalServiceCheckout(storeId, orderId);
    },
    onSuccess: (result) => {
      window.location.assign(result.checkoutUrl);
    },
    onError: () => toast.error("Não foi possível abrir o pagamento agora."),
  });

  const request = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error("Loja não selecionada.");
      const order = await requestProfessionalService(storeId, "menu_implementation", notes);
      return { order, checkout: await createProfessionalServiceCheckout(storeId, order.id) };
    },
    onSuccess: async ({ checkout: result }) => {
      setNotes("");
      await queryClient.invalidateQueries({ queryKey: ["catalog", "professional-services", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["catalog", "professional-service-orders", storeId] });
      window.location.assign(result.checkoutUrl);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("SERVICE_ORDER_ALREADY_OPEN")) toast.error("Já existe uma solicitação deste serviço em andamento.");
      else if (message.includes("SERVICE_PRICE_NOT_CONFIGURED")) toast.error("Este serviço não está disponível para contratação agora.");
      else toast.error("Não foi possível criar a solicitação ou iniciar o pagamento.");
    },
  });

  if (services.isLoading) {
    return <div className="space-y-4"><PageHeader title="Serviço de cardápio" description="Carregando disponibilidade…" /><div className="h-40 animate-pulse rounded-2xl border border-border bg-muted/35" /></div>;
  }

  if (services.isError || !service || !service.price_cents) {
    return (
      <div className="space-y-5">
        <PageHeader title="Serviço de cardápio" description="Este serviço opcional não está disponível para contratação no momento." />
        <Card><CardContent className="p-5 text-sm text-muted-foreground">Você pode continuar montando e editando seu cardápio normalmente pela Comandiva.</CardContent></Card>
        <Button asChild variant="outline"><Link to="/app/loja/cardapio">Voltar ao cardápio</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Comandiva monta meu cardápio" description="Serviço profissional opcional e avulso. Não altera o valor da sua assinatura mensal." />

      <Card className="border-brand/25 bg-brand-soft/25">
        <CardHeader>
          <div className="mb-1 grid size-11 place-items-center rounded-xl bg-brand text-brand-foreground"><BriefcaseBusiness className="size-5" /></div>
          <CardTitle>Implantação completa do cardápio</CardTitle>
          <CardDescription>{service.description ?? "Nossa equipe organiza a estrutura inicial do seu cardápio para você começar mais rápido."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {["Categorias e produtos", "Tamanhos e variações", "Adicionais e escolhas", "Estrutura pronta para revisar"].map((item) => (
              <div key={item} className="flex gap-2 rounded-xl border bg-background/70 p-3 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" /><span>{item}</span></div>
            ))}
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-xs font-bold uppercase tracking-[.1em] text-muted-foreground">Valor do serviço</p>
            <p className="mt-1 text-2xl font-black">{brl.format(service.price_cents / 100)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Cobrança única. Não é recorrente e não entra na mensalidade do plano.</p>
          </div>

          {openOrder ? (
            <div className="space-y-3 rounded-xl border border-brand/20 bg-brand-soft/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><strong>Solicitação em andamento</strong><Badge variant="brandSoft">{statusLabel(openOrder.status)}</Badge></div>
              <p className="text-sm text-muted-foreground">Pedido criado em {new Date(openOrder.requested_at).toLocaleString("pt-BR")}.</p>
              {openOrder.status === "awaiting_payment" ? (
                <Button disabled={checkout.isPending} onClick={() => checkout.mutate(openOrder.id)}>
                  {checkout.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CreditCard className="mr-2 size-4" />}
                  Continuar pagamento
                </Button>
              ) : openOrder.status === "paid" ? (
                <p className="text-sm font-medium text-success">Pagamento confirmado. A solicitação já está na fila de implantação.</p>
              ) : openOrder.status === "in_progress" ? (
                <p className="text-sm font-medium text-brand">Seu cardápio está em implantação pela equipe.</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="font-semibold">Conte um pouco sobre seu cardápio</p>
                <p className="text-sm text-muted-foreground">Ex.: quantos produtos tem, se já possui fotos, adicionais, tamanhos ou um arquivo/PDF atual.</p>
              </div>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} placeholder="Ex.: Tenho cerca de 45 produtos, 3 tamanhos de pizza e já tenho as fotos prontas..." />
              <Button disabled={request.isPending} onClick={() => request.mutate()}>
                {request.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CreditCard className="mr-2 size-4" />}
                Solicitar e pagar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock3 className="size-4" /> Histórico</CardTitle><CardDescription>Acompanhe solicitações anteriores deste serviço.</CardDescription></CardHeader>
        <CardContent>
          {orders.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : !orders.data?.length ? <p className="text-sm text-muted-foreground">Nenhuma solicitação ainda.</p> : (
            <div className="space-y-2">{orders.data.map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"><div><strong>{order.service_name}</strong><p className="text-xs text-muted-foreground">{new Date(order.requested_at).toLocaleString("pt-BR")}</p></div><div className="text-right"><Badge variant="outline">{statusLabel(order.status)}</Badge>{order.price_cents ? <p className="mt-1 text-xs">{brl.format(order.price_cents / 100)}</p> : null}</div></div>)}</div>
          )}
        </CardContent>
      </Card>

      <Button asChild variant="ghost"><Link to="/app/loja/cardapio">Voltar ao cardápio</Link></Button>
    </div>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = { requested: "Solicitado", awaiting_payment: "Aguardando pagamento", paid: "Pago", in_progress: "Em implantação", delivered: "Entregue", cancelled: "Cancelado", refunded: "Reembolsado" };
  return labels[status] ?? status;
}
