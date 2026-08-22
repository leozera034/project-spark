import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquareReply, RefreshCw, Star, UtensilsCrossed, Truck } from "lucide-react";

import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { StoreReviewItem } from "@/lib/store-reviews.functions";
import { useStoreScope } from "@/store-scope/StoreScopeProvider";
import { useStoreReviewActions, useStoreReviewCenter } from "@/store/reviews/store-reviews.queries";

export const Route = createFileRoute("/app/loja/avaliacoes")({
  head: () => ({ meta: [{ title: "Avaliações | Comandiva" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: StoreReviewsPage,
});

type Filter = "todas" | "sem_resposta" | "criticas" | "elogios";
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "todas", label: "Todas" },
  { key: "sem_resposta", label: "Sem resposta" },
  { key: "criticas", label: "1 a 3 estrelas" },
  { key: "elogios", label: "4 e 5 estrelas" },
];
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function StoreReviewsPage() {
  const { storeId } = useStoreScope();
  if (!storeId) {
    return <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">Escolha uma loja para ver as avaliações.</div>;
  }
  return <StoreReviewsForStore key={storeId} storeId={storeId} />;
}

function StoreReviewsForStore({ storeId }: { storeId: string }) {
  const reviews = useStoreReviewCenter(storeId);
  const actions = useStoreReviewActions();
  const [filter, setFilter] = useState<Filter>("todas");

  const items = useMemo(() => {
    const source = reviews.data?.items ?? [];
    if (filter === "sem_resposta") return source.filter((item) => !item.merchantReply);
    if (filter === "criticas") return source.filter((item) => item.overallRating <= 3);
    if (filter === "elogios") return source.filter((item) => item.overallRating >= 4);
    return source;
  }, [reviews.data?.items, filter]);

  const summary = reviews.data?.summary;
  const total = summary?.total ?? 0;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand">Reputação</p>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight">Avaliações</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Acompanhe a experiência de pedidos reais e responda publicamente aos clientes.</p>
        </div>
        <Button variant="outline" onClick={() => void reviews.refetch()} disabled={reviews.isFetching}>
          <RefreshCw className={`size-4 ${reviews.isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </header>

      {reviews.isError ? <ErrorState title="Não foi possível carregar as avaliações" onRetry={() => void reviews.refetch()} /> : null}
      {actions.reply.isError ? <p className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">A resposta não foi salva. O conteúdo anterior da avaliação permanece intacto; tente novamente.</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Star} label="Nota média" value={reviews.isLoading ? "—" : total ? number(summary?.averageRating) : "—"} detail={`${total} avaliação(ões)`} />
        <Metric icon={UtensilsCrossed} label="Comida / produtos" value={reviews.isLoading ? "—" : total ? number(summary?.averageFoodRating) : "—"} detail="Média das notas informadas" />
        <Metric icon={Truck} label="Entrega" value={reviews.isLoading ? "—" : summary?.averageDeliveryRating ? number(summary.averageDeliveryRating) : "—"} detail="Somente pedidos com entrega" />
        <Metric icon={MessageSquareReply} label="Taxa de resposta" value={reviews.isLoading ? "—" : `${number(summary?.responseRate)}%`} detail={`${summary?.replied ?? 0} respondida(s)`} />
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[.7fr_1.3fr]">
        <Card className="min-w-0">
          <CardHeader><CardTitle>Distribuição das notas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = summary?.distribution?.[String(rating) as "1" | "2" | "3" | "4" | "5"] ?? 0;
              const width = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={rating} className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                  <span className="flex items-center gap-1 font-semibold">{rating}<Star className="size-3.5 fill-current text-warning" /></span>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-brand" style={{ width: `${width}%` }} /></div>
                  <span className="text-right tabular-nums text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>O que exige atenção</CardTitle>
            <p className="text-sm text-muted-foreground">Responder críticas e avaliações sem retorno reduz o risco de deixar um problema sem tratamento.</p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <AttentionStat label="Sem resposta" value={(reviews.data?.items ?? []).filter((item) => !item.merchantReply).length} />
            <AttentionStat label="Notas 1–3" value={(reviews.data?.items ?? []).filter((item) => item.overallRating <= 3).length} />
            <AttentionStat label="Notas 4–5" value={(reviews.data?.items ?? []).filter((item) => item.overallRating >= 4).length} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-display text-xl font-black">Avaliações dos pedidos</h2><p className="mt-1 text-sm text-muted-foreground">Somente pedidos concluídos e verificados podem aparecer aqui.</p></div>
          <div className="rail flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((item) => <Button key={item.key} size="sm" className="shrink-0" variant={filter === item.key ? "default" : "outline"} onClick={() => setFilter(item.key)}>{item.label}</Button>)}
          </div>
        </div>

        {reviews.isLoading ? <ReviewSkeleton /> : null}
        {!reviews.isLoading && !reviews.isError && total === 0 ? <EmptyState title="Ainda não há avaliações" description="Quando um cliente avaliar um pedido entregue ou retirado, a nota aparecerá aqui." /> : null}
        {!reviews.isLoading && total > 0 && items.length === 0 ? <EmptyState size="compact" title="Nenhuma avaliação neste filtro" description="Troque o filtro para ver outras avaliações." /> : null}
        <div className="space-y-3">
          {items.map((review) => <ReviewCard key={review.id} review={review} replying={actions.reply.isPending} onReply={(reply) => actions.reply.mutate({ storeId, reviewId: review.id, reply })} />)}
        </div>
      </section>
    </div>
  );
}

function ReviewCard({ review, replying, onReply }: { review: StoreReviewItem; replying: boolean; onReply: (reply: string) => void }) {
  const [reply, setReply] = useState("");
  const hasReply = Boolean(review.merchantReply);
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2"><p className="font-bold">Pedido #{review.orderNumber}</p><Badge variant={review.overallRating <= 3 ? "warning" : "success"}>{review.overallRating} ★</Badge><Badge variant="outline">{review.fulfillment === "entrega" ? "Entrega" : "Retirada"}</Badge></div>
            <p className="mt-1 text-xs text-muted-foreground">{review.customerName} · {formatDate(review.createdAt)}</p>
          </div>
          <div className="flex shrink-0 gap-3 text-xs text-muted-foreground">
            {review.foodRating ? <span>Produtos <strong className="text-foreground">{review.foodRating}★</strong></span> : null}
            {review.deliveryRating ? <span>Entrega <strong className="text-foreground">{review.deliveryRating}★</strong></span> : null}
          </div>
        </div>

        {review.comment ? <p className="mt-4 whitespace-pre-wrap break-words rounded-xl border border-border bg-surface-muted/35 p-3 text-sm leading-6">{review.comment}</p> : <p className="mt-4 text-sm italic text-muted-foreground">Cliente enviou somente as notas.</p>}

        {hasReply ? (
          <div className="mt-4 rounded-xl border border-brand/15 bg-brand-soft/35 p-3">
            <p className="text-xs font-bold uppercase tracking-[.08em] text-brand">Sua resposta</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{review.merchantReply}</p>
            {review.repliedAt ? <p className="mt-2 text-xs text-muted-foreground">Respondida em {formatDate(review.repliedAt)}</p> : null}
          </div>
        ) : (
          <div className="mt-4 border-t border-border pt-4">
            <label htmlFor={`reply-${review.id}`} className="text-sm font-semibold">Responder publicamente</label>
            <Textarea id={`reply-${review.id}`} className="mt-2 text-base" rows={3} maxLength={1000} value={reply} placeholder="Reconheça o feedback e explique como a loja vai tratar o ponto quando necessário." onChange={(event) => setReply(event.target.value)} />
            <div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{reply.length}/1000</span><Button size="sm" disabled={!reply.trim() || replying} onClick={() => onReply(reply.trim())}>{replying ? "Respondendo…" : "Responder"}</Button></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Star; label: string; value: string; detail: string }) {
  return <Card><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.11em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-black tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-5" /></span></div></CardContent></Card>;
}
function AttentionStat({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-border bg-surface-muted/30 p-4"><p className="text-xs font-bold uppercase tracking-[.08em] text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black tabular-nums">{value}</p></div>; }
function number(value: number | null | undefined) { return Number(value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date); }
function ReviewSkeleton() { return <div className="space-y-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-2xl border border-border bg-surface-muted" />)}</div>; }