/**
 * Fase 14 — Confirmação do pedido enviado.
 *
 * O comprovante é lido do aparelho: número, total e prazo vieram do servidor
 * no momento do envio. O acompanhamento em tempo real chega na Fase 15.
 */
import { useEffect, useState } from "react";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Copy, Store } from "lucide-react";

import { brl } from "@/components/storefront/format";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { readReceipt } from "@/storefront/checkout/checkout.storage";
import type { LocalOrderReceipt } from "@/storefront/checkout/checkout.types";

const parentRoute = getRouteApi("/loja/$slug");

export const Route = createFileRoute("/loja/$slug/pedido-enviado")({
  head: () => ({
    meta: [
      { title: "Pedido enviado · Comandiva" },
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
      <main className="storefront-global flex min-h-svh items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </main>
    );
  }

  if (!receipt) {
    return (
      <main className="storefront-global mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <Store className="size-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Nenhum pedido recente por aqui</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Se você acabou de enviar um pedido, a loja já o recebeu. Você pode montar um novo pedido quando quiser.
        </p>
        <Button asChild className="mt-2 min-h-12">
          <Link to="/loja/$slug" params={{ slug }}>
            Voltar ao cardápio
          </Link>
        </Button>
      </main>
    );
  }

  const { order } = receipt;

  return (
    <main className="storefront-global mx-auto min-h-svh max-w-md px-4 py-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
      <div className="text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-success-soft">
          <CheckCircle2 className="size-10 text-success" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold">Pedido enviado</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          A loja recebeu seu pedido e vai confirmar em instantes.
        </p>
      </div>

      <div className="panel mt-6 p-4 sm:p-5">
        <p className="text-sm text-muted-foreground">Número do pedido</p>
        <p className="text-2xl font-semibold tabular-nums">#{order.orderNumber}</p>

        <Separator className="my-4" />

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="min-w-0 text-muted-foreground">Modalidade</dt>
            <dd className="shrink-0">{receipt.fulfillmentType === "entrega" ? "Entrega" : "Retirada"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="shrink-0 tabular-nums">{brl(order.itemsSubtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="min-w-0 text-muted-foreground">
              {receipt.fulfillmentType === "entrega" ? "Taxa de entrega" : "Retirada na loja"}
            </dt>
            <dd className="shrink-0 tabular-nums">
              {receipt.fulfillmentType === "entrega" ? brl(order.deliveryFee) : "Sem taxa"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="shrink-0 tabular-nums">{brl(order.total)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Pagamento</dt>
            <dd className="min-w-0 break-words text-right">{receipt.paymentLabel}</dd>
          </div>
        </dl>

        {receipt.paymentInstructions ? (
          <p className="mt-3 break-words rounded-xl border border-border bg-surface-muted p-3.5 text-xs leading-relaxed text-muted-foreground">
            {receipt.paymentInstructions}
          </p>
        ) : null}

        {order.etaMinutes ? (
          <p className="mt-4 flex items-start gap-2 text-sm">
            <Clock className="mt-0.5 size-4 shrink-0" />
            <span>Previsão informada pela loja: cerca de {order.etaMinutes} minutos.</span>
          </p>
        ) : null}
      </div>

      {order.trackingToken ? (
        <TrackingLinkActions slug={slug} token={order.trackingToken} />
      ) : null}

      <Button asChild variant="outline" className="mt-3 min-h-12 w-full">
        <Link to="/loja/$slug" params={{ slug }}>
          Voltar ao cardápio
        </Link>
      </Button>
    </main>
  );
}

/**
 * Ações do link de acompanhamento.
 *
 * O token viaja apenas no fragmento (`#`), que o navegador não envia ao
 * servidor nem grava em logs de acesso.
 */
function TrackingLinkActions({ slug, token }: { slug: string; token: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/loja/${slug}/acompanhar#${encodeURIComponent(token)}`;

  async function copyLink() {
    const absolute = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copie o link de acompanhamento:", absolute);
    }
  }

  return (
    <div className="mt-6">
      <Button asChild className="min-h-12 w-full">
        <a href={path}>Acompanhar pedido</a>
      </Button>
      <Button variant="outline" className="mt-3 min-h-12 w-full" onClick={copyLink}>
        <Copy className="size-4" />
        {copied ? "Link copiado" : "Copiar link de acompanhamento"}
      </Button>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Este link é a chave do seu pedido: quem tiver ele consegue ver a situação, sem conta nem senha. Compartilhe só com quem você quiser acompanhar junto.
      </p>
    </div>
  );
}