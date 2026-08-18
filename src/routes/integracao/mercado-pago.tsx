import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

const MP_SCRIPT_ID = "mercadopago-sdk-v2";
const MP_SCRIPT_SRC = "https://sdk.mercadopago.com/js/v2";
const BILLING_BASE = "https://ypgteuxzgqmkkkpvibhi.supabase.co/functions/v1/comandiva-billing";
const BILLING_ENDPOINT = `${BILLING_BASE}?action=create_test_subscription`;
const PUBLIC_CONFIG_ENDPOINT = `${BILLING_BASE}?action=public_config`;
const CONTAINER_ID = "cardPaymentBrick_container";
const TEST_CPF = "12345678909";
const BRICK_READY_TIMEOUT_MS = 15_000;

type Controller = { unmount?: () => Promise<void> | void };
type Builder = {
  create: (type: string, id: string, settings: Record<string, unknown>) => Promise<Controller>;
};
type MPInstance = { bricks: () => Builder };
type MPCtor = new (key: string, options?: { locale?: string }) => MPInstance;

declare global {
  interface Window {
    MercadoPago?: MPCtor;
  }
}

interface SubscriptionResult {
  ok: boolean;
  subscriptionId?: string;
  status?: string;
  error?: string;
  providerMessage?: string | null;
  providerCauses?: Array<{ code?: string | number; description?: string }>;
}

