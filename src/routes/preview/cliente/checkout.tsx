import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { StickyAction, StoreFooter, StorePage, StoreStepHeader } from "@/components/demo/StoreShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { neighborhoodById } from "@/demo/data/demoStore";
import { useDemo } from "@/demo/state/useDemo";
import type { PaymentMethod } from "@/demo/types/demo";
import { formatBRL } from "@/demo/utils/format";
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/preview/cliente/checkout")({
  head: demoHead(
    "Checkout — Mercado Aurora",
    "Revise a entrega, escolha a forma de pagamento e confirme o pedido.",
  ),
  component: Checkout,
});

function Checkout() {
  const navigate = useNavigate();
  const { customer, updateCustomer, placeOrder } = useDemo();

  const isDelivery = customer.fulfillment === "entrega";
  const neighborhood = customer.address ? neighborhoodById(customer.address.neighborhoodId) : undefined;
  const subtotal = customer.cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const deliveryFee = isDelivery ? (neighborhood?.deliveryFee ?? 0) : 0;
  const total = subtotal + deliveryFee;

  const methods: { id: PaymentMethod; label: string; helper: string }[] = isDelivery
    ? [
        { id: "pix_na_loja", label: "Pix na loja", helper: "A loja envia a chave no contato do pedido." },
        { id: "dinheiro", label: "Dinheiro", helper: "Informe se precisa de troco." },
        { id: "cartao_na_entrega", label: "Cartão na entrega", helper: "Maquininha levada pelo entregador." },
      ]
    : [
        { id: "pix_na_loja", label: "Pix na loja", helper: "Pagamento no balcão, na hora de retirar." },
        { id: "pagamento_na_retirada", label: "Pagamento na retirada", helper: "Dinheiro ou cartão no balcão." },
      ];

  return (
    <div className="flex min-h-screen flex-col">
      <StoreStepHeader title="Finalizar pedido" backTo="/preview/cliente/carrinho" step={4} totalSteps={4} />
      <StorePage className="flex-1">
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">Seus dados</h2>
          <dl className="mt-2 space-y-1 text-base">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Nome</dt>
              <dd className="text-foreground">{customer.firstName || "Visitante"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Telefone</dt>
              <dd className="text-foreground">{customer.phone}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Modalidade</dt>
              <dd className="text-foreground">{isDelivery ? "Entrega" : "Retirada na loja"}</dd>
            </div>
          </dl>
        </section>

        {isDelivery && customer.address ? (
          <section className="mt-4 rounded-xl border border-border bg-surface p-4">
            <h2 className="text-base font-semibold text-foreground">Endereço confirmado</h2>
            <p className="mt-1 text-base text-foreground">
              {customer.address.street}, {customer.address.number}
            </p>
            <p className="text-base text-muted-foreground">{neighborhood?.name}</p>
            {customer.address.complement ? (
              <p className="text-base text-muted-foreground">{customer.address.complement}</p>
            ) : null}
            <p className="mt-2 text-sm text-muted-foreground">
              Taxa de entrega {formatBRL(deliveryFee)}
            </p>
          </section>
        ) : null}

        <fieldset className="mt-4">
          <legend className="text-base font-semibold text-foreground">Forma de pagamento</legend>
          <p className="text-sm text-muted-foreground">
            O pagamento é combinado com a loja. Nada é cobrado por aqui.
          </p>
          <RadioGroup
            className="mt-3 space-y-2"
            value={customer.paymentMethod ?? ""}
            onValueChange={(value) => updateCustomer({ paymentMethod: value as PaymentMethod })}
          >
            {methods.map((method) => (
              <div
                key={method.id}
                className="flex min-h-14 items-center gap-3 rounded-lg border border-border bg-surface px-3"
              >
                <RadioGroupItem value={method.id} id={method.id} />
                <Label htmlFor={method.id} className="flex-1 py-3 text-base">
                  <span className="block font-medium text-foreground">{method.label}</span>
                  <span className="block text-sm font-normal text-muted-foreground">
                    {method.helper}
                  </span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </fieldset>

        {customer.paymentMethod === "dinheiro" ? (
          <div className="mt-4">
            <Label htmlFor="troco" className="text-base">
              Precisa de troco para quanto?
            </Label>
            <Input
              id="troco"
              inputMode="numeric"
              className="mt-2 h-12 text-base"
              placeholder="100,00"
              value={customer.changeFor}
              onChange={(event) => updateCustomer({ changeFor: event.target.value })}
            />
          </div>
        ) : null}

        <div className="mt-4">
          <Label htmlFor="observacao-geral" className="text-base">
            Observação para a loja
          </Label>
          <Textarea
            id="observacao-geral"
            className="mt-2 text-base"
            placeholder="Ex.: entregar na portaria"
            value={customer.generalNote}
            onChange={(event) => updateCustomer({ generalNote: event.target.value })}
          />
        </div>

        <dl className="mt-4 space-y-2 rounded-xl border border-border bg-surface p-4 text-base">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="text-foreground">{formatBRL(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Entrega</dt>
            <dd className="text-foreground">{isDelivery ? formatBRL(deliveryFee) : "Sem taxa"}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-lg font-semibold">
            <dt>Total</dt>
            <dd>{formatBRL(total)}</dd>
          </div>
        </dl>
        <StoreFooter />
      </StorePage>

      <StickyAction>
        <Button
          size="touch"
          variant="brand"
          className="h-13 w-full text-base"
          disabled={!customer.paymentMethod || customer.cart.length === 0}
          onClick={() => {
            placeOrder();
            void navigate({ to: "/preview/cliente/confirmacao" });
          }}
        >
          Confirmar pedido
        </Button>
      </StickyAction>
    </div>
  );
}
