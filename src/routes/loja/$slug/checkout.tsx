/**
 * Fase 14 — Checkout público.
 *
 * Nada nesta tela decide valor: o subtotal, a taxa e o total exibidos vêm da
 * cotação do servidor (Fase 13) e o pedido é recalculado de novo, do zero,
 * dentro da transação do banco no envio.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, getRouteApi, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, MapPin, Store, TriangleAlert } from "lucide-react";

import { OrderingContextBar } from "@/components/storefront/OrderingContextBar";
import { brl } from "@/components/storefront/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatPhone, normalizePhone } from "@/lib/checkout-contracts";
import { useCart } from "@/storefront/cart/cart.context";
import { useCustomerWizard } from "@/storefront/customer/customer-wizard.context";
import { CheckoutError, fetchPaymentMethods, postOrder } from "@/storefront/checkout/checkout.api";
import {
  CHECKOUT_MESSAGES,
  messageForCheckoutError,
} from "@/storefront/checkout/checkout.errors";
import {
  currentIdempotencyKey,
  rotateIdempotencyKey,
  saveReceipt,
} from "@/storefront/checkout/checkout.storage";
import type { PublicPaymentMethod } from "@/storefront/checkout/checkout.types";

const parentRoute = getRouteApi("/loja/$slug");

export const Route = createFileRoute("/loja/$slug/checkout")({
  head: () => ({
    meta: [
      { title: "Finalizar pedido · Pediu Aqui" },
      {
        name: "description",
        content: "Confirme telefone, forma de pagamento e revise o pedido antes de enviar.",
      },
      { property: "og:title", content: "Finalizar pedido" },
      {
        property: "og:description",
        content: "Confirme telefone, forma de pagamento e revise o pedido antes de enviar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const [changeFor, setChangeFor] = useState("");
  const [needsChange, setNeedsChange] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const fulfillmentType = context?.type ?? null;

  useEffect(() => {
    if (!fulfillmentType) return;
    let alive = true;
    setMethods(null);
    fetchPaymentMethods(slug, fulfillmentType)
      .then((list) => {
        if (!alive) return;
        setMethods(list);
        setMethodId((current) => (current && list.some((m) => m.id === current) ? current : null));
      })
      .catch(() => {
        if (alive) setMethods([]);
      });
    return () => {
      alive = false;
    };
  }, [slug, fulfillmentType]);

  const selectedMethod = useMemo(
    () => methods?.find((method) => method.id === methodId) ?? null,
    [methods, methodId],
  );

  const phoneDigits = normalizePhone(phone);
  const phoneValid = phoneDigits !== null;
  const changeValue = changeFor.trim() ? Number(changeFor.replace(",", ".")) : null;
  const changeValid =
    !selectedMethod?.requiresChange ||
    !needsChange ||
    (changeValue !== null && Number.isFinite(changeValue) && changeValue >= cart.total);

  const canSubmit =
    Boolean(context) &&
    cart.canCheckout &&
    phoneValid &&
    Boolean(selectedMethod) &&
    changeValid &&
    !submitting;

  if (!context) {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <Store className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Confirme seus dados de atendimento para continuar.
        </p>
      </main>
    );
  }

  const submit = async () => {
    setTouched(true);
    if (!canSubmit) return;
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
        address:
          context.type === "entrega"
            ? {
                street: context.address.street,
                number: context.address.number,
                hasNoNumber: context.address.hasNoNumber,
                complement: context.address.complement,
                reference: context.address.referencePoint,
                label: context.address.customLabel ?? context.address.label,
              }
            : null,
        payment: {
          methodId: selectedMethod!.id,
          changeFor:
            selectedMethod!.requiresChange && needsChange && changeValue !== null
              ? changeValue
              : null,
        },
        notes: notes.trim() ? notes.trim() : null,
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
        if (result.error === "minimum_not_met" || result.error === "line_unavailable") {
          cart.revalidate();
        }
        setError(messageForCheckoutError(result.error));
        return;
      }

      saveReceipt(slug, {
        schemaVersion: 1,
        slug,
        order: result.order,
        fulfillmentType: context.type,
        paymentLabel: selectedMethod!.displayName,
        paymentInstructions: selectedMethod!.publicInstructions,
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
  };

  return (
    <main className="min-h-svh bg-background pb-44">
      <OrderingContextBar />

      <header className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
        <Button variant="ghost" size="icon" asChild aria-label="Voltar ao carrinho">
          <Link to="/loja/$slug/carrinho" params={{ slug }}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Finalizar pedido</h1>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-4">
        <section className="space-y-3 panel p-4">
          <h2 className="text-sm font-semibold">Seus dados</h2>
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={context.firstName} readOnly className="bg-muted/40" />
            <button
              type="button"
              className="text-xs underline underline-offset-2"
              onClick={wizard.reopenWizard}
            >
              Alterar nome, modalidade ou endereço
            </button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone com DDD</Label>
            <Input
              id="telefone"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 99999-0000"
              value={phone}
              onChange={(event) => setPhone(formatPhone(event.target.value))}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && !phoneValid}
              className="min-h-[48px]"
            />
            <p className="text-xs text-muted-foreground">
              A loja usa o telefone para confirmar o pedido. Ele é obrigatório na entrega e na
              retirada.
            </p>
            {touched && !phoneValid ? (
              <p className="text-xs text-destructive">{CHECKOUT_MESSAGES.phoneInvalid}</p>
            ) : null}
          </div>
        </section>

        <section className="space-y-2 panel p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {context.type === "entrega" ? (
              <MapPin className="size-4" />
            ) : (
              <Store className="size-4" />
            )}
            {context.type === "entrega" ? "Entrega" : "Retirada"}
          </h2>
          {context.type === "entrega" ? (
            <p className="text-sm text-muted-foreground">
              {context.address.street}
              {context.address.hasNoNumber ? ", s/n" : `, ${context.address.number ?? ""}`}
              {context.address.complement ? ` · ${context.address.complement}` : ""}
              <br />
              {context.address.neighborhoodNameSnapshot}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Retirada no balcão do estabelecimento.</p>
          )}
        </section>

        <section className="space-y-3 panel p-4">
          <h2 className="text-sm font-semibold">Forma de pagamento</h2>
          <p className="text-xs text-muted-foreground">
            O pagamento é combinado direto com a loja. Nada é cobrado por aqui.
          </p>

          {methods === null ? (
            <p className="text-sm text-muted-foreground">Carregando formas de pagamento…</p>
          ) : methods.length === 0 ? (
            <p className="text-sm">
              Esta loja ainda não publicou formas de pagamento para esta modalidade.
            </p>
          ) : (
            <div className="space-y-2">
              {methods.map((method) => (
                <label
                  key={method.id}
                  className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-sm ${
                    methodId === method.id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="pagamento"
                    className="size-4"
                    checked={methodId === method.id}
                    onChange={() => {
                      setMethodId(method.id);
                      setNeedsChange(false);
                      setChangeFor("");
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{method.displayName}</span>
                    {method.publicInstructions ? (
                      <span className="block text-xs text-muted-foreground">
                        {method.publicInstructions}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          )}

          {selectedMethod?.requiresChange ? (
            <div className="space-y-2 rounded-xl border border-border bg-surface-muted p-3.5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={needsChange}
                  onChange={(event) => setNeedsChange(event.target.checked)}
                />
                Preciso de troco
              </label>
              {needsChange ? (
                <div className="space-y-1">
                  <Label htmlFor="troco">Troco para quanto?</Label>
                  <Input
                    id="troco"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={changeFor}
                    onChange={(event) => setChangeFor(event.target.value)}
                    className="min-h-[48px]"
                  />
                  {!changeValid ? (
                    <p className="text-xs text-destructive">
                      O valor precisa ser igual ou maior que o total do pedido.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="space-y-2 panel p-4">
          <h2 className="text-sm font-semibold">Observações para a loja</h2>
          <Textarea
            value={notes}
            maxLength={400}
            placeholder="Ex.: interfone quebrado, entregar na portaria."
            onChange={(event) => setNotes(event.target.value)}
          />
        </section>

        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-semibold">Resumo</h2>
          <ul className="space-y-2 text-sm">
            {cart.views.map((view) => (
              <li key={view.line.lineId} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="tabular-nums">{view.line.quantity}×</span>{" "}
                  {view.line.productNameSnapshot}
                </span>
                <span className="tabular-nums">
                  {view.total === null ? "—" : brl(view.total)}
                </span>
              </li>
            ))}
          </ul>

          <Separator className="my-4" />

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{brl(cart.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                {cart.deliveryFee === null ? "Retirada na loja" : "Taxa de entrega"}
              </dt>
              <dd className="tabular-nums">
                {cart.deliveryFee === null ? "Sem taxa" : brl(cart.deliveryFee)}
              </dd>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{brl(cart.total)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            Os valores são calculados no servidor da loja e conferidos de novo no envio.
          </p>
        </section>

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 p-3 text-sm"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-3xl space-y-2">
          <Button
            className="h-13 w-full justify-between px-4 text-base"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            <span className="flex items-center gap-2">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {submitting ? "Enviando pedido…" : "Enviar pedido"}
            </span>
            <span className="tabular-nums">{brl(cart.total)}</span>
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Ao enviar, a loja recebe o pedido para confirmação. O pagamento é feito direto com ela.
          </p>
        </div>
      </div>
    </main>
  );
}