export const Route = createFileRoute("/integracao/mercado-pago")({
  head: () => ({
    meta: [
      { title: "Homologação Mercado Pago | Comandiva" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MercadoPagoIntegrationTestPage,
});

function loadSdk(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(MP_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.MercadoPago) {
        resolve();
        return;
      }
      existing.addEventListener(
        "load",
        () => (window.MercadoPago ? resolve() : reject(new Error("sdk_failed"))),
        { once: true },
      );
      existing.addEventListener("error", () => reject(new Error("sdk_failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = MP_SCRIPT_ID;
    script.src = MP_SCRIPT_SRC;
    script.async = true;
    script.onload = () =>
      window.MercadoPago ? resolve() : reject(new Error("sdk_failed"));
    script.onerror = () => reject(new Error("sdk_failed"));
    document.head.appendChild(script);
  });
}

async function getPublicKey(): Promise<string> {
  const buildKey = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY_TEST?.trim();
  if (buildKey) return buildKey;

  const response = await fetch(PUBLIC_CONFIG_ENDPOINT, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    publicKey?: string;
    error?: string;
  };

  if (!response.ok || !data.ok || !data.publicKey) {
    throw new Error(data.error || "public_key_missing");
  }
  return data.publicKey.trim();
}

function errorText(data: SubscriptionResult) {
  return (
    data.providerCauses
      ?.map((cause) =>
        `${cause.code ? `${cause.code}: ` : ""}${cause.description ?? ""}`.trim(),
      )
      .filter(Boolean)
      .join(" · ") ||
    data.providerMessage ||
    data.error ||
    "Falha retornada pelo Mercado Pago."
  );
}

function brickErrorText(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();

  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    for (const key of ["message", "cause", "type", "error", "code"]) {
      if (typeof value[key] === "string" && value[key]) return String(value[key]);
      if (typeof value[key] === "number") return `${key}: ${value[key]}`;
    }
  }
  return "Erro não identificado durante a inicialização do checkout.";
}

function MercadoPagoIntegrationTestPage() {
  const [ready, setReady] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [result, setResult] = useState<SubscriptionResult | null>(null);
  const [retry, setRetry] = useState(0);
  const controllerRef = useRef<Controller | null>(null);

  useEffect(() => {
    let cancelled = false;
    let brickReady = false;

    setReady(false);
    setSetupError(null);
    setResult(null);
    setLoadingPayment(false);

    const container = document.getElementById(CONTAINER_ID);
    container?.replaceChildren();

    const readyTimer = window.setTimeout(() => {
      if (!cancelled && !brickReady) {
        setSetupError(
          "O Card Payment Brick não ficou pronto em 15 segundos. A integração foi interrompida para evitar carregamento infinito.",
        );
      }
    }, BRICK_READY_TIMEOUT_MS);

    void Promise.all([getPublicKey(), loadSdk()])
      .then(async ([key]) => {
        if (cancelled || !window.MercadoPago) return;

        const mp = new window.MercadoPago(key, { locale: "pt-BR" });
        const bricksBuilder = mp.bricks();

        const controller = await bricksBuilder.create("cardPayment", CONTAINER_ID, {
          // Keep bootstrap intentionally minimal. The official Brick collects payer data itself.
          initialization: { amount: 1 },
          callbacks: {
            onReady: () => {
              brickReady = true;
              window.clearTimeout(readyTimer);
              if (!cancelled) {
                setSetupError(null);
                setReady(true);
              }
            },
            onError: (error: unknown) => {
              const message = brickErrorText(error);
              if (!cancelled) {
                if (!brickReady) {
                  window.clearTimeout(readyTimer);
                  setSetupError(`Mercado Pago: ${message}`);
                } else {
                  setResult({ ok: false, error: `Mercado Pago: ${message}` });
                }
              }
            },
            onSubmit: async (formData: unknown) => {
              const data =
                formData && typeof formData === "object"
                  ? (formData as Record<string, unknown>)
                  : {};
              const token = typeof data.token === "string" ? data.token.trim() : "";
              const payer =
                data.payer && typeof data.payer === "object"
                  ? (data.payer as Record<string, unknown>)
                  : {};
              const payerEmail =
                typeof payer.email === "string" ? payer.email.trim().toLowerCase() : "";

              if (!token || !payerEmail) {
                const failure = {
                  ok: false,
                  error:
                    "O Mercado Pago não retornou token e e-mail do pagador. Revise os campos destacados pelo checkout.",
                } satisfies SubscriptionResult;
                if (!cancelled) setResult(failure);
                throw new Error("brick_form_incomplete");
              }

              setLoadingPayment(true);
              setResult(null);

              try {
                const response = await fetch(BILLING_ENDPOINT, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ cardTokenId: token, payerEmail }),
                });
                const payload = (await response.json()) as SubscriptionResult;
                if (!cancelled) setResult(payload);

                if (!response.ok || !payload.ok) {
                  throw new Error(errorText(payload));
                }
              } finally {
                if (!cancelled) setLoadingPayment(false);
              }
            },
          },
        });

        if (cancelled) {
          void controller.unmount?.();
        } else {
          controllerRef.current = controller;
        }
      })
      .catch((error: unknown) => {
        window.clearTimeout(readyTimer);
        if (!cancelled) {
          setSetupError(`Não foi possível iniciar o checkout: ${brickErrorText(error)}`);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(readyTimer);
      const controller = controllerRef.current;
      controllerRef.current = null;
      void controller?.unmount?.();
    };
  }, [retry]);

  return (
    <main className="min-h-screen bg-[#FBF7F2] px-4 py-6 text-[#2A1634] sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex items-center justify-between gap-4">
          <img
            src="/brand/comandiva-logo-horizontal.png"
            alt="Comandiva"
            className="h-10 w-auto"
          />
          <span className="rounded-full border border-[#DED0E3] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#4B1D6D]">
            Sandbox
          </span>
        </header>

        <div className="grid gap-7 lg:grid-cols-[0.78fr_1.22fr]">
          <section className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-[#6E3C82]">Homologação de billing</p>
              <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-tight">
                Teste oficial de assinatura Mercado Pago
              </h1>
              <p className="mt-4 leading-7 text-[#716575]">
                O Mercado Pago controla os campos, validações, tokenização e o botão. A Comandiva
                recebe somente o CardToken e o e-mail informado no checkout.
              </p>
            </div>

            <div className="rounded-3xl border border-[#E8DED7] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#978A9A]">
                    Assinatura de teste
                  </p>
                  <p className="mt-2 text-4xl font-semibold">
                    R$ 1,00 <span className="text-base font-normal text-[#7D7280]">/ mês</span>
                  </p>
                </div>
                <div className="rounded-2xl bg-[#4B1D6D] p-3 text-white">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-5 flex gap-3 rounded-2xl bg-[#F8F2FA] p-4 text-sm leading-6 text-[#635768]">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#4B1D6D]" />
                <span>
                  Use cartão oficial de teste, titular <strong>APRO</strong>, CPF{" "}
                  <strong>{TEST_CPF}</strong> e um e-mail diferente do e-mail da sua conta Mercado
                  Pago.
                </span>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-[#E8DED7] bg-white shadow-[0_24px_70px_rgba(55,31,67,0.12)]">
            <div className="border-b border-[#EEE5DE] px-5 py-5 sm:px-7">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#978A9A]">
                Checkout seguro
              </p>
              <h2 className="mt-1 text-2xl font-semibold">Dados do cartão de teste</h2>
            </div>

            <div className="p-4 sm:p-7">
              {!ready && !setupError ? (
                <div className="mb-4 flex items-center gap-3 rounded-2xl bg-[#F8F2FA] px-4 py-3 text-sm text-[#5D376F]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Conectando ao checkout oficial do Mercado Pago…
                </div>
              ) : null}

              {setupError ? (
                <div className="mb-5 rounded-2xl border border-[#F1C9C0] bg-[#FFF5F2] p-5 text-[#803421]">
                  <div className="flex gap-3">
                    <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-semibold">Checkout não carregou</p>
                      <p className="mt-1 break-words text-sm leading-6">{setupError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRetry((value) => value + 1)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#4B1D6D] px-4 py-3 text-sm font-semibold text-white"
                  >
                    <RefreshCw className="h-4 w-4" /> Tentar novamente
                  </button>
                </div>
              ) : null}

              <div id={CONTAINER_ID} className="min-h-[420px]" />

              {loadingPayment ? (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#F8F2FA] px-4 py-3 text-sm text-[#5D376F]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Criando assinatura recorrente…
                </div>
              ) : null}

              {result ? (
                <div
                  className={`mt-5 rounded-2xl border p-5 ${
                    result.ok
                      ? "border-[#BFE0CA] bg-[#F1FBF4] text-[#265D39]"
                      : "border-[#F1C9C0] bg-[#FFF5F2] text-[#803421]"
                  }`}
                >
                  <div className="flex gap-3">
                    {result.ok ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    ) : (
                      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {result.ok
                          ? "Assinatura criada com sucesso"
                          : "Não foi possível criar a assinatura"}
                      </p>
                      <p className="mt-1 break-words text-sm leading-6">
                        {result.ok
                          ? `Status: ${result.status ?? "recebido"}. ID: ${result.subscriptionId ?? "—"}.`
                          : errorText(result)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
