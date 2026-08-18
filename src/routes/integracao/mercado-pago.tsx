import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

const MP_SCRIPT_ID = "mercadopago-sdk-v2";
const MP_SCRIPT_SRC = "https://sdk.mercadopago.com/js/v2";
const BILLING_BASE = "https://ypgteuxzgqmkkkpvibhi.supabase.co/functions/v1/comandiva-billing";
const BILLING_ENDPOINT = `${BILLING_BASE}?action=create_test_subscription`;
const PUBLIC_CONFIG_ENDPOINT = `${BILLING_BASE}?action=public_config`;
const BOOTSTRAP_TIMEOUT_MS = 12_000;

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

interface PublicConfigResult {
  ok: boolean;
  configured?: boolean;
  publicKey?: string;
  error?: string;
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
      { title: "Homologação de cobrança | Comandiva" },
      {
        name: "description",
        content: "Ambiente isolado para homologação da integração de assinaturas da Comandiva.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MercadoPagoIntegrationTestPage,
});

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, code: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(code)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.MercadoPago) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      error ? reject(error) : resolve();
    };

    const existing = document.getElementById(MP_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.MercadoPago) return finish();
      existing.addEventListener(
        "load",
        () => (window.MercadoPago ? finish() : finish(new Error("sdk_load_failed"))),
        { once: true },
      );
      existing.addEventListener("error", () => finish(new Error("sdk_load_failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = MP_SCRIPT_ID;
    script.src = MP_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.MercadoPago) finish();
      else finish(new Error("sdk_load_failed"));
    };
    script.onerror = () => finish(new Error("sdk_load_failed"));
    document.head.appendChild(script);
  });
}

