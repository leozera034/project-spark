/**
 * Fase 14 — Checkout público.
 *
 * Nada nesta tela decide valor: o subtotal, a taxa e o total exibidos vêm da
 * cotação do servidor (Fase 13) e o pedido é recalculado de novo, do zero,
 * dentro da transação do banco no envio.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, getRouteApi, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, LocateFixed, MapPin, Store, TriangleAlert } from "lucide-react";

import { OrderingContextBar } from "@/components/storefront/OrderingContextBar";
import { brl } from "@/components/storefront/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

type DeliveryLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
};

function geolocationErrorCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "number" && Number.isFinite(code) ? code : null;
}

export const Route = createFileRoute("/loja/$slug/checkout")({
  head: () => ({
    meta: [
      { title: "Finalizar pedido · Comandiva" },
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
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryLocation | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

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

  useEffect(() => {
    setDeliveryLocation(null);
    setLocationMessage(null);
  }, [context?.type, context?.type === "entrega" ? context.address.localId : null]);

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
      <main className="storefront-global mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <Store className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Confirme seus dados de atendimento para continuar.
        </p>
      </main>
    );
  }

  const captureDeliveryLocation = async () => {
    if (context.type !== "entrega" || locationBusy || submitting) return;
    setLocationMessage(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationMessage("Este dispositivo não oferece localização pelo navegador. O pedido continua normalmente.");
      return;
    }

    setLocationBusy(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10_000,
          maximumAge: 30_000,
        });
      });
      const accuracy = Number.isFinite(position.coords.accuracy)
        ? Math.min(10_000, Math.max(0, Math.round(position.coords.accuracy)))
        : null;
      setDeliveryLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: accuracy,
      });
      setLocationMessage(
        accuracy !== null
          ? `Localização adicionada com precisão aproximada de ${accuracy} m. A taxa de entrega não muda.`
          : "Localização adicionada. A taxa de entrega não muda.",
      );
    } catch (locationError) {
      const code = geolocationErrorCode(locationError);
      if (code === 1) setLocationMessage("Permissão negada. O pedido continua usando o endereço e o bairro normalmente.");
      else if (code === 2) setLocationMessage("Não foi possível determinar sua localização. O pedido continua normalmente.");
      else setLocationMessage("A localização demorou demais. Você pode enviar o pedido sem ela.");
    } finally {
      setLocationBusy(false);
    }
  };

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
                latitude: deliveryLocation?.latitude ?? context.address.latitude,
                longitude: deliveryLocation?.longitude ?? context.address.longitude,
                accuracyMeters: deliveryLocation?.accuracyMeters ?? null,
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
    <main className="storefront-global min-h-svh bg-background pb-[calc(10rem+env(safe-area-inset-bottom))]">
      <OrderingContextBar />

      <header className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
        <Button variant="ghost" size="icon" asChild aria-label="Voltar ao carrinho" className="shrink-0">
          <Link to="/loja/$slug/carrinho" params={{ slug }}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="min-w-0 truncate text-lg font-semibold">Finalizar pedido</h1>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 sm:space-y-6 sm:px-6">
        <section className="panel space-y-3 p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Seus dados</h2>
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={context.firstName} readOnly className="bg-muted/40" />
            <button
              type="button"
              className="text-left text-xs text-brand underline underline-offset-2"
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
              className="min-h-[48px] text-base"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              A loja usa o telefone para confirmar o pedido. Ele é obrigatório na entrega e na retirada.
            </p>
            {touched && !phoneValid ? (
              <p className="text-xs text-destructive">{CHECKOUT_MESSAGES.phoneInvalid}</p>
            ) : null}
          </div>
        </section>

        <section className="panel space-y-3 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {context.type === "entrega" ? (
              <MapPin className="size-4 shrink-0" />
            ) : (
              <Store className="size-4 shrink-0" />
            )}
            {context.type === "entrega" ? "Entrega" : "Retirada"}
          </h2>
          {context.type === "entrega" ? (
            <>
              <p className="break-words text-sm leading-relaxed text-muted-foreground">
                {context.address.street}
                {context.address.hasNoNumber ? ", s/n" : `, ${context.address.number ?? ""}`}
                {context.address.complement ? ` · ${context.address.complement}` : ""}
                <br />
                {context.address.neighborhoodNameSnapshot}
              </p>
              <div className="rounded-xl border border-border bg-muted/30 p-3.5">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Opcional: se você estiver neste endereço agora, envie a localização do aparelho para melhorar a distância e a previsão operacional. A taxa continua definida pelo bairro.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={locationBusy || submitting}
                  onClick={() => void captureDeliveryLocation()}
                >
                  <LocateFixed className="mr-2 size-4" />
                  {locationBusy
                    ? "Localizando..."
                    : deliveryLocation || (context.address.latitude !== null && context.address.longitude !== null)
                      ? "Atualizar localização"
                      : "Usar minha localização neste endereço"}
                </Button>
                {locationMessage ? <p className="mt-2 text-xs text-muted-foreground">{locationMessage}</p> : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Retirada no balcão do estabelecimento.</p>
          )}
        </section>

        <section className="panel space-y-3 p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Forma de pagamento</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            O pagamento é combinado direto com a loja. Nada é cobrado por aqui.
          </p>

          {methods === null ? (
            <div role="status" aria-live="polite" className="space-y-2">
              <span className="sr-only">Carregando formas de pagamento</span>
              <Skeleton className="h-13 w-full rounded-xl" />
              <Skeleton className="h-13 w-full rounded-xl" />
            </div>
          ) : methods.length === 0 ? (
            <p className="text-sm">
              Esta loja ainda não publicou formas de pagamento para esta modalidade.
            </p>
          ) : (
            <div className="space-y-2">
              {methods.map((method) => (
                <label
                  key={method.id}
                  className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-sm transition-colors ${
                    methodId === method.id ? "border-brand bg-brand-soft" : "hover:bg-muted/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="pagamento"
                    className="size-4 shrink-0 accent-[var(--brand,currentColor)]"
                    checked={methodId === method.id}
                    onChange={() => {
                      setMethodId(method.id);
                      setNeedsChange(false);
                      setChangeFor("");
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-medium">{method.displayName}</span>
                    {method.publicInstructions ? (
                      <span className="block break-words text-xs leading-relaxed text-muted-foreground">
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
                  className="size-4 shrink-0 accent-[var(--brand,currentColor)]"
                  checked={needsChange}
                  onChange={(event) => setNeedsChange(event.target.checked)}
                />
                <span>Preciso de troco</span>
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
                    className="min-h-[48px] text-base"
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

        <section className="panel space-y-2 p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Observações para a loja</h2>
          <Textarea
            aria-label="Observações para a loja"
            value={notes}
            maxLength={400}
            placeholder="Ex.: interfone quebrado, entregar na portaria."
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-24 resize-y"
          />
        </section>

        <section className="panel p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold">Resumo</h2>
          <ul className="space-y-2 text-sm">
            {cart.views.map((view) => (
              <li key={view.line.lineId} className="flex min-w-0 justify-between gap-3">
                <span className="min-w-0 break-words">
                  <span className="tabular-nums">{view.line.quantity}×</span>{" "}
                  {view.line.productNameSnapshot}
                </span>
                <span className="shrink-0 tabular-nums">
                  {view.total === null ? "—" : brl(view.total)}
                </span>
              </li>
            ))}
          </ul>

          <Separator className="my-4" />

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="min-w-0 text-muted-foreground">Subtotal</dt>
              <dd className="shrink-0 tabular-nums">{brl(cart.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="min-w-0 text-muted-foreground">
                {cart.deliveryFee === null ? "Retirada na loja" : "Taxa de entrega"}
              </dt>
              <dd className="shrink-0 tabular-nums">
                {cart.deliveryFee === null ? "Sem taxa" : brl(cart.deliveryFee)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="shrink-0 tabular-nums">{brl(cart.total)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Os valores são calculados no servidor da loja e conferidos de novo no envio.
          </p>
        </section>

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-danger-soft p-3 text-sm"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">{error}</span>
          </p>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-4">
        <div className="mx-auto max-w-3xl space-y-2">
          <Button
            className="min-h-14 w-full gap-3 px-4 text-base"
            disabled={!canSubmit}
            loading={submitting}
            loadingLabel="Enviando pedido"
            onClick={() => void submit()}
          >
            <span className="min-w-0 flex-1 text-left leading-tight">
              {submitting ? "Enviando pedido…" : "Enviar pedido"}
            </span>
            <span className="shrink-0 tabular-nums">{brl(cart.total)}</span>
          </Button>
          <p className="px-1 text-center text-[11px] leading-relaxed text-muted-foreground">
            Ao enviar, a loja recebe o pedido para confirmação. O pagamento é feito direto com ela.
          </p>
        </div>
      </div>
    </main>
  );
}
