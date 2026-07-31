/**
 * Fase 15 — Acompanhamento público do pedido.
 *
 * O link recebido no fim do checkout é a única credencial. Nada aqui exige
 * conta ou senha, e a página fica fora da indexação. A projeção vem pronta do
 * servidor: nenhum valor é recalculado no navegador.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, Check, Clock, RefreshCw, Store } from "lucide-react";

import { brl } from "@/components/storefront/format";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TRACKING_COPY,
  TRACKING_MESSAGES,
  TRACKING_STEPS,
  type PublicOrderStatusCode,
  type PublicOrderTracking,
} from "@/lib/tracking-contracts";
import { useOrderTracking } from "@/storefront/tracking/useOrderTracking";

export const Route = createFileRoute("/pedido/$token")({
  head: () => ({
    meta: [
      { title: "Acompanhar pedido · Pediu Aqui" },
      { name: "description", content: "Acompanhe a situação do seu pedido em tempo quase real." },
      { property: "og:title", content: "Acompanhar pedido" },
      {
        property: "og:description",
        content: "Acompanhe a situação do seu pedido em tempo quase real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: TrackingPage,
});

function TrackingPage() {
  const { token } = Route.useParams();
  const { data, error, loading, refresh } = useOrderTracking(token);

  if (loading && !data) {
    return (
      <main className="mx-auto min-h-svh max-w-md space-y-4 px-4 py-10">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertCircle className="size-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">
          {error === "not_found" ? "Pedido não encontrado" : "Acompanhamento indisponível"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {error === "not_found" ? TRACKING_MESSAGES.notFound : TRACKING_MESSAGES.failed}
        </p>
        <Button variant="outline" className="mt-2" onClick={refresh}>
          <RefreshCw className="size-4" /> Tentar de novo
        </Button>
      </main>
    );
  }

  const copy = TRACKING_COPY[data.status.publicCode];
  const steps = TRACKING_STEPS[data.fulfillment.type] ?? TRACKING_STEPS.entrega;
  const reached = new Set(data.timeline.map((entry) => entry.code));
  reached.add(data.status.publicCode);
  const currentIndex = steps.indexOf(data.status.publicCode);

  return (
    <main className="mx-auto min-h-svh max-w-md px-4 py-8">
      <header className="flex items-center gap-3">
        {data.store.logoUrl ? (
          <img
            src={data.store.logoUrl}
            alt={data.store.name}
            className="size-10 rounded-lg object-cover"
          />
        ) : (
          <Store className="size-8 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm text-muted-foreground">Pedido na loja</p>
          <p className="font-semibold">{data.store.name}</p>
        </div>
      </header>

      <section className="mt-6 panel p-4">
        <p className="text-sm text-muted-foreground">Número do pedido</p>
        <p className="text-2xl font-semibold tabular-nums">#{data.orderNumber}</p>
        <h1 className="mt-3 text-lg font-semibold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.description}</p>

        {data.fulfillment.estimatedMinutes && !data.status.isFinal ? (
          <p className="mt-3 flex items-center gap-2 text-sm">
            <Clock className="size-4" />
            Previsão informada pela loja: cerca de {data.fulfillment.estimatedMinutes} minutos.
          </p>
        ) : null}

        {!data.status.isFinal ? (
          <ol className="mt-4 space-y-3">
            {steps.map((step, index) => (
              <TimelineStep
                key={step}
                code={step}
                done={reached.has(step) || (currentIndex >= 0 && index < currentIndex)}
                current={step === data.status.publicCode}
                occurredAt={data.timeline.find((entry) => entry.code === step)?.occurredAt ?? null}
              />
            ))}
          </ol>
        ) : null}
      </section>

      <OrderSummary data={data} />

      {data.store.publicWhatsapp || data.store.publicPhone ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Precisa falar com a loja? {data.store.publicWhatsapp ?? data.store.publicPhone}
        </p>
      ) : null}

      <div className="mt-6 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={refresh}>
          <RefreshCw className="size-4" /> Atualizar
        </Button>
        <Button asChild className="flex-1">
          <Link to="/loja/$slug" params={{ slug: data.store.slug }}>
            Ir ao cardápio
          </Link>
        </Button>
      </div>

      {error ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {error === "rate_limited" ? TRACKING_MESSAGES.rateLimited : TRACKING_MESSAGES.failed}
        </p>
      ) : null}
    </main>
  );
}

function TimelineStep({
  code,
  done,
  current,
  occurredAt,
}: {
  code: PublicOrderStatusCode;
  done: boolean;
  current: boolean;
  occurredAt: string | null;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
          done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
        }`}
      >
        {done ? <Check className="size-3" /> : null}
      </span>
      <div>
        <p className={`text-sm ${current ? "font-semibold" : ""}`}>{TRACKING_COPY[code].title}</p>
        {occurredAt ? (
          <p className="text-xs text-muted-foreground">
            {new Date(occurredAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function OrderSummary({ data }: { data: PublicOrderTracking }) {
  return (
    <section className="mt-4 panel p-4">
      <h2 className="text-sm font-semibold">Itens do pedido</h2>
      <ul className="mt-3 space-y-3">
        {data.items.map((item, index) => (
          <li key={`${item.productName}-${index}`} className="text-sm">
            <div className="flex justify-between gap-3">
              <span>
                {item.quantity}
                {item.measurementUnit && item.measurementUnit !== "unidade"
                  ? ` ${item.measurementUnit}`
                  : "×"}{" "}
                {item.productName}
                {item.variantName ? ` · ${item.variantName}` : ""}
              </span>
              <span className="tabular-nums">{brl(item.lineTotal)}</span>
            </div>
            {item.options.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {item.options.map((option) => option.optionName).join(", ")}
              </p>
            ) : null}
            {item.note ? <p className="text-xs text-muted-foreground">{item.note}</p> : null}
          </li>
        ))}
      </ul>

      <Separator className="my-4" />

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular-nums">{brl(data.totals.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">
            {data.fulfillment.type === "entrega" ? "Taxa de entrega" : "Retirada na loja"}
          </dt>
          <dd className="tabular-nums">
            {data.fulfillment.type === "entrega" ? brl(data.totals.deliveryFee) : "Sem taxa"}
          </dd>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{brl(data.totals.total)}</dd>
        </div>
        {data.payment.displayName ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Pagamento</dt>
            <dd className="text-right">{data.payment.displayName}</dd>
          </div>
        ) : null}
      </dl>

      {data.fulfillment.type === "entrega" && data.fulfillment.neighborhoodName ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Entrega em {data.fulfillment.neighborhoodName}.
        </p>
      ) : null}

      {data.payment.publicInstructions ? (
        <p className="mt-3 rounded-xl border border-border bg-surface-muted p-3.5 text-xs text-muted-foreground">
          {data.payment.publicInstructions}
        </p>
      ) : null}
    </section>
  );
}