async function resolvePublicKey(): Promise<string> {
  const buildKey = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY_TEST?.trim();
  if (buildKey) return buildKey;

  const response = await fetch(PUBLIC_CONFIG_ENDPOINT, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as PublicConfigResult;
  const runtimeKey = payload.publicKey?.trim();

  if (!response.ok || !payload.ok || !runtimeKey) {
    throw new Error(payload.error || "public_key_not_configured");
  }
  return runtimeKey;
}

const inputClass =
  "h-12 w-full rounded-xl border border-[#E8DDD4] bg-[#FFFCF8] px-3.5 text-[15px] text-[#2A1634] outline-none transition focus:border-[#7C4A95] focus:ring-4 focus:ring-[#7C4A95]/10";

function FieldShell({ id }: { id: string }) {
  return <div id={id} className={`${inputClass} py-3`} />;
}

function Step({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-sm text-[#5F5364]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F0E7F4] text-[#4B1D6D]">
        <Check className="h-4 w-4" strokeWidth={2.6} />
      </span>
      {children}
    </li>
  );
}

function MercadoPagoIntegrationTestPage() {
  const [sdkReady, setSdkReady] = useState(false);
  const [formInitialized, setFormInitialized] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubscriptionResult | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const submittingRef = useRef(false);
  const cardFormRef = useRef<MercadoPagoCardForm | null>(null);

  useEffect(() => {
    setSdkReady(false);
    setFormInitialized(false);
    setSetupError(null);
    setResult(null);
    let cancelled = false;
    let mounted = false;

    const mountTimeout = window.setTimeout(() => {
      if (!cancelled && !mounted && !cardFormRef.current) {
        setSetupError("O formulário seguro demorou mais que o esperado para iniciar. Tente novamente.");
      }
    }, BOOTSTRAP_TIMEOUT_MS + 2_000);

    void Promise.all([
      withTimeout(resolvePublicKey(), BOOTSTRAP_TIMEOUT_MS, "config_timeout"),
      withTimeout(loadMercadoPagoSdk(), BOOTSTRAP_TIMEOUT_MS, "sdk_timeout"),
    ])
      .then(([publicKey]) => {
        if (cancelled || !window.MercadoPago) return;

        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        const cardForm = mp.cardForm({
          amount: "1.00",
          iframe: true,
          form: {
            id: "form-checkout",
            cardNumber: { id: "form-checkout__cardNumber", placeholder: "0000 0000 0000 0000" },
            expirationDate: { id: "form-checkout__expirationDate", placeholder: "MM/AA" },
            securityCode: { id: "form-checkout__securityCode", placeholder: "CVV" },
            cardholderName: { id: "form-checkout__cardholderName", placeholder: "Nome no cartão" },
            issuer: { id: "form-checkout__issuer", placeholder: "Banco emissor" },
            installments: { id: "form-checkout__installments", placeholder: "Parcelas" },
            identificationType: {
              id: "form-checkout__identificationType",
              placeholder: "Documento",
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
              mounted = true;
              window.clearTimeout(mountTimeout);
              if (error) {
                setSetupError("O Mercado Pago encontrou um erro ao montar os campos seguros.");
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
                setResult({
                  ok: false,
                  error: "Revise os campos. O Mercado Pago não conseguiu gerar o token do cartão.",
                });
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
                setResult({ ok: false, error: "Não foi possível falar com o backend de cobrança." });
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

        cardFormRef.current = cardForm;
        // Safari/iOS can delay onFormMounted while document/issuer metadata is fetched.
        // The CardForm instance already owns the DOM at this point, so interaction can be released.
        setFormInitialized(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const code = error instanceof Error ? error.message : "configuration_failed";
        if (code === "public_key_not_configured") {
          setSetupError("A Public Key de teste não está disponível no backend da homologação.");
        } else if (code === "sdk_timeout" || code === "sdk_load_failed") {
          setSetupError("O MercadoPago.js não carregou. Verifique a conexão e tente novamente.");
        } else if (code === "config_timeout") {
          setSetupError("A configuração do ambiente demorou demais para responder. Tente novamente.");
        } else {
          setSetupError("Não foi possível inicializar a integração segura do Mercado Pago.");
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(mountTimeout);
      cardFormRef.current?.unmount?.();
      cardFormRef.current = null;
    };
  }, [retryKey]);

  const interactive = formInitialized && !setupError;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FBF7F2] text-[#2A1634]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-40 h-[420px] w-[420px] rounded-full bg-[#E9DDED]/70 blur-3xl" />
        <div className="absolute -right-24 top-32 h-[360px] w-[360px] rounded-full bg-[#FFE0D7]/80 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 sm:py-8 lg:py-12">
        <header className="mb-8 flex items-center justify-between gap-4 sm:mb-12">
          <img
            src="/brand/comandiva-logo-horizontal.png"
            alt="Comandiva"
            className="h-9 w-auto object-contain sm:h-11"
          />
          <span className="inline-flex items-center gap-2 rounded-full border border-[#DDD0E2] bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#4B1D6D] shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-[#FF6A4D]" /> Sandbox
          </span>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:gap-12">
          <section className="pt-1 lg:sticky lg:top-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F0E7F4] px-3 py-1.5 text-sm font-semibold text-[#4B1D6D]">
              <Sparkles className="h-4 w-4" /> Homologação de billing
            </div>

            <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl">
              Cobrança recorrente, validada ponta a ponta.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#6E626F] sm:text-lg">
              Este ambiente prova tokenização, criação da assinatura e notificações sem usar dinheiro real.
            </p>

            <div className="mt-8 rounded-3xl border border-[#E7DDD6] bg-white/80 p-5 shadow-[0_22px_60px_rgba(55,31,67,0.08)] backdrop-blur sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#8B7D8F]">
                    Assinatura de homologação
                  </p>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-4xl font-semibold tracking-tight">R$ 1,00</span>
                    <span className="text-sm text-[#7A6E7D]">/ mês</span>
                  </div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#4B1D6D] text-white shadow-lg shadow-[#4B1D6D]/20">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>

              <ul className="mt-6 space-y-3.5">
                <Step>Cartão tokenizado diretamente pelo Mercado Pago</Step>
                <Step>Assinatura criada pela API de recorrência</Step>
                <Step>Webhook validado e persistido com idempotência</Step>
              </ul>
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#E7DDD6] bg-[#FFFDF9] px-4 py-3.5 text-sm text-[#665A69]">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#4B1D6D]" />
              <p>
                Número, validade e CVV ficam nos campos seguros do Mercado Pago. A Comandiva recebe somente o CardToken descartável.
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-[30px] border border-[#E8DED7] bg-white shadow-[0_28px_80px_rgba(55,31,67,0.13)]">
            <div className="border-b border-[#EEE5DE] px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9A8C9E]">
                    Cartão de teste
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                    Dados para homologação
                  </h2>
                </div>
                <div className="hidden items-center gap-2 rounded-xl bg-[#F8F2FA] px-3 py-2 text-xs font-medium text-[#5D376F] sm:flex">
                  <LockKeyhole className="h-4 w-4" /> Tokenização segura
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-7">
              {setupError ? (
                <div className="mb-5 rounded-2xl border border-[#F3C7BB] bg-[#FFF4F0] p-5">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFE0D7] text-[#C94F37]">
                      <TriangleAlert className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[#803421]">Não foi possível preparar o pagamento</h3>
                      <p className="mt-1 text-sm leading-6 text-[#8A5D53]">{setupError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRetryKey((value) => value + 1)}
                    className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4B1D6D] px-4 text-sm font-semibold text-white transition hover:bg-[#3D1759]"
                  >
                    <RefreshCw className="h-4 w-4" /> Tentar novamente
                  </button>
                </div>
              ) : null}

              <div className="relative">
                <form
                  id="form-checkout"
                  aria-busy={!interactive}
                  className={`space-y-5 transition ${!interactive ? "opacity-45" : "opacity-100"}`}
                >
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[#403544]">Número do cartão</label>
                    <FieldShell id="form-checkout__cardNumber" />
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-[#403544]">Validade</label>
                      <FieldShell id="form-checkout__expirationDate" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-[#403544]">CVV</label>
                      <FieldShell id="form-checkout__securityCode" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="form-checkout__cardholderName" className="text-sm font-semibold text-[#403544]">
                      Nome do titular
                    </label>
                    <input id="form-checkout__cardholderName" className={inputClass} defaultValue="APRO" autoComplete="cc-name" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="form-checkout__identificationType" className="text-sm font-semibold text-[#403544]">
                        Documento
                      </label>
                      <select id="form-checkout__identificationType" className={inputClass} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="form-checkout__identificationNumber" className="text-sm font-semibold text-[#403544]">
                        CPF de teste
                      </label>
                      <input id="form-checkout__identificationNumber" className={inputClass} defaultValue="12345678909" inputMode="numeric" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="form-checkout__cardholderEmail" className="text-sm font-semibold text-[#403544]">
                      E-mail do comprador de teste
                    </label>
                    <input id="form-checkout__cardholderEmail" type="email" className={inputClass} defaultValue="test@testuser.com" autoComplete="email" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="form-checkout__issuer" className="text-sm font-semibold text-[#403544]">
                        Emissor
                      </label>
                      <select id="form-checkout__issuer" className={inputClass} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="form-checkout__installments" className="text-sm font-semibold text-[#403544]">
                        Parcelas
                      </label>
                      <select id="form-checkout__installments" className={inputClass} />
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#F7F2F8] px-4 py-3.5 text-sm text-[#665A69]">
                    <strong className="font-semibold text-[#4B1D6D]">Cenário aprovado:</strong> cartão oficial de teste, titular <strong>APRO</strong> e CPF <strong>12345678909</strong>.
                  </div>

                  <progress className="hidden" value="0" />

                  <button
                    id="form-checkout__submit"
                    type="submit"
                    disabled={!formInitialized || isSubmitting}
                    className="relative z-20 flex min-h-14 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl bg-[#FF6A4D] px-5 py-4 text-base font-semibold text-white shadow-[0_14px_30px_rgba(255,106,77,0.28)] transition active:scale-[0.99] hover:-translate-y-0.5 hover:bg-[#F25C40] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Criando assinatura…</>
                    ) : !formInitialized ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Preparando pagamento…</>
                    ) : (
                      <><CreditCard className="h-4 w-4" /> Criar assinatura de teste</>
                    )}
                  </button>
                </form>

                {!formInitialized && !setupError ? (
                  <div className="pointer-events-none absolute inset-0 z-10 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[#E5D9E9] bg-[#FCF9FD]/88 px-6 text-center backdrop-blur-[2px]">
                    <Loader2 className="h-7 w-7 animate-spin text-[#4B1D6D]" />
                    <p className="mt-3 font-semibold">Preparando pagamento seguro…</p>
                    <p className="mt-1 max-w-xs text-sm leading-6 text-[#837687]">
                      Conectando os campos protegidos do Mercado Pago. Isso deve levar poucos segundos.
                    </p>
                  </div>
                ) : null}
              </div>

              {!sdkReady && formInitialized && !setupError ? (
                <div className="mt-4 rounded-xl bg-[#F8F2FA] px-4 py-3 text-xs leading-5 text-[#6C5975]">
                  Os campos seguros já estão disponíveis. O Mercado Pago ainda está concluindo a sincronização de emissor e documento em segundo plano.
                </div>
              ) : null}

              {result ? (
                result.ok ? (
                  <div className="mt-5 rounded-2xl border border-[#BFE0CA] bg-[#F1FBF4] p-5 text-[#265D39]">
                    <div className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-semibold">Assinatura criada com sucesso</p>
                        <p className="mt-1 text-sm leading-6">Status: {result.status ?? "recebido"}. ID técnico: {result.subscriptionId ?? "—"}.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-[#F3C7BB] bg-[#FFF4F0] p-5 text-[#803421]">
                    <div className="flex gap-3">
                      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold">Mercado Pago recusou a criação</p>
                        <p className="mt-1 break-words text-sm leading-6">{result.providerMessage ?? result.error ?? "Falha desconhecida."}</p>
                        {result.providerCauses?.map((cause, index) => (
                          <p key={`${cause.code ?? "cause"}-${index}`} className="mt-1 text-sm">
                            {cause.code ? `${cause.code}: ` : ""}{cause.description ?? "Erro retornado pelo provedor."}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#EEE5DE] bg-[#FFFCF8] px-5 py-4 text-xs text-[#8B7F8F] sm:px-7">
              <span>Comandiva · homologação</span>
              <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5" /> Mercado Pago Sandbox</span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
