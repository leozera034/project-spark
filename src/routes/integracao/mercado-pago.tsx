import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CreditCard, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const MP_SCRIPT_ID = "mercadopago-sdk-v2";
const MP_SCRIPT_SRC = "https://sdk.mercadopago.com/js/v2";
const BILLING_ENDPOINT =
  "https://ypgteuxzgqmkkkpvibhi.supabase.co/functions/v1/comandiva-billing?action=create_test_subscription";

interface CardFormData {
  token?: string;
  cardholderEmail?: string;
}

interface MercadoPagoCardForm {
  getCardFormData: () => CardFormData;
  unmount?: () => void;
}

interface MercadoPagoInstance {
  cardForm: (options: Record<string, unknown>) => MercadoPagoCardForm;
}

type MercadoPagoConstructor = new (
  publicKey: string,
  options?: { locale?: string },
) => MercadoPagoInstance;

declare global {
  interface Window {
    MercadoPago?: MercadoPagoConstructor;
  }
}

interface SubscriptionResult {
  ok: boolean;
  subscriptionId?: string;
  status?: string;
  nextPaymentDate?: string | null;
  error?: string;
  providerMessage?: string | null;
  providerCauses?: Array<{ code?: string | number; description?: string }>;
}

export const Route = createFileRoute("/integracao/mercado-pago")({
  head: () => ({
    meta: [
      { title: "Teste Mercado Pago | Comandiva" },
      { name: "description", content: "Harness técnico temporário da integração Mercado Pago." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MercadoPagoIntegrationTestPage,
});

function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.MercadoPago) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(MP_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("sdk_load_failed")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = MP_SCRIPT_ID;
    script.src = MP_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("sdk_load_failed"));
    document.head.appendChild(script);
  });
}

function FieldShell({ id }: { id: string }) {
  return (
    <div
      id={id}
      className="h-11 rounded-md border border-input bg-background px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-ring"
    />
  );
}

