import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Bike, MapPin, PackageCheck, RotateCcw, Settings2, Truck, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCourierCounts } from "@/store/couriers/hooks/useCouriers";
import { useStoreScope } from "@/store-scope/StoreScopeProvider";

export const Route = createFileRoute("/app/loja/entregas")({
  head: () => ({
    meta: [
      { title: "Entregas | Comandiva" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DeliveriesHub,
});

const DELIVERY_AREAS = [
  {
    icon: Users,
    title: "Entregadores",
    description: "Disponibilidade, veículo, acesso e entrega atual de cada entregador.",
    action: "Gerenciar equipe",
    to: "/app/loja/entregadores",
  },
  {
    icon: PackageCheck,
    title: "Pedidos para sair",
    description: "Abra os pedidos prontos e atribua um entregador quando necessário.",
    action: "Abrir pedidos",
    to: "/app/loja/pedidos",
  },
  {
    icon: RotateCcw,
    title: "Devoluções",
    description: "Resolva pedidos que voltaram com nova tentativa, correção ou cancelamento.",
    action: "Resolver devoluções",
    to: "/app/loja/devolucoes",
  },
  {
    icon: Settings2,
    title: "Taxas e cobertura",
    description: "Escolha taxa fixa, por distância ou por bairro e configure prazo e pedido mínimo.",
    action: "Configurar entrega",
    to: "/app/loja/configuracoes/bairros",
  },
] as const;

function DeliveriesHub() {
  const { storeId, selectedStore } = useStoreScope();
  const counts = useCourierCounts(storeId);
  const unassigned = counts.data?.unassignedDeliveries ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand">Operação</p>
            {selectedStore ? <Badge variant="outline">{selectedStore.name}</Badge> : null}
          </div>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight">Entregas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Equipe, pedidos aguardando saída, devoluções e regras de entrega reunidos em uma única central.
          </p>
        </div>
        <Button asChild>
          <Link to="/app/loja/entregadores/novo"><Bike className="size-4" /> Novo entregador</Link>
        </Button>
      </header>

      {unassigned > 0 ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-warning/35 bg-warning-soft/55 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-warning"><Truck className="size-5" /></span>
            <div>
              <p className="font-bold">{unassigned} entrega(s) aguardando entregador</p>
              <p className="mt-1 text-sm text-muted-foreground">Atribua alguém para evitar que pedidos prontos fiquem parados na loja.</p>
            </div>
          </div>
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
        <div className="mb-3">
          <h2 id="delivery-management-title" className="font-display text-xl font-black">Gerenciar entregas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Escolha a parte da operação que precisa de atenção.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {DELIVERY_AREAS.map((area) => (
            <ActionCard key={area.to} {...area} />
          ))}
        </div>
      </section>

      <Card className="border-brand/15 bg-brand-soft/25">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-brand"><MapPin className="size-5" /></span>
            <div>
              <p className="font-bold">Origem das rotas</p>
              <p className="mt-1 text-sm text-muted-foreground">Mantenha o endereço da loja correto para melhorar distância, taxa e previsão de entrega.</p>
            </div>
          </div>
          <Button asChild variant="outline"><Link to="/app/loja/configuracoes/endereco">Conferir endereço</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, icon: Icon, attention = false }: { label: string; value: number; icon: typeof Users; attention?: boolean }) {
  return (
    <Card className={attention ? "border-warning/35" : undefined}>
      <CardContent className="flex items-center justify-between gap-3 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.1em] text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-3xl font-black tabular-nums">{value}</p>
        </div>
        <span className={`grid size-10 place-items-center rounded-xl ${attention ? "bg-warning-soft text-warning" : "bg-brand-soft text-brand"}`}><Icon className="size-5" /></span>
      </CardContent>
    </Card>
  );
}

function ActionCard({ icon: Icon, title, description, action, to }: { icon: typeof Users; title: string; description: string; action: string; to: string }) {
  return (
    <Link to={to as never} className="group block">
      <Card className="h-full transition hover:border-brand/25 hover:bg-brand-soft/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-5" /></span>
            <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-brand" />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 text-sm font-bold text-brand">{action}</CardContent>
      </Card>
    </Link>
  );
}
