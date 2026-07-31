import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { SectionTitle } from "@/components/demo/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/demo/state/useDemo";
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/preview/loja/entregadores")({
  head: demoHead(
    "Entregadores da loja — Pediu Aqui",
    "Equipe própria de entrega, com situação online e contador simples de entregas concluídas.",
  ),
  component: Couriers,
});

function Couriers() {
  const { couriers, deliveries, orders } = useDemo();

  function countFor(courierId: string, day: "hoje" | "semana" | "mes") {
    return deliveries.filter(
      (delivery) =>
        delivery.courierId === courierId && delivery.status === "entregue" && delivery.day === day,
    ).length;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <SectionTitle
        title="Entregadores"
        description="Cada loja tem a própria equipe. Não existe frota compartilhada entre lojas."
        action={
          <Button
            variant="brand"
            size="sm"
            onClick={() =>
              toast.info("Convite enviado", {
                description: "Alteração realizada apenas na demonstração.",
              })
            }
          >
            Convidar entregador
          </Button>
        }
      />

      <p className="rounded-xl border border-dashed border-border-strong bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
        Sem cálculo de comissão, repasse ou pagamento. A plataforma apenas conta as entregas
        concluídas por período.
      </p>

      <ul className="grid gap-3 md:grid-cols-2">
        {couriers.map((courier) => {
          const active = orders.find(
            (order) => order.courierId === courier.id && order.status === "saiu_para_entrega",
          );
          return (
            <li key={courier.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-soft-foreground">
                    {courier.initials}
                  </span>
                  <div>
                    <p className="text-base font-medium text-foreground">{courier.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {courier.vehicle}
                      {courier.plate ? ` · ${courier.plate}` : ""}
                    </p>
                  </div>
                </div>
                <Badge variant={courier.online ? "success" : "secondary"}>
                  {courier.online ? "Online" : "Offline"}
                </Badge>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    ["Hoje", "hoje"],
                    ["Semana", "semana"],
                    ["Mês", "mes"],
                  ] as const
                ).map(([label, key]) => (
                  <div key={key} className="rounded-lg bg-surface-muted px-2 py-2">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-xl font-semibold text-foreground">
                      {countFor(courier.id, key)}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-3 text-sm text-muted-foreground">
                {active
                  ? `Em rota com o pedido ${active.code}.`
                  : "Sem entrega em andamento no momento."}
              </p>

              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    toast.info("Cadastro do entregador", {
                      description: "Alteração realizada apenas na demonstração.",
                    })
                  }
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    toast.info("Acesso do entregador alterado", {
                      description: "Alteração realizada apenas na demonstração.",
                    })
                  }
                >
                  {courier.online ? "Desativar acesso" : "Ativar acesso"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
