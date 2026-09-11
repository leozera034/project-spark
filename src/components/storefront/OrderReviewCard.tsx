import { useEffect, useState } from "react";
import { CheckCircle2, MessageSquareText, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PublicOrderReviewState } from "@/lib/store-reviews.contracts";
import { fetchOrderReviewState, submitOrderReview } from "@/storefront/reviews/review.api";

export function OrderReviewCard({
  token,
  fulfillment,
}: {
  token: string;
  fulfillment: "entrega" | "retirada";
}) {
  const [state, setState] = useState<PublicOrderReviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overallRating, setOverallRating] = useState(0);
  const [foodRating, setFoodRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    let alive = true;
    queueMicrotask(() => {
      if (alive) setLoading(true);
    });
    void fetchOrderReviewState(token)
      .then((result) => {
        if (!alive) return;
        setState(result);
        setError(null);
      })
      .catch(() => {
        if (alive) setError("Não foi possível carregar a avaliação agora.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  async function submit() {
    if (overallRating < 1 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitOrderReview({
        token,
        overallRating,
        foodRating: foodRating || null,
        deliveryRating: fulfillment === "entrega" ? deliveryRating || null : null,
        comment: comment.trim() || null,
      });
      if (!result.ok) {
        setError(reviewErrorMessage(result.error));
        return;
      }
      const next = await fetchOrderReviewState(token);
      setState(next);
    } catch {
      setError("Não foi possível enviar sua avaliação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="panel mt-4 p-4 sm:p-5" aria-busy="true">
        <div className="h-5 w-40 animate-pulse rounded bg-surface-muted" />
        <div className="mt-3 h-16 animate-pulse rounded-xl bg-surface-muted" />
      </section>
    );
  }

  if (state?.submitted && state.review) {
    return (
      <section className="panel mt-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success-soft text-success"><CheckCircle2 className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Obrigado pela avaliação</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sua nota deste pedido foi registrada e não pode ser enviada novamente.</p>
            <div className="mt-3"><Stars value={state.review.overallRating} readOnly label="Sua nota" /></div>
            {state.review.comment ? <p className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-border bg-surface-muted/50 p-3 text-sm">{state.review.comment}</p> : null}
            {state.review.merchantReply ? (
              <div className="mt-3 rounded-xl border border-brand/15 bg-brand-soft/40 p-3">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.08em] text-brand"><MessageSquareText className="size-3.5" /> Resposta da loja</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{state.review.merchantReply}</p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">A loja ainda não respondeu publicamente a esta avaliação.</p>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (!state?.available) return null;

  return (
    <section className="panel mt-4 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Star className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Como foi seu pedido?</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Sua avaliação é vinculada a este pedido concluído e ajuda a loja a melhorar.</p>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <RatingField label="Nota geral" required value={overallRating} onChange={setOverallRating} />
        <RatingField label="Comida / produtos" value={foodRating} onChange={setFoodRating} />
        {fulfillment === "entrega" ? <RatingField label="Entrega" value={deliveryRating} onChange={setDeliveryRating} /> : null}
        <div>
          <label htmlFor="order-review-comment" className="text-sm font-semibold">Comentário <span className="font-normal text-muted-foreground">(opcional)</span></label>
          <Textarea
            id="order-review-comment"
            value={comment}
            maxLength={1000}
            rows={4}
            className="mt-2 text-base"
            placeholder="Conte o que funcionou bem ou o que poderia melhorar."
            onChange={(event) => setComment(event.target.value)}
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">{comment.length}/1000</p>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
      <Button className="mt-4 min-h-12 w-full" disabled={overallRating < 1 || submitting} onClick={() => void submit()}>
        <Star className="size-4" /> {submitting ? "Enviando…" : "Enviar avaliação"}
      </Button>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">É permitida uma avaliação por pedido. Sua nota não exibe telefone, endereço ou outros dados pessoais.</p>
    </section>
  );
}

function RatingField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  required?: boolean;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{label}{required ? " *" : ""}</legend>
      <Stars value={value} onChange={onChange} label={label} />
    </fieldset>
  );
}

function Stars({
  value,
  onChange,
  readOnly = false,
  label,
}: {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  label: string;
}) {
  return (
    <div className="mt-2 flex items-center gap-1" aria-label={`${label}: ${value || "sem nota"}`}>
      {Array.from({ length: 5 }, (_, index) => {
        const rating = index + 1;
        const active = rating <= value;
        return readOnly ? (
          <Star key={rating} className={`size-6 ${active ? "fill-current text-warning" : "text-muted-foreground/30"}`} aria-hidden="true" />
        ) : (
          <button
            key={rating}
            type="button"
            className="grid min-h-11 min-w-11 place-items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${rating} ${rating === 1 ? "estrela" : "estrelas"}`}
            aria-pressed={active}
            onClick={() => onChange?.(rating)}
          >
            <Star className={`size-7 ${active ? "fill-current text-warning" : "text-muted-foreground/35"}`} />
          </button>
        );
      })}
    </div>
  );
}

function reviewErrorMessage(error: string | undefined) {
  if (error === "order_not_completed") return "Este pedido ainda não foi concluído e não pode ser avaliado.";
  if (error === "delivery_rating_not_applicable") return "A nota de entrega não se aplica a este pedido.";
  if (error === "rating_invalid" || error === "food_rating_invalid" || error === "delivery_rating_invalid") return "Escolha uma nota válida entre 1 e 5.";
  if (error === "comment_too_long") return "O comentário ultrapassou o limite permitido.";
  if (error === "rate_limited") return "Muitas tentativas em pouco tempo. Tente novamente mais tarde.";
  return "Esta avaliação não pôde ser registrada agora.";
}
