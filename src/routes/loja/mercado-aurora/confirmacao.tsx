import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

import { StoreFooter, StorePage } from "@/components/demo/StoreShell";
import { Button } from "@/components/ui/button";
import { neighborhoodById } from "@/demo/data/demoStore";
import { useDemo } from "@/demo/state/useDemo";
import { formatBRL } from "@/demo/utils/format";
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/loja/mercado-aurora/confirmacao")({
  head: demoHead(
    "Pedido recebido — Mercado Aurora",
    "Confirmação do pedido com número, previsão e resumo dos itens.",
  ),
  component: Confirmation,
});

function Confirmation() {
  const { customer, store } = useDemo();
  const isDelivery = customer.fulfillment === "entrega";
  const neighborhood = customer.address ? neighborhoodById(customer.address.neighborhoodId) : undefined;
  const subtotal = customer.cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const deliveryFee = isDelivery ? (neighborhood?.deliveryFee ?? 0) : 0;

  return (
    <div className="min-h-screen">
      <StorePage>
        <div className="rounded-2xl border border-success-soft bg-success-soft p-6 text-center">
          <CheckCircle2 aria-hidden="true" className="mx-auto size-10 text-success" />
          <h1 className="mt-3 text-2xl font-semibold text-foreground">Pedido recebido</h1>
          <p className="mt-1 text-base text-foreground/80">
            A loja já foi avisada e vai confirmar em instantes.
          </p>
        </div>

        <dl className="mt-5 space-y-2 rounded-xl border border-border bg-surface p-4 text-base">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Número do pedido</dt>
            <dd className="font-semibold text-foreground">
              {customer.placedOrderCode ?? "A-1046"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Horário</dt>
            <dd className="text-foreground">11:58</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Previsão</dt>
            <dd className="text-foreground">{isDelivery ? store.etaDelivery : store.etaPickup}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Loja</dt>
            <dd className="text-foreground">{store.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Modalidade</dt>
            <dd className="text-foreground">{isDelivery ? "Entrega" : "Retirada na loja"}</dd>
          </div>
        </dl>

        <section className="mt-4 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">Resumo</h2>
          <ul className="mt-2 space-y-1 text-base">
            {customer.cart.map((line) => (
              <li key={line.id} className="flex justify-between gap-4">
                <span className="text-foreground">
                  {line.quantity} × {line.productName}
                </span>
                <span className="text-muted-foreground">
                  {formatBRL(line.unitPrice * line.quantity)}
                </span>
              </li>
            ))}
            {customer.cart.length === 0 ? (
              <li className="text-muted-foreground">Resumo demonstrativo sem itens nesta sessão.</li>
            ) : null}
          </ul>
          <p className="mt-3 flex justify-between border-t border-border pt-2 text-lg font-semibold">
            <span>Total</span>
            <span>{formatBRL(subtotal + deliveryFee)}</span>
          </p>
        </section>

        <Button asChild size="touch" variant="brand" className="mt-5 h-13 w-full text-base">
          <Link to="/loja/mercado-aurora/acompanhamento">Acompanhar pedido</Link>
        </Button>
        <StoreFooter />
      </StorePage>
    </div>
  );
}
