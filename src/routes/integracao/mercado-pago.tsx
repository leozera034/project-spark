import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

const BILLING_ENDPOINT =
  "https://ypgteuxzgqmkkkpvibhi.supabase.co/functions/v1/comandiva-billing?action=create_pending_test_subscription";

interface CheckoutResult {
  ok: boolean;
  subscriptionId?: string | null;
  status?: string | null;
  initPoint?: string;
  error?: string;
  providerMessage?: string | null;
  providerCauses?: Array<{ code?: string | number; description?: string }>;
}

export const Route = createFileRoute("/integracao/mercado-pago")({
  head: () => ({
    meta: [
      { title: "Homologação Mercado Pago | Comandiva" },
      {
        name: "description",
        content: "Ambiente isolado para homologação da cobrança recorrente da Comandiva.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MercadoPagoIntegrationTestPage,
});

function providerError(result: CheckoutResult) {
  return (
    result.providerCauses
      ?.map((cause) =>
        `${cause.code ? `${cause.code}: ` : ""}${cause.description ?? ""}`.trim(),
      )
      .filter(Boolean)
      .join(" · ") ||
    result.providerMessage ||
    result.error ||
    "O Mercado Pago não conseguiu iniciar o checkout."
  );
}

function MercadoPagoIntegrationTestPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const returned =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("retorno") === "1";

  async function startCheckout() {
    if (loading) return;
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(BILLING_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json().catch(() => ({}))) as CheckoutResult;
      setResult(payload);

      if (response.ok && payload.ok && payload.initPoint?.startsWith("https://")) {
        window.location.assign(payload.initPoint);
        return;
      }
    } catch {
      setResult({
        ok: false,
        error: "Não foi possível falar com o backend de cobrança da Comandiva.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FBF7F2] px-4 py-6 text-[#2A1634] sm:py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <img
            src="/brand/comandiva-logo-horizontal.png"
            alt="Comandiva"
            className="h-10 w-auto object-contain"
          />
          <span className="inline-flex items-center gap-2 rounded-full border border-[#DED0E3] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#4B1D6D] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#FF6A4D]" /> Sandbox
          </span>
        </header>

        <div className="grid gap-7 lg:grid-cols-[0.9fr_1.1fr]">
          <section>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F0E7F4] px-3 py-1.5 text-sm font-semibold text-[#4B1D6D]">
              <ShieldCheck className="h-4 w-4" /> Homologação segura
            </div>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.035em] sm:text-5xl">
              Vamos deixar o Mercado Pago cuidar do pagamento.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#6E626F] sm:text-lg">
              A Comandiva cria uma assinatura pendente de teste e redireciona você para o checkout
              hospedado pelo Mercado Pago. Nenhum formulário de cartão roda dentro do nosso site.
            </p>

            <div className="mt-7 rounded-3xl border border-[#E7DDD6] bg-white p-5 shadow-[0_18px_50px_rgba(55,31,67,0.08)] sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#978A9A]">
                Assinatura de homologação
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight">R$ 1,00</span>
                <span className="text-sm text-[#7A6E7D]">/ mês</span>
              </div>
              <div className="mt-5 space-y-3 text-sm leading-6 text-[#665A69]">
                <p className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#4B1D6D]" />
                  Assinatura criada como <strong>pending</strong>, sem cartão no backend.
                </p>
                <p className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#4B1D6D]" />
                  Pagamento concluído no domínio oficial do Mercado Pago.
                </p>
                <p className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#4B1D6D]" />
                  Webhook continua responsável por sincronizar o status com a Comandiva.
                </p>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[30px] border border-[#E8DED7] bg-white shadow-[0_28px_80px_rgba(55,31,67,0.13)]">
            <div className="border-b border-[#EEE5DE] px-5 py-6 sm:px-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#978A9A]">
                Checkout hospedado
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                Um botão. Sem gambiarra no Safari.
              </h2>
            </div>

            <div className="p-5 sm:p-7">
              {returned ? (
                <div className="mb-5 rounded-2xl border border-[#BFE0CA] bg-[#F1FBF4] p-5 text-[#265D39]">
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-semibold">Você voltou do Mercado Pago</p>
                      <p className="mt-1 text-sm leading-6">
                        O retorno funcionou. Agora o status definitivo deve chegar pelo webhook.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-3xl bg-[#F8F2FA] p-5 sm:p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4B1D6D] text-white shadow-lg shadow-[#4B1D6D]/20">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold">Teste sem dinheiro real</h3>
                <p className="mt-2 text-sm leading-6 text-[#6D6071]">
                  Ao continuar, o backend cria uma assinatura de R$1 em ambiente de teste e abre o
                  link oficial retornado pela API do Mercado Pago.
                </p>
              </div>

              {result && !result.ok ? (
                <div className="mt-5 rounded-2xl border border-[#F1C9C0] bg-[#FFF5F2] p-5 text-[#803421]">
                  <div className="flex gap-3">
                    <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold">Não foi possível abrir o checkout</p>
                      <p className="mt-1 break-words text-sm leading-6">{providerError(result)}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={startCheckout}
                disabled={loading}
                className="mt-6 flex min-h-14 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl bg-[#FF6A4D] px-5 py-4 text-base font-semibold text-white shadow-[0_14px_30px_rgba(255,106,77,0.28)] transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Criando checkout…
                  </>
                ) : (
                  <>
                    Abrir checkout do Mercado Pago <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>

              {result?.ok && result.initPoint ? (
                <a
                  href={result.initPoint}
                  className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#DED0E3] px-4 text-sm font-semibold text-[#4B1D6D]"
                >
                  Abrir link manualmente <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}

              <p className="mt-5 text-center text-xs leading-5 text-[#938797]">
                Ambiente de homologação. Nenhum plano comercial é criado por esta tela.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
