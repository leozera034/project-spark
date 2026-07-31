import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bike, Store } from "lucide-react";

import { StoreFooter, StorePage, StoreStepHeader } from "@/components/demo/StoreShell";
import { useDemo } from "@/demo/state/useDemo";
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/loja/mercado-aurora/modalidade")({
  head: demoHead(
    "Entrega ou retirada — Mercado Aurora",
    "Escolha entre receber no endereço ou buscar o pedido na loja.",
  ),
  component: Fulfillment,
});

function Fulfillment() {
  const navigate = useNavigate();
  const { updateCustomer, savedAddress } = useDemo();

  const options = [
    {
      id: "entrega" as const,
      icon: Bike,
      title: "Receber no endereço",
      description: "Um entregador da própria loja leva o pedido até você.",
      onSelect: () => {
        updateCustomer({ fulfillment: "entrega", address: savedAddress, addressConfirmed: false });
        void navigate({ to: "/loja/mercado-aurora/endereco" });
      },
    },
    {
      id: "retirada" as const,
      icon: Store,
      title: "Buscar na loja",
      description: "Você retira no balcão quando o pedido estiver pronto.",
      onSelect: () => {
        updateCustomer({ fulfillment: "retirada", address: null, addressConfirmed: false });
        void navigate({ to: "/loja/mercado-aurora/cardapio" });
      },
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <StoreStepHeader
        title="Como receber"
        backTo="/loja/mercado-aurora/identificacao"
        step={2}
        totalSteps={4}
      />
      <StorePage className="flex-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Como você quer receber seu pedido?
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Dá para mudar depois, antes de confirmar.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={option.onSelect}
              className="flex min-h-40 flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-5 text-left transition-colors hover:border-brand hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-12 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
                <option.icon aria-hidden="true" className="size-6" />
              </span>
              <span className="text-lg font-semibold text-foreground">{option.title}</span>
              <span className="text-base text-muted-foreground">{option.description}</span>
            </button>
          ))}
        </div>
        <StoreFooter />
      </StorePage>
    </div>
  );
}
