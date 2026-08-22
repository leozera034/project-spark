import { Link, createFileRoute } from "@tanstack/react-router";
import { Bike, MapPin, PackageCheck, RotateCcw, Settings2, Truck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/auth/useAuth";
import { useCourierCounts } from "@/store/couriers/hooks/useCouriers";

export const Route = createFileRoute("/app/loja/entregas")({
  head: () => ({
    meta: [
      { title: "Entregas | Comandiva" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DeliveriesHub,
});

function DeliveriesHub() {
  const { authContext } = useAuth();
  const storeId = authContext?.store_ids?.[0] ?? null;
  const counts = useCourierCounts(storeId);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand">Operação de entrega</p>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight">Entregas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Acompanhe sua equipe, pedidos aguardando entregador, devoluções e regras de entrega em um único lugar.
          </p>
        </div>
        <Button asChild>
          <Link to="/app/loja/entregadores/novo"><Bike className="size-4" /> Novo entregador</Link>
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Entregadores ativos" value={counts.data?.active ?? 0} icon={Users} />
        <Metric label="Online agora" value={counts.data?.online ?? 0} icon={Bike} />
        <Metric label="Em entrega" value={counts.data?.busy ?? 0} icon={Truck} />
        <Metric label="Aguardando entregador" value={counts.data?.unassignedDeliveries ?? 0} icon={PackageCheck} attention={(counts.data?.unassignedDeliveries ?? 0) > 0} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <ActionCard
          icon={Users}
          title="Equipe de entregadores"
          description="Disponibilidade, veículo, acesso e entrega atual de cada entregador."
          action="Gerenciar equipe"
          to="/app/loja/entregadores"
        />
        <ActionCard
          icon={PackageCheck}
          title="Pedidos aguardando saída"
          description="Abra a fila de pedidos prontos e atribua um entregador quando necessário."
          action="Ver pedidos"
          to="/app/loja/pedidos"
        />
        <ActionCard
          icon={RotateCcw}
          title="Pedidos que voltaram"
          description="Resolva devoluções com nova tentativa, correção de endereço ou cancelamento."
          action="Resolver devoluções"
          to="/app/loja/devolucoes"
        />
        <ActionCard
          icon={Settings2}
          title="Como cobrar a entrega"
          description="Escolha taxa fixa, por distância ou por bairro e configure prazo e pedido mínimo."
          action="Configurar entrega"
          to="/app/loja/configuracoes/bairros"
        />
      </section>

      <Card className="border-brand/15 bg-brand-soft/25">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-brand"><MapPin className="size-5" /></span>
            <div>
              <p className="font-bold">Localização da loja</p>
              <p className="mt-1 text-sm text-muted-foreground">Uma localização confirmada melhora estimativas por distância sem alterar o fluxo de pedidos.</p>
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
    <Card>
      <CardHeader className="pb-3">
        <span className="mb-2 grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-5" /></span>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent><Button asChild variant="outline"><Link to={to as never}>{action}</Link></Button></CardContent>
    </Card>
  );
}
