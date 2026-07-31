import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, SectionTitle } from "@/components/demo/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDemo } from "@/demo/state/useDemo";
import { demoHead } from "@/demo/utils/head";
import { deliveryStatusLabel } from "@/demo/utils/labels";

export const Route = createFileRoute("/preview/entregador/rota")({
  head: demoHead(
    "Minha rota — Pediu Aqui",
    "Entrega em andamento com endereço completo, referência e ações grandes de um toque.",
  ),
  component: CourierRoute,
});

const INCIDENTS = [
  "Cliente ausente",
  "Endereço não encontrado",
  "Recusa do cliente",
  "Problema com o veículo",
];

function CourierRoute() {
  const { deliveries, setDeliveryStatus, registerIncident } = useDemo();
  const [incidentFor, setIncidentFor] = useState<string | null>(null);

  const active = deliveries.filter(
    (delivery) =>
      delivery.status === "aceita" || delivery.status === "coletada" || delivery.status === "em_rota",
  );

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Minha rota"
        description="Uma entrega por vez, com botões grandes para usar em movimento."
      />

      {active.length === 0 ? (
        <EmptyState
          title="Nenhuma entrega em andamento"
          description="Aceite uma entrega na aba de disponíveis para começar a rota."
        />
      ) : (
        <ul className="space-y-4">
          {active.map((delivery) => (
            <li key={delivery.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xl font-semibold text-foreground">{delivery.orderCode}</span>
                <Badge variant="brandSoft">{deliveryStatusLabel[delivery.status]}</Badge>
              </div>

              <dl className="mt-3 space-y-2 text-base">
                <div>
                  <dt className="text-sm text-muted-foreground">Retirada</dt>
                  <dd className="text-foreground">
                    {delivery.storeName} · {delivery.pickupAddress}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Entrega</dt>
                  <dd className="text-foreground">{delivery.deliveryAddress}</dd>
                </div>
                {delivery.note ? (
                  <div>
                    <dt className="text-sm text-muted-foreground">Observação</dt>
                    <dd className="text-foreground">{delivery.note}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-sm text-muted-foreground">Pagamento</dt>
                  <dd className="text-foreground">{delivery.paymentLabel}</dd>
                </div>
              </dl>

              <div className="mt-4 grid gap-2">
                {delivery.status === "aceita" ? (
                  <Button
                    size="touch"
                    variant="brand"
                    className="h-14 text-base"
                    onClick={() => {
                      setDeliveryStatus(delivery.id, "coletada");
                      toast.success("Pedido coletado", {
                        description: "Alteração realizada apenas na demonstração.",
                      });
                    }}
                  >
                    Confirmar coleta na loja
                  </Button>
                ) : null}

                {delivery.status === "coletada" ? (
                  <Button
                    size="touch"
                    variant="brand"
                    className="h-14 text-base"
                    onClick={() => {
                      setDeliveryStatus(delivery.id, "em_rota");
                      toast.success("A caminho do cliente", {
                        description: "Alteração realizada apenas na demonstração.",
                      });
                    }}
                  >
                    Iniciar rota até o cliente
                  </Button>
                ) : null}

                {delivery.status === "em_rota" ? (
                  <Button
                    size="touch"
                    variant="brand"
                    className="h-14 text-base"
                    onClick={() => {
                      setDeliveryStatus(delivery.id, "entregue");
                      toast.success("Entrega concluída", {
                        description: "Alteração realizada apenas na demonstração.",
                      });
                    }}
                  >
                    Confirmar entrega
                  </Button>
                ) : null}

                <Button
                  size="touch"
                  variant="outline"
                  onClick={() =>
                    toast.info("Abrindo mapa", {
                      description: "Ação apenas demonstrativa nesta fase.",
                    })
                  }
                >
                  Abrir no mapa
                </Button>
                <Button size="touch" variant="ghost" onClick={() => setIncidentFor(delivery.id)}>
                  Registrar problema
                </Button>
              </div>

              {delivery.incident ? (
                <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
                  Problema registrado: {delivery.incident}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={incidentFor !== null} onOpenChange={(open) => (open ? null : setIncidentFor(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar problema</DialogTitle>
            <DialogDescription>
              A loja recebe o aviso e decide o que fazer com o pedido.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {INCIDENTS.map((incident) => (
              <Button
                key={incident}
                size="touch"
                variant="outline"
                onClick={() => {
                  if (incidentFor) registerIncident(incidentFor, incident);
                  setIncidentFor(null);
                  toast.success("Problema registrado", {
                    description: "Alteração realizada apenas na demonstração.",
                  });
                }}
              >
                {incident}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
