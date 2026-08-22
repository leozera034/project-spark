/**
 * Fase 16 — Bloco A: acompanhamento público sem segredo na URL.
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Check, Clock, MapPin, RefreshCw, Store } from "lucide-react";

import { OrderReviewCard } from "@/components/storefront/OrderReviewCard";
import { brl } from "@/components/storefront/format";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TRACKING_COPY,
  TRACKING_MESSAGES,
  TRACKING_STEPS,
  trackingTokenSchema,
  type PublicOrderStatusCode,
  type PublicOrderTracking,
} from "@/lib/tracking-contracts";
import { useOrderTracking } from "@/storefront/tracking/useOrderTracking";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/loja/$slug/acompanhar")({
  headers: () => ({
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  }),
  head: () => ({
    meta: [
      { title: "Acompanhar pedido · Comandiva" },
      { name: "description", content: "Acompanhe a situação do seu pedido em tempo quase real." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: TrackingPage,
});

function useTokenFromFragment(slug: string): { token: string | null; ready: boolean } {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const parsed = trackingTokenSchema.safeParse(decodeURIComponent(raw));
    if (raw) window.history.replaceState(window.history.state, "", `/loja/${slug}/acompanhar`);
    if (parsed.success) setToken(parsed.data.toLowerCase());
    setReady(true);
  }, [slug]);

  return { token, ready };
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

function TrackingPage() {
  const { slug } = useParams({ from: "/loja/$slug/acompanhar" });
  const { token, ready } = useTokenFromFragment(slug);
  const { data, error, loading, refresh } = useOrderTracking(token);

  if (!ready || (loading && !data)) {
    return (
      <main className="storefront-global mx-auto min-h-svh max-w-md space-y-4 px-4 py-[max(2.5rem,env(safe-area-inset-top))] sm:max-w-xl sm:px-6">
        <span className="sr-only" role="status" aria-live="polite">Carregando acompanhamento do pedido</span>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </main>
    );
  }

  if (!token) {
    return (
      <main className="storefront-global mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 sm:max-w-xl sm:px-6">
        <ErrorState title="Link de acompanhamento incompleto" description="Abra o link completo que você recebeu ao finalizar o pedido. Ele é a única credencial deste acompanhamento." />
        <Button asChild variant="outline" className="mt-4 min-h-12"><Link to="/loja/$slug" params={{ slug }}>Ir ao cardápio</Link></Button>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="storefront-global mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 sm:max-w-xl sm:px-6">
        <ErrorState
          title={error === "not_found" ? "Pedido não encontrado" : "Acompanhamento indisponível"}
          description={error === "not_found" ? TRACKING_MESSAGES.notFound : TRACKING_MESSAGES.failed}
          onRetry={error === "not_found" ? undefined : refresh}
          retrying={loading}
        />
      </main>
    );
  }

  const copy = TRACKING_COPY[data.status.publicCode];
  const steps = TRACKING_STEPS[data.fulfillment.type] ?? TRACKING_STEPS.entrega;
  const reached = new Set(data.timeline.map((entry) => entry.code));
  reached.add(data.status.publicCode);
  const currentIndex = steps.indexOf(data.status.publicCode);
  const route = data.fulfillment.route ?? null;

  return (
    <main className="storefront-global mx-auto min-h-svh max-w-md px-4 py-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:max-w-xl sm:px-6">
      <header className="flex min-w-0 items-center gap-3">
        {data.store.logoUrl ? (
          <img src={data.store.logoUrl} alt={data.store.name} className="size-11 shrink-0 rounded-xl object-cover shadow-e1" />
        ) : (
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-muted"><Store className="size-6 text-muted-foreground" /></span>
        )}
        <div className="min-w-0 flex-1"><p className="text-sm text-muted-foreground">Pedido na loja</p><p className="truncate font-semibold">{data.store.name}</p></div>
        <ThemeToggle className="shrink-0" />
      </header>

      <section className="panel mt-6 p-4 sm:p-5">
        <p className="text-sm text-muted-foreground">Número do pedido</p>
        <p className="text-2xl font-semibold tabular-nums">#{data.orderNumber}</p>
        <h1 className="mt-3 text-xl font-semibold">{copy.title}</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{copy.description}</p>

        {data.status.publicMessage ? <p className="mt-3 break-words rounded-xl border border-border bg-surface-muted p-3.5 text-sm leading-relaxed">Recado da loja: {data.status.publicMessage}</p> : null}

        {data.fulfillment.estimatedMinutes && !data.status.isFinal ? (
          <p className="mt-3 flex items-start gap-2 text-sm"><Clock className="mt-0.5 size-4 shrink-0" /><span>Previsão geral informada pela loja: cerca de {data.fulfillment.estimatedMinutes} minutos.</span></p>
        ) : null}

        {data.fulfillment.type === "entrega" && route && !data.status.isFinal ? (
          <div className="mt-3 rounded-xl border border-border bg-surface-muted p-3.5">
            <p className="flex items-center gap-2 text-sm font-medium"><MapPin className="size-4" /> Deslocamento: {formatDistance(route.distanceMeters)} · ~{route.estimatedMinutes} min</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {route.isApproximate
                ? "Estimativa aproximada de distância e tempo de trajeto. Não é previsão de chegada do pedido."
                : "Rota calculada para o trajeto. O tempo acima considera apenas o deslocamento, não preparo ou espera."}
            </p>
          </div>
        ) : null}

        {!data.status.isFinal ? (
          <ol className="mt-5 space-y-3">
            {steps.map((step, index) => (
              <TimelineStep key={step} code={step} done={reached.has(step) || (currentIndex >= 0 && index < currentIndex)} current={step === data.status.publicCode} occurredAt={data.timeline.find((entry) => entry.code === step)?.occurredAt ?? null} />
            ))}
          </ol>
        ) : null}
      </section>

      <OrderSummary data={data} />
      {data.status.isSuccessful ? <OrderReviewCard token={token} fulfillment={data.fulfillment.type} /> : null}

      {data.store.publicWhatsapp || data.store.publicPhone ? <p className="mt-4 break-words text-xs text-muted-foreground">Precisa falar com a loja? {data.store.publicWhatsapp ?? data.store.publicPhone}</p> : null}

      <div className="mt-6 grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
        <Button variant="outline" className="min-h-12" onClick={refresh}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Atualizar</Button>
        <Button asChild className="min-h-12"><Link to="/loja/$slug" params={{ slug: data.store.slug }}>Ir ao cardápio</Link></Button>
      </div>

      {error ? <p className="mt-3 text-center text-xs text-muted-foreground">{error === "rate_limited" ? TRACKING_MESSAGES.rateLimited : TRACKING_MESSAGES.failed}</p> : null}
    </main>
  );
}

function TimelineStep({ code, done, current, occurredAt }: { code: PublicOrderStatusCode; done: boolean; current: boolean; occurredAt: string | null }) {
  return (
    <li className="flex items-start gap-3">
      <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border ${done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>{done ? <Check className="size-3.5" /> : null}</span>
      <div className="min-w-0">
        <p className={`text-sm ${current ? "font-semibold text-brand" : ""}`}>{TRACKING_COPY[code].title}</p>
        {occurredAt ? <p className="text-xs text-muted-foreground">{new Date(occurredAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p> : null}
      </div>
    </li>
  );
}

function OrderSummary({ data }: { data: PublicOrderTracking }) {
  return (
    <section className="panel mt-4 p-4 sm:p-5">
      <h2 className="text-sm font-semibold">Itens do pedido</h2>
      <ul className="mt-3 space-y-3">
        {data.items.map((item, index) => (
          <li key={`${item.productName}-${index}`} className="text-sm">
            <div className="flex min-w-0 justify-between gap-3">
              <span className="min-w-0 break-words">{item.quantity}{item.measurementUnit && item.measurementUnit !== "unidade" ? ` ${item.measurementUnit}` : "×"} {item.productName}{item.variantName ? ` · ${item.variantName}` : ""}</span>
              <span className="shrink-0 tabular-nums">{brl(item.lineTotal)}</span>
            </div>
            {item.options.length > 0 ? <p className="break-words text-xs text-muted-foreground">{item.options.map((option) => option.optionName).join(", ")}</p> : null}
            {item.note ? <p className="break-words text-xs text-muted-foreground">{item.note}</p> : null}
          </li>
        ))}
      </ul>
      <Separator className="my-4" />
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Subtotal</dt><dd className="shrink-0 tabular-nums">{brl(data.totals.subtotal)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="min-w-0 text-muted-foreground">{data.fulfillment.type === "entrega" ? "Taxa de entrega" : "Retirada na loja"}</dt><dd className="shrink-0 tabular-nums">{data.fulfillment.type === "entrega" ? brl(data.totals.deliveryFee) : "Sem taxa"}</dd></div>
        <div className="flex justify-between gap-4 border-t pt-2 text-base font-semibold"><dt>Total</dt><dd className="shrink-0 tabular-nums">{brl(data.totals.total)}</dd></div>
        {data.payment.displayName ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Pagamento</dt><dd className="min-w-0 break-words text-right">{data.payment.displayName}</dd></div> : null}
      </dl>
      {data.fulfillment.type === "entrega" && data.fulfillment.neighborhoodName ? <p className="mt-3 text-xs text-muted-foreground">Entrega em {data.fulfillment.neighborhoodName}.</p> : null}
      {data.payment.publicInstructions ? <p className="mt-3 break-words rounded-xl border border-border bg-surface-muted p-3.5 text-xs leading-relaxed text-muted-foreground">{data.payment.publicInstructions}</p> : null}
    </section>
  );
}
