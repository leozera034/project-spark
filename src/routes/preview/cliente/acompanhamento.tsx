import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";

import { StoreFooter, StorePage, StoreStepHeader } from "@/components/demo/StoreShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/demo/state/useDemo";
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/preview/cliente/acompanhamento")({
  head: demoHead(
    "Acompanhar pedido — Mercado Aurora",
    "Linha do tempo do pedido para entrega e para retirada na loja.",
  ),
  component: Tracking,
});

const DELIVERY_STEPS = [
  "Pedido recebido",
  "Pedido aceito",
  "Em preparo",
  "Pronto",
  "Aguardando entregador",
  "Saiu para entrega",
  "Entregue",
];

const PICKUP_STEPS = [
  "Pedido recebido",
  "Pedido aceito",
  "Em preparo",
  "Pronto",
  "Aguardando retirada",
  "Retirado",
];

function Tracking() {
  const { customer, store } = useDemo();
  const initialMode = customer.fulfillment === "retirada" ? "retirada" : "entrega";
  const [mode, setMode] = useState<"entrega" | "retirada">(initialMode);
  const [current, setCurrent] = useState(2);

  const steps = mode === "entrega" ? DELIVERY_STEPS : PICKUP_STEPS;
  const safeCurrent = Math.min(current, steps.length - 1);

  return (
    <div className="min-h-screen">
      <StoreStepHeader title="Acompanhar pedido" backTo="/preview/cliente/cardapio" />
      <StorePage>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Pedido {customer.placedOrderCode ?? "A-1046"}
            </h1>
            <p className="mt-1 text-base text-muted-foreground">
              {store.name} · previsão {mode === "entrega" ? store.etaDelivery : store.etaPickup}
            </p>
          </div>
          <Badge variant="brandSoft">{steps[safeCurrent]}</Badge>
        </div>

        <ol className="mt-6 space-y-0">
          {steps.map((step, index) => {
            const done = index <= safeCurrent;
            return (
              <li key={step} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    aria-hidden="true"
                    className={`flex size-7 items-center justify-center rounded-full border text-xs ${
                      done
                        ? "border-brand bg-brand text-brand-foreground"
                        : "border-border bg-surface text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="size-4" /> : index + 1}
                  </span>
                  {index < steps.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className={`w-px flex-1 ${done ? "bg-brand" : "bg-border"}`}
                    />
                  ) : null}
                </div>
                <p
                  className={`pb-6 text-base ${done ? "font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  {step}
                  {index === safeCurrent ? (
                    <span className="block text-sm text-muted-foreground">Etapa atual</span>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ol>

        <div className="rounded-xl border border-dashed border-border-strong bg-surface-muted p-4">
          <p className="text-sm font-medium text-foreground">Controles da demonstração</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use os botões abaixo para ver os dois cenários. Em produção, o status muda sozinho.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant={mode === "entrega" ? "brand" : "outline"}
              size="sm"
              onClick={() => {
                setMode("entrega");
                setCurrent(2);
              }}
            >
              Cenário de entrega
            </Button>
            <Button
              variant={mode === "retirada" ? "brand" : "outline"}
              size="sm"
              onClick={() => {
                setMode("retirada");
                setCurrent(2);
              }}
            >
              Cenário de retirada
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrent((value) => Math.min(steps.length - 1, value + 1))}
            >
              Avançar etapa
            </Button>
          </div>
        </div>
        <StoreFooter />
      </StorePage>
    </div>
  );
}