function MercadoPagoIntegrationTestPage() {
  const [sdkReady, setSdkReady] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubscriptionResult | null>(null);
  const initializedRef = useRef(false);
  const submittingRef = useRef(false);
  const cardFormRef = useRef<MercadoPagoCardForm | null>(null);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const publicKey = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY_TEST?.trim();
    if (!publicKey) {
      setSetupError("Public Key de teste não encontrada no ambiente da aplicação.");
      return;
    }

    let cancelled = false;

    void loadMercadoPagoSdk()
      .then(() => {
        if (cancelled || !window.MercadoPago) return;

        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        cardFormRef.current = mp.cardForm({
          amount: "1.00",
          iframe: true,
          form: {
            id: "form-checkout",
            cardNumber: {
              id: "form-checkout__cardNumber",
              placeholder: "Número do cartão",
            },
            expirationDate: {
              id: "form-checkout__expirationDate",
              placeholder: "MM/AA",
            },
            securityCode: {
              id: "form-checkout__securityCode",
              placeholder: "CVV",
            },
            cardholderName: {
              id: "form-checkout__cardholderName",
              placeholder: "Titular do cartão",
            },
            issuer: {
              id: "form-checkout__issuer",
              placeholder: "Banco emissor",
            },
            installments: {
              id: "form-checkout__installments",
              placeholder: "Parcelas",
            },
            identificationType: {
              id: "form-checkout__identificationType",
              placeholder: "Tipo de documento",
            },
            identificationNumber: {
              id: "form-checkout__identificationNumber",
              placeholder: "CPF",
            },
            cardholderEmail: {
              id: "form-checkout__cardholderEmail",
              placeholder: "E-mail do comprador de teste",
            },
          },
          callbacks: {
            onFormMounted: (error: unknown) => {
              if (cancelled) return;
              if (error) {
                setSetupError("O Mercado Pago não conseguiu inicializar o formulário de cartão.");
                return;
              }
              setSdkReady(true);
            },
            onSubmit: async (event: Event) => {
              event.preventDefault();
              if (submittingRef.current) return;

              const data = cardFormRef.current?.getCardFormData();
              const cardTokenId = data?.token?.trim();
              const payerEmail = data?.cardholderEmail?.trim().toLowerCase();

              if (!cardTokenId || !payerEmail) {
                setResult({ ok: false, error: "card_token_missing" });
                return;
              }

              submittingRef.current = true;
              setIsSubmitting(true);
              setResult(null);

              try {
                const response = await fetch(BILLING_ENDPOINT, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ cardTokenId, payerEmail }),
                });
                const payload = (await response.json()) as SubscriptionResult;
                setResult(payload);
              } catch {
                setResult({ ok: false, error: "network_error" });
              } finally {
                submittingRef.current = false;
                setIsSubmitting(false);
              }
            },
            onFetching: () => {
              setResult(null);
              return () => undefined;
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setSetupError("Não foi possível carregar o SDK oficial do Mercado Pago.");
      });

    return () => {
      cancelled = true;
      cardFormRef.current?.unmount?.();
      cardFormRef.current = null;
    };
  }, []);

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary">Comandiva Billing</p>
            <h1 className="text-2xl font-semibold tracking-tight">Teste de assinatura Mercado Pago</h1>
          </div>
          <Badge variant="secondary">TESTE · R$ 1,00/mês</Badge>
        </div>

        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Ambiente isolado</AlertTitle>
          <AlertDescription>
            Use apenas conta, cartão e dados de teste do Mercado Pago. Os dados sensíveis do cartão
            são tokenizados pelo MercadoPago.js e não são enviados ao backend da Comandiva.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> Cartão de teste
            </CardTitle>
            <CardDescription>
              Para cenário aprovado, use os dados oficiais de teste e o titular APRO.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {setupError ? (
              <Alert variant="destructive">
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>Integração não inicializada</AlertTitle>
                <AlertDescription>{setupError}</AlertDescription>
              </Alert>
            ) : (
              <form id="form-checkout" className="space-y-4">
                <div className="space-y-2">
                  <Label>Número do cartão</Label>
                  <FieldShell id="form-checkout__cardNumber" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Validade</Label>
                    <FieldShell id="form-checkout__expirationDate" />
                  </div>
                  <div className="space-y-2">
                    <Label>CVV</Label>
                    <FieldShell id="form-checkout__securityCode" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="form-checkout__cardholderName">Titular</Label>
                  <input
                    id="form-checkout__cardholderName"
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
                    defaultValue="APRO"
                    autoComplete="cc-name"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="form-checkout__identificationType">Documento</Label>
                    <select
                      id="form-checkout__identificationType"
                      className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="form-checkout__identificationNumber">CPF de teste</Label>
                    <input
                      id="form-checkout__identificationNumber"
                      className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
                      defaultValue="12345678909"
                      inputMode="numeric"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="form-checkout__cardholderEmail">E-mail do comprador de teste</Label>
                  <input
                    id="form-checkout__cardholderEmail"
                    type="email"
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
                    defaultValue="test@testuser.com"
                    autoComplete="email"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="form-checkout__issuer">Emissor</Label>
                    <select
                      id="form-checkout__issuer"
                      className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="form-checkout__installments">Parcelas</Label>
                    <select
                      id="form-checkout__installments"
                      className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <progress className="hidden" value="0" />

                <Button
                  id="form-checkout__submit"
                  type="submit"
                  className="h-12 w-full"
                  disabled={!sdkReady || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando assinatura…
                    </>
                  ) : (
                    "Criar assinatura de teste"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {result ? (
          result.ok ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Assinatura criada</AlertTitle>
              <AlertDescription>
                Mercado Pago respondeu com status {result.status ?? "recebido"}. ID técnico: {result.subscriptionId}.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Mercado Pago recusou a criação</AlertTitle>
              <AlertDescription className="space-y-1">
                <p>{result.providerMessage ?? result.error ?? "Falha desconhecida."}</p>
                {result.providerCauses?.map((cause, index) => (
                  <p key={`${cause.code ?? "cause"}-${index}`}>
                    {cause.code ? `${cause.code}: ` : ""}
                    {cause.description ?? "Erro retornado pelo provedor."}
                  </p>
                ))}
              </AlertDescription>
            </Alert>
          )
        ) : null}

        <p className="text-center text-xs text-muted-foreground">
          Harness temporário de integração. Não será exposto na navegação comercial.
        </p>
      </div>
    </main>
  );
}
