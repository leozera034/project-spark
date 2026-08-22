/**
 * Confirmação do pedido enviado.
 * O comprovante local contém somente dados retornados pelo servidor; pagamentos
 * Stripe são consultados pelo orderId + trackingToken e nunca por preço do browser.
 */
import { useEffect, useState } from "react";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, Clock, Copy, LoaderCircle, Share2, Store } from "lucide-react";

import { brl } from "@/components/storefront/format";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  createStripeOrderCheckout,
  fetchStripeOrderPaymentStatus,
  type StripeOrderPaymentStatus,
} from "@/storefront/checkout/checkout.api";
import { readReceipt } from "@/storefront/checkout/checkout.storage";
import type { LocalOrderReceipt } from "@/storefront/checkout/checkout.types";

const parentRoute = getRouteApi("/loja/$slug");

export const Route = createFileRoute("/loja/$slug/pedido-enviado")({
  head: () => ({
    meta: [
      { title: "Pedido enviado · Comandiva" },
      { name: "description", content: "Seu pedido foi enviado para a loja e aguarda confirmação." },
      { property: "og:title", content: "Pedido enviado" },
      { property: "og:description", content: "Seu pedido foi enviado para a loja e aguarda confirmação." },
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
  const [stripeStatus, setStripeStatus] = useState<StripeOrderPaymentStatus | null>(null);
  const [stripeRetryBusy, setStripeRetryBusy] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  useEffect(() => {
    setReceipt(readReceipt(slug));
    setHydrated(true);
  }, [slug]);

  const isStripe = Boolean(receipt?.paymentLabel.toLowerCase().includes("stripe"));

  useEffect(() => {
    if (!receipt || !isStripe || !receipt.order.trackingToken) return;
    let alive = true;
    let timer: number | null = null;
    const poll = async () => {
      try {
        const next = await fetchStripeOrderPaymentStatus({
          orderId: receipt.order.id,
          trackingToken: receipt.order.trackingToken,
        });
        if (!alive) return;
        setStripeStatus(next);
        if (next.status !== "succeeded" && next.status !== "canceled") {
          timer = window.setTimeout(() => void poll(), 2500);
        }
      } catch {
        if (alive) timer = window.setTimeout(() => void poll(), 5000);
      }
    };
    void poll();
    return () => {
      alive = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [receipt, isStripe]);

  if (!hydrated) {
    return <main className="storefront-global flex min-h-svh items-center justify-center px-6"><p className="text-sm text-muted-foreground">Carregando…</p></main>;
  }

  if (!receipt) {
    return (
      <main className="storefront-global mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <Store className="size-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Nenhum pedido recente por aqui</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">Se você acabou de enviar um pedido, a loja já o recebeu. Você pode montar um novo pedido quando quiser.</p>
        <Button asChild className="mt-2 min-h-12"><Link to="/loja/$slug" params={{ slug }}>Voltar ao cardápio</Link></Button>
      </main>
    );
  }

  const { order } = receipt;
  const cancelled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("payment") === "cancelled";
  const paid = stripeStatus?.status === "succeeded";
  const processing = isStripe && !paid && stripeStatus?.status !== "canceled" && !cancelled;

  async function retryStripePayment() {
    if (!order.trackingToken || stripeRetryBusy) return;
    setStripeRetryBusy(true);
    setStripeError(null);
    try {
      const checkout = await createStripeOrderCheckout({ slug, orderId: order.id, trackingToken: order.trackingToken });
      window.location.assign(checkout.checkoutUrl);
    } catch {
      setStripeError("Não foi possível abrir o pagamento agora. Tente novamente em instantes.");
      setStripeRetryBusy(false);
    }
  }

  return (
    <main className="storefront-global mx-auto min-h-svh max-w-md px-4 py-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
      <div className="text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-success-soft shadow-sm"><CheckCircle2 className="size-10 text-success" /></span>
        <p className="mt-4 text-xs font-black uppercase tracking-[.14em] text-success">Recebido pela Comandiva</p>
        <h1 className="mt-1 font-display text-2xl font-black">Pedido enviado</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">A loja recebeu seu pedido. Agora você pode acompanhar cada atualização por esta tela.</p>
      </div>

      {isStripe ? (
        <div className={`mt-5 rounded-2xl border p-4 ${paid ? "border-success/30 bg-success-soft/50" : cancelled ? "border-warning/35 bg-warning-soft/45" : "border-border bg-muted/30"}`}>
          <div className="flex items-start gap-3">
            {paid ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : processing ? <LoaderCircle className="mt-0.5 size-5 shrink-0 animate-spin text-brand" /> : <CircleAlert className="mt-0.5 size-5 shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{paid ? "Pagamento confirmado" : cancelled ? "Pagamento não concluído" : "Confirmando pagamento"}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {paid ? "A Stripe confirmou o pagamento deste pedido." : cancelled ? "O pedido foi criado, mas o checkout foi fechado antes da confirmação. Você pode tentar novamente." : "Aguardando a confirmação segura da Stripe. Esta tela atualiza automaticamente."}
              </p>
              {!paid && (cancelled || stripeStatus?.status === "requires_payment_method" || stripeStatus?.status === "not_started") ? (
                <Button className="mt-3 min-h-11 w-full" loading={stripeRetryBusy} loadingLabel="Abrindo Stripe" onClick={() => void retryStripePayment()}>Pagar agora com Stripe</Button>
              ) : null}
              {stripeError ? <p className="mt-2 text-xs text-destructive">{stripeError}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="panel mt-6 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Número do pedido</p><p className="mt-0.5 text-3xl font-black tabular-nums">#{order.orderNumber}</p></div>
          {order.etaMinutes ? <span className="rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand">~{order.etaMinutes} min</span> : null}
        </div>
        <Separator className="my-4" />
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt className="min-w-0 text-muted-foreground">Modalidade</dt><dd className="shrink-0 font-semibold">{receipt.fulfillmentType === "entrega" ? "Entrega" : "Retirada"}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Subtotal</dt><dd className="shrink-0 tabular-nums">{brl(order.itemsSubtotal)}</dd></div>
          <div className="flex justify-between gap-4"><dt className="min-w-0 text-muted-foreground">{receipt.fulfillmentType === "entrega" ? "Taxa de entrega" : "Retirada na loja"}</dt><dd className="shrink-0 tabular-nums">{receipt.fulfillmentType === "entrega" ? brl(order.deliveryFee) : "Sem taxa"}</dd></div>
          <div className="flex justify-between gap-4 border-t pt-2 text-base font-black"><dt>Total</dt><dd className="shrink-0 tabular-nums">{brl(order.total)}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Pagamento</dt><dd className="min-w-0 break-words text-right font-semibold">{receipt.paymentLabel}</dd></div>
        </dl>
        {receipt.paymentInstructions ? <p className="mt-3 break-words rounded-xl border border-border bg-surface-muted p-3.5 text-xs leading-relaxed text-muted-foreground">{receipt.paymentInstructions}</p> : null}
        {order.etaMinutes ? <p className="mt-4 flex items-start gap-2 text-sm"><Clock className="mt-0.5 size-4 shrink-0 text-brand" /><span>A previsão pode mudar conforme preparo e deslocamento. O acompanhamento mostra o estágio real do pedido.</span></p> : null}
      </div>

      {order.trackingToken ? <TrackingLinkActions slug={slug} token={order.trackingToken} orderNumber={order.orderNumber} /> : null}
      <Button asChild variant="outline" className="mt-3 min-h-12 w-full"><Link to="/loja/$slug" params={{ slug }}>Voltar ao cardápio</Link></Button>
    </main>
  );
}

function TrackingLinkActions({ slug, token, orderNumber }: { slug: string; token: string; orderNumber: number }) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const path = `/loja/${slug}/acompanhar#${encodeURIComponent(token)}`;

  function absoluteLink() {
    return `${window.location.origin}${path}`;
  }

  async function copyLink() {
    const absolute = absoluteLink();
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copie o link de acompanhamento:", absolute);
    }
  }

  async function shareLink() {
    const absolute = absoluteLink();
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({ title: `Pedido #${orderNumber}`, text: `Acompanhe o pedido #${orderNumber}.`, url: absolute });
      setShared(true);
      window.setTimeout(() => setShared(false), 2500);
    } catch {
      // Cancelar a folha de compartilhamento não é erro para o cliente.
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-brand/15 bg-brand-soft/30 p-3">
      <Button asChild className="min-h-13 w-full"><a href={path}>Acompanhar pedido agora</a></Button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button variant="outline" className="min-h-11 bg-background" onClick={() => void copyLink()}><Copy className="size-4" />{copied ? "Copiado" : "Copiar link"}</Button>
        <Button variant="outline" className="min-h-11 bg-background" onClick={() => void shareLink()}><Share2 className="size-4" />{shared ? "Compartilhado" : "Compartilhar"}</Button>
      </div>
      <p className="mt-3 px-1 text-xs leading-relaxed text-muted-foreground">O link funciona como a chave privada do pedido. Compartilhe somente com quem deve acompanhar junto.</p>
    </div>
  );
}
