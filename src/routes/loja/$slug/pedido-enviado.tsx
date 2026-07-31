/**
 * Fase 14 — Confirmação do pedido enviado.
 *
 * O comprovante é lido do aparelho: número, total e prazo vieram do servidor
 * no momento do envio. O acompanhamento em tempo real chega na Fase 15.
 */
import { useEffect, useState } from "react";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Store } from "lucide-react";

import { brl } from "@/components/storefront/format";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { readReceipt } from "@/storefront/checkout/checkout.storage";
import type { LocalOrderReceipt } from "@/storefront/checkout/checkout.types";

const parentRoute = getRouteApi("/loja/$slug");

export const Route = createFileRoute("/loja/$slug/pedido-enviado")({
  head: () => ({
    meta: [
      { title: "Pedido enviado · Pediu Aqui" },
      {
        name: "description",
        content: "Seu pedido foi enviado para a loja e aguarda confirmação.",
      },
      { property: "og:title", content: "Pedido enviado" },
      {
        property: "og:description",
        content: "Seu pedido foi enviado para a loja e aguarda confirmação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OrderSentPage,
});

function OrderSentPage() {
  const { slug } = parentRoute.useParams();
  const [receipt, setReceipt] = useState<LocalOrderReceipt | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setReceipt(readReceipt(slug));
    setHydrated(true);
  }, [slug]);

  if (!hydrated) {
    return (
      <main className="flex min-h-svh items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </main>
    );
  }

  if (!receipt) {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <Store className="size-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Nenhum pedido recente por aqui</h1>
        <p className="text-sm text-muted-foreground">
          Se você acabou de enviar um pedido, a loja já o recebeu. Você pode montar um novo pedido
          quando quiser.
        </p>
        <Button asChild className="mt-2">
          <Link to="/loja/$slug" params={{ slug }}>
            Voltar ao cardápio
          </Link>
        </Button>
      </main>
    );
  }

  const { order } = receipt;

  return (
    <main className="mx-auto min-h-svh max-w-md px-4 sm:px-6 py-10">
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-12 text-primary" />
        <h1 className="mt-3 text-xl font-semibold">Pedido enviado</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A loja recebeu seu pedido e vai confirmar em instantes.
        </p>
      </div>

      <div className="mt-6 panel p-4">
        <p className="text-sm text-muted-foreground">Número do pedido</p>
        <p className="text-2xl font-semibold tabular-nums">#{order.orderNumber}</p>

        <Separator className="my-4" />

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Modalidade</dt>
            <dd>{receipt.fulfillmentType === "entrega" ? "Entrega" : "Retirada"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{brl(order.itemsSubtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              {receipt.fulfillmentType === "entrega" ? "Taxa de entrega" : "Retirada na loja"}
            </dt>
            <dd className="tabular-nums">
              {receipt.fulfillmentType === "entrega" ? brl(order.deliveryFee) : "Sem taxa"}
            </dd>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{brl(order.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Pagamento</dt>
            <dd className="text-right">{receipt.paymentLabel}</dd>
          </div>
        </dl>

        {receipt.paymentInstructions ? (
          <p className="mt-3 rounded-xl border border-border bg-surface-muted p-3.5 text-xs text-muted-foreground">
            {receipt.paymentInstructions}
          </p>
        ) : null}

        {order.etaMinutes ? (
          <p className="mt-4 flex items-center gap-2 text-sm">
            <Clock className="size-4" />
            Previsão informada pela loja: cerca de {order.etaMinutes} minutos.
          </p>
        ) : null}
      </div>

      {order.trackingToken ? (
        <Button asChild className="mt-6 w-full">
          <Link to="/pedido/$token" params={{ token: order.trackingToken }}>
            Acompanhar pedido
          </Link>
        </Button>
      ) : null}

      <p className="mt-4 text-xs text-muted-foreground">
        Guarde o link de acompanhamento: ele mostra a situação do pedido sem precisar de conta ou
        senha.
      </p>

      <Button asChild variant="outline" className="mt-3 w-full">
        <Link to="/loja/$slug" params={{ slug }}>
          Voltar ao cardápio
        </Link>
      </Button>

    </main>
  );
}
