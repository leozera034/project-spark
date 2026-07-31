import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { toast } from "sonner";

import { StickyAction, StoreFooter, StorePage, StoreStepHeader } from "@/components/demo/StoreShell";
import { Button } from "@/components/ui/button";
import { neighborhoodById } from "@/demo/data/demoStore";
import { useDemo } from "@/demo/state/useDemo";
import { formatBRL } from "@/demo/utils/format";
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/loja/mercado-aurora/endereco/")({
  head: demoHead(
    "Confirmar endereço — Mercado Aurora",
    "Confirme, edite ou troque o endereço de entrega antes de escolher os produtos.",
  ),
  component: AddressConfirmation,
});

function AddressConfirmation() {
  const navigate = useNavigate();
  const { customer, savedAddress, updateCustomer } = useDemo();
  const address = customer.address ?? savedAddress;
  const neighborhood = neighborhoodById(address.neighborhoodId);

  return (
    <div className="flex min-h-screen flex-col">
      <StoreStepHeader
        title="Endereço de entrega"
        backTo="/loja/mercado-aurora/modalidade"
        step={3}
        totalSteps={4}
      />
      <StorePage className="flex-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Você quer receber neste endereço?
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Confirmamos sempre, para o pedido não sair para o lugar errado.
        </p>

        <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-start gap-3">
            <MapPin aria-hidden="true" className="mt-1 size-5 text-brand" />
            <div className="text-base">
              <p className="font-semibold text-foreground">
                {address.street}, {address.number}
              </p>
              <p className="text-muted-foreground">{neighborhood?.name}</p>
              {address.complement ? (
                <p className="text-muted-foreground">Complemento: {address.complement}</p>
              ) : null}
              {address.reference ? (
                <p className="text-muted-foreground">Referência: {address.reference}</p>
              ) : null}
              <p className="mt-2 text-sm text-muted-foreground">
                Taxa de entrega {formatBRL(neighborhood?.deliveryFee ?? 0)} · pedido mínimo{" "}
                {formatBRL(neighborhood?.minimumOrder ?? 0)}
              </p>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button asChild variant="outline" size="touch" className="w-full">
            <Link to="/loja/mercado-aurora/endereco/novo">Editar este endereço</Link>
          </Button>
          <Button asChild variant="outline" size="touch" className="w-full">
            <Link to="/loja/mercado-aurora/endereco/novo">Escolher outro endereço</Link>
          </Button>
          <Button asChild variant="outline" size="touch" className="w-full">
            <Link to="/loja/mercado-aurora/endereco/novo">Cadastrar novo endereço</Link>
          </Button>
          <Button
            variant="ghost"
            size="touch"
            className="w-full"
            onClick={() => {
              updateCustomer({ fulfillment: "retirada", address: null, addressConfirmed: false });
              toast.info("Modalidade alterada para retirada na loja.");
              void navigate({ to: "/loja/mercado-aurora/cardapio" });
            }}
          >
            Alterar para retirada
          </Button>
        </div>
        <StoreFooter />
      </StorePage>

      <StickyAction>
        <Button
          size="touch"
          variant="brand"
          className="h-13 w-full text-base"
          onClick={() => {
            updateCustomer({ address, addressConfirmed: true });
            void navigate({ to: "/loja/mercado-aurora/cardapio" });
          }}
        >
          Confirmar endereço
        </Button>
      </StickyAction>
    </div>
  );
}
