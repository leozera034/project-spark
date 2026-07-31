import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MapPin, Package } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, SectionTitle } from "@/components/demo/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/demo/state/useDemo";
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/preview/entregador/")({
  head: demoHead(
    "Entregas disponíveis — Pediu Aqui",
    "Lista de entregas oferecidas pela loja, com bairro, distância aproximada e forma de pagamento.",
  ),
  component: AvailableDeliveries,
});

function AvailableDeliveries() {
  const { deliveries, courierOnline, setDeliveryStatus, toggleCourierOnline } = useDemo();
  const navigate = useNavigate();

  const available = deliveries.filter((delivery) => delivery.status === "disponivel");

  if (!courierOnline) {
    return (
      <EmptyState
        title="Você está offline"
        description="Fique online para receber as entregas oferecidas pela loja."
        actionLabel="Ficar online"
        onAction={toggleCourierOnline}
      />
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Entregas disponíveis"
        description="Somente entregas da loja em que você trabalha."
      />

      {available.length === 0 ? (
        <EmptyState
          title="Nenhuma entrega agora"
          description="Assim que a loja liberar um pedido, ele aparece aqui na hora."
        />
      ) : (
        <ul className="space-y-3">
          {available.map((delivery) => (
            <li key={delivery.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-semibold text-foreground">{delivery.orderCode}</span>
                <Badge variant="info">{delivery.approximateDistanceKm} km aprox.</Badge>
              </div>

              <div className="mt-3 space-y-2 text-base">
                <p className="flex items-start gap-2 text-foreground">
                  <Package aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
                  Retirar em {delivery.storeName} · {delivery.pickupAddress}
                </p>
                <p className="flex items-start gap-2 text-foreground">
                  <MapPin aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
                  Entregar no bairro {delivery.neighborhood}
                </p>
              </div>

              <p className="mt-3 text-sm text-muted-foreground">
                Pagamento: {delivery.paymentLabel}. O endereço completo aparece depois de aceitar.
              </p>

              <div className="mt-4 grid gap-2">
                <Button
                  size="touch"
                  variant="brand"
                  className="h-14 text-base"
                  onClick={() => {
                    setDeliveryStatus(delivery.id, "aceita");
                    toast.success("Entrega aceita", {
                      description: "Alteração realizada apenas na demonstração.",
                    });
                    void navigate({ to: "/preview/entregador/rota" });
                  }}
                >
                  Aceitar entrega
                </Button>
                <Button
                  size="touch"
                  variant="ghost"
                  onClick={() =>
                    toast.info("Entrega recusada", {
                      description: "Alteração realizada apenas na demonstração.",
                    })
                  }
                >
                  Recusar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
