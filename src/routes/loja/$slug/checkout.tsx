import { useEffect, useMemo, useState } from "react";
import { createFileRoute, getRouteApi, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, MapPin, Phone, Store } from "lucide-react";

import { OrderingContextBar } from "@/components/storefront/OrderingContextBar";
import { brl } from "@/components/storefront/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatPhone, normalizePhone } from "@/lib/checkout-contracts";
import { useCart } from "@/storefront/cart/cart.context";
import { useCustomerWizard } from "@/storefront/customer/customer-wizard.context";
import { CheckoutError, fetchPaymentMethods, postOrder } from "@/storefront/checkout/checkout.api";
import { messageForCheckoutError } from "@/storefront/checkout/checkout.errors";
import { currentIdempotencyKey, rotateIdempotencyKey, saveReceipt } from "@/storefront/checkout/checkout.storage";
import type { PublicPaymentMethod } from "@/storefront/checkout/checkout.types";

const parentRoute = getRouteApi("/loja/$slug");
const BIG_BUTTON = "min-h-[60px] rounded-2xl text-base font-bold shadow-sm transition active:scale-[.985]";

export const Route = createFileRoute("/loja/$slug/checkout")({
  head: () => ({
    meta: [
      { title: "Finalizar pedido · Comandiva" },
      { name: "description", content: "Revise o pedido e escolha como pagar." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { slug } = parentRoute.useParams();
  const navigate = useNavigate();
  const cart = useCart();
  const wizard = useCustomerWizard();
  const context = wizard.orderingContext;

  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [methods, setMethods] = useState<PublicPaymentMethod[] | null>(null);
  const [methodId, setMethodId] = useState<string | null>(null);
  const [needsChange, setNeedsChange] = useState(false);
  const [changeFor, setChangeFor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const fulfillmentType = context?.type ?? null;

  useEffect(() => {
    if (!fulfillmentType) return;
    let active = true;
    setMethods(null);
    fetchPaymentMethods(slug, fulfillmentType)
      .then((list) => {
        if (!active) return;
        setMethods(list);
        if (list.length === 1) setMethodId(list[0].id);
      })
      .catch(() => active && setMethods([]));
    return () => { active = false; };
  }, [slug, fulfillmentType]);

  const selectedMethod = useMemo(() => methods?.find((method) => method.id === methodId) ?? null, [methods, methodId]);
  const phoneFilled = phone.trim().length > 0;
  const phoneValid = !phoneFilled || normalizePhone(phone) !== null;
  const changeValue = changeFor.trim() ? Number(changeFor.replace(",", ".")) : null;
  const changeValid = !selectedMethod?.requiresChange || !needsChange || (changeValue !== null && Number.isFinite(changeValue) && changeValue >= cart.total);
  const canSubmit = Boolean(context) && cart.canCheckout && phoneValid && Boolean(selectedMethod) && changeValid && !submitting;

  if (!context) {
    return (
      <main className="storefront-global grid min-h-svh place-items-center bg-background px-6 text-center">
        <div className="max-w-sm space-y-3">
          <Store className="mx-auto size-10 text-brand" />
          <h1 className="text-xl font-bold">Falta confirmar como você vai receber</h1>
          <Button className={BIG_BUTTON} onClick={wizard.reopenWizard}>Voltar e confirmar</Button>
        </div>
      </main>
    );
  }

  async function submit() {
    setPhoneTouched(true);
    if (!canSubmit || !context || !selectedMethod) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await postOrder(slug, {
        idempotencyKey: currentIdempotencyKey(slug),
        customer: { firstName: context.firstName, phone: phone.trim() },
        fulfillment: {
          type: context.type,
          deliveryAreaId: context.type === "entrega" ? context.address.neighborhoodId : null,
          configurationVersion: wizard.configuration?.configurationVersion ?? null,
        },
        address: context.type === "entrega" ? {
          street: context.address.street,
          number: context.address.number,
          hasNoNumber: context.address.hasNoNumber,
          complement: context.address.complement,
          reference: context.address.referencePoint,
          label: context.address.customLabel ?? context.address.label,
          latitude: context.address.latitude,
          longitude: context.address.longitude,
          accuracyMeters: null,
        } : null,
        payment: {
          methodId: selectedMethod.id,
          changeFor: selectedMethod.requiresChange && needsChange && changeValue !== null ? changeValue : null,
        },
        notes: notes.trim() || null,
        lines: cart.lines.map((line) => ({
          lineId: line.lineId,
          product_id: line.productId,
          variant_id: line.variantId,
          quantity: line.quantity,
          notes: line.notes,
          selections: line.selections.map((selection) => ({
            option_group_id: selection.option_group_id,
            option_item_id: selection.option_item_id,
            quantity: selection.quantity,
          })),
        })),
      });

      if (!result.ok) {
        if (result.error === "minimum_not_met" || result.error === "line_unavailable") cart.revalidate();
        setError(messageForCheckoutError(result.error));
        return;
      }

      saveReceipt(slug, {
        schemaVersion: 1,
        slug,
        order: result.order,
        fulfillmentType: context.type,
        paymentLabel: selectedMethod.displayName,
        paymentInstructions: selectedMethod.publicInstructions,
        createdAt: new Date().toISOString(),
      });
      rotateIdempotencyKey(slug);
      cart.emptyAll();
      await navigate({ to: "/loja/$slug/pedido-enviado", params: { slug } });
    } catch (submitError) {
      const code = submitError instanceof CheckoutError ? submitError.code : "failed";
      setError(messageForCheckoutError(code));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="storefront-global min-h-svh bg-muted/20 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <OrderingContextBar />
      <header className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4 sm:px-6">
        <Button variant="ghost" size="icon" asChild className="size-12 shrink-0 rounded-full" aria-label="Voltar">
          <Link to="/loja/$slug/carrinho" params={{ slug }}><ArrowLeft className="size-6" /></Link>
        </Button>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-brand">Último passo</p>
          <h1 className="text-xl font-extrabold">Revise e envie seu pedido</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 sm:px-6">
        {error ? <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-medium text-destructive">{error}</div> : null}

        <section className="rounded-3xl border bg-background p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Quem vai receber</p>
              <h2 className="mt-1 text-xl font-extrabold">{context.firstName}</h2>
            </div>
            <Button variant="outline" className="min-h-11 rounded-xl" onClick={wizard.reopenWizard}>Alterar</Button>
          </div>
          <div className="mt-4 flex gap-3 rounded-2xl bg-muted/45 p-4">
            {context.type === "entrega" ? <MapPin className="mt-0.5 size-5 shrink-0 text-brand" /> : <Store className="mt-0.5 size-5 shrink-0 text-brand" />}
            <div className="min-w-0 text-sm">
              <p className="font-bold">{context.type === "entrega" ? "Entrega" : "Retirada na loja"}</p>
              {context.type === "entrega" ? (
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  {context.address.street}{context.address.hasNoNumber ? ", s/n" : `, ${context.address.number ?? ""}`} · {context.address.neighborhoodNameSnapshot}
                </p>
              ) : <p className="mt-1 text-muted-foreground">Você busca quando o pedido estiver pronto.</p>}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border bg-background p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-brand/10 text-brand"><Phone className="size-5" /></div>
            <div>
              <h2 className="text-lg font-extrabold">Telefone <span className="font-medium text-muted-foreground">(opcional)</span></h2>
              <p className="text-sm text-muted-foreground">Você pode continuar sem informar.</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label htmlFor="telefone" className="text-base font-bold">Celular com DDD</Label>
            <Input
              id="telefone"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(34) 99999-9999"
              value={phone}
              onChange={(event) => setPhone(formatPhone(event.target.value))}
              onBlur={() => setPhoneTouched(true)}
              aria-invalid={phoneTouched && !phoneValid}
              className="min-h-[58px] rounded-2xl text-lg"
            />
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[.07] p-3 text-sm leading-relaxed">
              <strong>É muito importante informar um telefone.</strong> A loja ou o entregador podem precisar falar com você se não encontrarem o endereço, houver dúvida no pedido ou algum imprevisto na entrega.
            </div>
            {phoneTouched && !phoneValid ? <p className="text-sm font-medium text-destructive">Confira o DDD e o número, ou deixe o campo vazio.</p> : null}
          </div>
        </section>

        <section className="rounded-3xl border bg-background p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-extrabold">Como você quer pagar?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Toque em uma opção. Só isso.</p>
          <div className="mt-4 space-y-3">
            {methods === null ? <><Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-16 rounded-2xl" /></> : methods.length === 0 ? (
              <p className="rounded-2xl bg-muted p-4 text-sm">A loja ainda não publicou formas de pagamento para esta modalidade.</p>
            ) : methods.map((method) => {
              const selected = method.id === methodId;
              return (
                <button key={method.id} type="button" onClick={() => { setMethodId(method.id); setNeedsChange(false); setChangeFor(""); }} className={`flex min-h-[64px] w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition active:scale-[.99] ${selected ? "border-brand bg-brand/5 ring-2 ring-brand/20" : "bg-background hover:bg-muted/40"}`}>
                  <div><p className="font-bold">{method.displayName}</p>{method.publicInstructions ? <p className="mt-0.5 text-xs text-muted-foreground">{method.publicInstructions}</p> : null}</div>
                  <span className={`grid size-7 place-items-center rounded-full border ${selected ? "border-brand bg-brand text-white" : ""}`}>{selected ? <Check className="size-4" /> : null}</span>
                </button>
              );
            })}
          </div>

          {selectedMethod?.requiresChange ? (
            <div className="mt-4 rounded-2xl bg-muted/40 p-4">
              <p className="font-bold">Vai precisar de troco?</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button type="button" variant={!needsChange ? "default" : "outline"} className="min-h-12 rounded-xl" onClick={() => { setNeedsChange(false); setChangeFor(""); }}>Não</Button>
                <Button type="button" variant={needsChange ? "default" : "outline"} className="min-h-12 rounded-xl" onClick={() => setNeedsChange(true)}>Sim</Button>
              </div>
              {needsChange ? <div className="mt-3"><Label htmlFor="troco">Troco para quanto?</Label><Input id="troco" inputMode="decimal" placeholder={`Ex.: ${Math.ceil(cart.total / 10) * 10}`} value={changeFor} onChange={(e) => setChangeFor(e.target.value)} className="mt-2 min-h-14 rounded-xl text-lg" />{!changeValid ? <p className="mt-2 text-sm text-destructive">O valor precisa ser igual ou maior que {brl(cart.total)}.</p> : null}</div> : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border bg-background p-5 shadow-sm sm:p-6">
          <Label htmlFor="observacao" className="text-base font-extrabold">Alguma observação? <span className="font-normal text-muted-foreground">(opcional)</span></Label>
          <Textarea id="observacao" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={400} placeholder="Ex.: tocar a campainha, retirar ingrediente..." className="mt-3 min-h-24 rounded-2xl text-base" />
        </section>

        <section className="rounded-3xl border bg-background p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-extrabold">Resumo</h2>
          <div className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Itens</span><strong>{brl(cart.subtotal)}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Entrega</span><strong>{brl(cart.deliveryFee)}</strong></div><div className="mt-3 flex justify-between border-t pt-3 text-lg"><span className="font-extrabold">Total</span><span className="font-black">{brl(cart.total)}</span></div></div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        <div className="mx-auto max-w-2xl">
          <Button className={`w-full ${BIG_BUTTON}`} disabled={!canSubmit} onClick={() => void submit()}>
            {submitting ? "Enviando pedido…" : `Enviar pedido · ${brl(cart.total)}`}
          </Button>
          {!selectedMethod && methods?.length ? <p className="mt-2 text-center text-xs text-muted-foreground">Escolha uma forma de pagamento para continuar.</p> : null}
        </div>
      </div>
    </main>
  );
}
