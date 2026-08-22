import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Bike, CheckCircle2, MapPin, PackageCheck, RouteIcon, RotateCcw, Settings2, ShieldOff, Truck, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useCourierCounts } from "@/store/couriers/hooks/useCouriers";
import { useSetStoreSmartDeliveryPause, useStoreSmartDeliveryControlCenter } from "@/store/integrations/store-smart-delivery.queries";
import { useStoreScope } from "@/store-scope/StoreScopeProvider";

export const Route = createFileRoute("/app/loja/entregas")({
  head: () => ({ meta: [{ title: "Entregas | Comandiva" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: DeliveriesHub,
});

const DELIVERY_AREAS = [
  { icon: Users, title: "Entregadores", description: "Disponibilidade, veículo, acesso e entrega atual de cada entregador.", action: "Gerenciar equipe", to: "/app/loja/entregadores" },
  { icon: PackageCheck, title: "Pedidos para sair", description: "Abra os pedidos prontos e atribua um entregador quando necessário.", action: "Abrir pedidos", to: "/app/loja/pedidos" },
  { icon: RotateCcw, title: "Devoluções", description: "Resolva pedidos que voltaram com nova tentativa, correção ou cancelamento.", action: "Resolver devoluções", to: "/app/loja/devolucoes" },
  { icon: Settings2, title: "Taxas e cobertura", description: "Escolha taxa fixa, por distância ou por bairro e configure prazo e pedido mínimo.", action: "Configurar entrega", to: "/app/loja/configuracoes/bairros" },
] as const;

function DeliveriesHub() {
  const { storeId, selectedStore } = useStoreScope();
  const counts = useCourierCounts(storeId);
  const intelligentRoutes = useStoreSmartDeliveryControlCenter(storeId);
  const routeControl = useSetStoreSmartDeliveryPause();
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const unassigned = counts.data?.unassignedDeliveries ?? 0;
  const smart = intelligentRoutes.data;
  const routesUsage = smart?.usage.items.find((item) => item.metric_code === "routes.compute") ?? null;

  const pauseRoutes = () => {
    if (!storeId) return;
    routeControl.mutate(
      { storeId, paused: true, reason: pauseReason.trim() || null },
      { onSuccess: () => { setPauseOpen(false); setPauseReason(""); } },
    );
  };

  const resumeRoutes = () => {
    if (!storeId) return;
    routeControl.mutate({ storeId, paused: false });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand">Operação</p>{selectedStore ? <Badge variant="outline">{selectedStore.name}</Badge> : null}</div>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight">Entregas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Equipe, pedidos aguardando saída, devoluções, rotas e regras de entrega reunidos em uma única central.</p>
        </div>
        <Button asChild><Link to="/app/loja/entregadores/novo"><Bike className="size-4" /> Novo entregador</Link></Button>
      </header>

      {unassigned > 0 ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-warning/35 bg-warning-soft/55 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-warning"><Truck className="size-5" /></span><div><p className="font-bold">{unassigned} entrega(s) aguardando entregador</p><p className="mt-1 text-sm text-muted-foreground">Atribua alguém para evitar que pedidos prontos fiquem parados na loja.</p></div></div>
          <Button asChild variant="outline" className="shrink-0 bg-background"><Link to="/app/loja/pedidos">Abrir fila <ArrowRight className="size-4" /></Link></Button>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumo das entregas">
        <Metric label="Entregadores ativos" value={counts.data?.active ?? 0} icon={Users} />
        <Metric label="Online agora" value={counts.data?.online ?? 0} icon={Bike} />
        <Metric label="Em entrega" value={counts.data?.busy ?? 0} icon={Truck} />
        <Metric label="Aguardando entregador" value={unassigned} icon={PackageCheck} attention={unassigned > 0} />
      </section>

      <section aria-labelledby="delivery-management-title">
        <div className="mb-3"><h2 id="delivery-management-title" className="font-display text-xl font-black">Gerenciar entregas</h2><p className="mt-1 text-sm text-muted-foreground">Escolha a parte da operação que precisa de atenção.</p></div>
        <div className="grid gap-4 md:grid-cols-2">{DELIVERY_AREAS.map((area) => <ActionCard key={area.to} {...area} />)}</div>
      </section>

      {smart?.smart_delivery_entitled ? (
        <Card className={smart.control.is_paused ? "border-warning/35" : "border-success/25"}>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${smart.control.is_paused ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}>
                  {smart.control.is_paused ? <ShieldOff className="size-5" /> : <RouteIcon className="size-5" />}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2"><CardTitle>Rotas inteligentes</CardTitle><Badge variant={smart.control.is_paused ? "warning" : smart.capabilities.routes_ready ? "success" : "outline"}>{smart.control.is_paused ? "Pausadas" : smart.capabilities.routes_ready ? "Ativas" : "Disponibilidade parcial"}</Badge></div>
                  <CardDescription className="mt-1">Melhora a estimativa de distância e deslocamento quando os dados necessários estão disponíveis.</CardDescription>
                </div>
              </div>
              {smart.control.is_paused ? <Button onClick={resumeRoutes} disabled={routeControl.isPending}>Retomar rotas</Button> : <Button variant="outline" onClick={() => setPauseOpen(true)} disabled={routeControl.isPending}>Pausar rotas</Button>}
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <RouteInfo label="Localização da loja" value={smart.store.coordinates_set ? "Confirmada" : "Precisa confirmar"} ready={smart.store.coordinates_set} />
            <RouteInfo label="Cálculo de rota" value={smart.capabilities.routes_ready && !smart.control.is_paused ? "Disponível" : "Usando alternativa quando possível"} ready={smart.capabilities.routes_ready && !smart.control.is_paused} />
            <RouteInfo label="Rotas neste período" value={routesUsage ? routesUsage.quantity.toLocaleString("pt-BR") : "—"} ready={routesUsage?.next_unit_allowed ?? true} />
            {!smart.store.coordinates_set ? <div className="sm:col-span-3 flex flex-col gap-3 rounded-xl border border-warning/25 bg-warning-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Confirme a localização da loja para melhorar o cálculo de distância.</p><Button asChild variant="outline" size="sm"><Link to="/app/loja/configuracoes/endereco">Conferir endereço</Link></Button></div> : null}
            {smart.jobs.failed > 0 ? <p className="sm:col-span-3 rounded-xl border border-warning/20 bg-warning-soft/30 p-3 text-sm text-muted-foreground">Alguns cálculos de rota falharam recentemente. A operação continua usando as alternativas disponíveis quando possível.</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-brand/15 bg-brand-soft/25">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-brand"><MapPin className="size-5" /></span><div><p className="font-bold">Origem das rotas</p><p className="mt-1 text-sm text-muted-foreground">Mantenha o endereço da loja correto para melhorar distância, taxa e previsão de entrega.</p></div></div>
          <Button asChild variant="outline"><Link to="/app/loja/configuracoes/endereco">Conferir endereço</Link></Button>
        </CardContent>
      </Card>

      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pausar rotas inteligentes?</DialogTitle><DialogDescription>Os pedidos continuam funcionando. Enquanto estiver pausado, a Comandiva usa as alternativas de distância e prazo disponíveis para a loja.</DialogDescription></DialogHeader>
          <div className="space-y-2"><label htmlFor="route-pause-reason" className="text-sm font-semibold">Motivo (opcional)</label><Textarea id="route-pause-reason" value={pauseReason} onChange={(event) => setPauseReason(event.target.value)} maxLength={300} placeholder="Ex.: revisar configuração de entrega" /></div>
          <DialogFooter><Button variant="outline" onClick={() => setPauseOpen(false)} disabled={routeControl.isPending}>Voltar</Button><Button variant="destructive" onClick={pauseRoutes} disabled={routeControl.isPending}>Pausar rotas</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value, icon: Icon, attention = false }: { label: string; value: number; icon: typeof Users; attention?: boolean }) {
  return <Card className={attention ? "border-warning/35" : undefined}><CardContent className="flex items-center justify-between gap-3 p-5"><div><p className="text-xs font-bold uppercase tracking-[.1em] text-muted-foreground">{label}</p><p className="mt-2 font-display text-3xl font-black tabular-nums">{value}</p></div><span className={`grid size-10 place-items-center rounded-xl ${attention ? "bg-warning-soft text-warning" : "bg-brand-soft text-brand"}`}><Icon className="size-5" /></span></CardContent></Card>;
}

function RouteInfo({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return <div className="rounded-xl border border-border bg-surface-muted/30 p-3"><div className="flex items-center gap-2"><CheckCircle2 className={`size-4 ${ready ? "text-success" : "text-muted-foreground"}`} /><p className="text-xs font-bold uppercase tracking-[.08em] text-muted-foreground">{label}</p></div><p className="mt-2 text-sm font-semibold">{value}</p></div>;
}

function ActionCard({ icon: Icon, title, description, action, to }: { icon: typeof Users; title: string; description: string; action: string; to: string }) {
  return <Link to={to as never} className="group block"><Card className="h-full transition hover:border-brand/25 hover:bg-brand-soft/20"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-5" /></span><ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-brand" /></div><CardTitle className="text-lg">{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="pt-0 text-sm font-bold text-brand">{action}</CardContent></Card></Link>;
}
