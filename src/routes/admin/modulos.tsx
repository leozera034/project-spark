import { createFileRoute } from "@tanstack/react-router";
import { Boxes, CircleDollarSign, Loader2, RefreshCw, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type AddonAvailability,
  type AddonBillingInterval,
  type PlatformAddonOffer,
  type PlatformAddonPrice,
} from "@/lib/platform-addons.functions";
import {
  usePlatformAddonOffers,
  usePlatformAddonPricingActions,
} from "@/store/platform/platform-addons.queries";

export const Route = createFileRoute("/admin/modulos")({
  head: () => ({
    meta: [
      { title: "Módulos e preços | Comandiva Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PlatformAddonPricingPage,
});

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const AVAILABILITY: Array<{ value: AddonAvailability; label: string }> = [
  { value: "planned", label: "Planejado" },
  { value: "beta", label: "Beta" },
  { value: "available", label: "Disponível" },
  { value: "retired", label: "Retirado" },
];

function providerSyncErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "FORBIDDEN") return "Somente um administrador da plataforma pode homologar preços no provedor.";
  if (code === "MERCADO_PAGO_TEST_NOT_CONFIGURED") return "O token TEST do Mercado Pago ainda não está configurado.";
  if (code === "MERCADO_PAGO_UNREACHABLE") return "O Mercado Pago não respondeu agora. O preço local não foi alterado.";
  if (code === "MERCADO_PAGO_PLAN_CREATE_FAILED") return "O Mercado Pago recusou a criação do plano de teste.";
  if (code === "MERCADO_PAGO_PLAN_UPDATE_FAILED") return "Não foi possível atualizar o plano de teste no Mercado Pago.";
  if (code === "MERCADO_PAGO_PLAN_VALIDATION_FAILED") return "O plano retornado pelo Mercado Pago não bate com o preço canônico do Comandiva.";
  if (code === "RATE_LIMITED") return "Muitas sincronizações em pouco tempo. Aguarde antes de tentar novamente.";
  return "Não foi possível homologar este preço no Mercado Pago TEST.";
}

function PlatformAddonPricingPage() {
  const offers = usePlatformAddonOffers();
  const actions = usePlatformAddonPricingActions();

  const items = offers.data?.items ?? [];
  const available = items.filter((item) => item.availability_status === "available").length;
  const priced = items.filter((item) => item.monthly_price || item.annual_price).length;
  const providerReady = items.filter(
    (item) => item.monthly_price?.provider_ready || item.annual_price?.provider_ready,
  ).length;

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#4B1D6D] p-6 text-white shadow-e2 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-[#FF6A4D]/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[.12em]">
              <CircleDollarSign className="size-3.5 text-[#FFB4A2]" /> Monetização
            </div>
            <h1 className="mt-4 font-display text-3xl font-black tracking-tight text-white sm:text-4xl">
              Módulos e preços
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
              Publique a oferta comercial e homologue o preço no Mercado Pago TEST. Checkout e entitlement continuam bloqueados até todas as validações do backend passarem.
            </p>
          </div>
          <Badge className="w-fit border-white/15 bg-white/10 text-white hover:bg-white/10">
            Provider: Mercado Pago TEST
          </Badge>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={Boxes} label="Módulos" value={items.length} />
        <SummaryCard icon={SlidersHorizontal} label="Com preço" value={priced} />
        <SummaryCard icon={ShieldCheck} label="Provider ready" value={providerReady} detail={`${available} disponíveis`} />
      </section>

      <Card className="border-amber-500/20 bg-amber-500/[.04]">
        <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
          Publicar preço aqui <strong className="text-foreground">não cria cobrança</strong>. “Sincronizar Mercado Pago TEST” cria ou atualiza somente o plano de homologação no ambiente de teste. A loja só recebe checkout quando o preflight validar preço, provider e estado financeiro.
        </CardContent>
      </Card>

      {offers.isLoading ? (
        <div className="rounded-2xl border border-border p-8 text-sm text-muted-foreground">Carregando catálogo…</div>
      ) : offers.isError ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
          Não foi possível carregar o catálogo. Confirme que a conta possui papel de administrador da plataforma.
        </div>
      ) : (
        <section className="space-y-4">
          {items.map((offer) => (
            <AddonOfferCard
              key={offer.id}
              offer={offer}
              onCatalogChange={async (availabilityStatus, isActive) => {
                try {
                  await actions.updateCatalog.mutateAsync({ addonId: offer.id, availabilityStatus, isActive });
                  toast.success(`${offer.name}: catálogo atualizado.`);
                } catch {
                  toast.error(`Não foi possível atualizar ${offer.name}.`);
                }
              }}
              savingCatalog={actions.updateCatalog.isPending}
            />
          ))}
        </section>
      )}
    </main>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Boxes;
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.1em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-black">{value}</p>
          {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
        </div>
        <span className="grid size-10 place-items-center rounded-xl border border-brand/15 bg-brand-soft">
          <Icon className="size-5 text-brand-soft-foreground" />
        </span>
      </CardContent>
    </Card>
  );
}

function AddonOfferCard({
  offer,
  onCatalogChange,
  savingCatalog,
}: {
  offer: PlatformAddonOffer;
  onCatalogChange: (status: AddonAvailability, isActive: boolean) => Promise<void>;
  savingCatalog: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">{offer.name}</CardTitle>
              <Badge variant="outline">{offer.code}</Badge>
              <Badge variant="secondary">{offer.billing_model}</Badge>
            </div>
            <CardDescription className="mt-2 max-w-3xl">{offer.description}</CardDescription>
            <p className="mt-2 text-xs text-muted-foreground">
              {offer.active_subscriptions} assinatura(s) ativa(s)
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor={`availability-${offer.id}`}>Disponibilidade</Label>
              <select
                id={`availability-${offer.id}`}
                className="mt-2 h-10 rounded-xl border border-input bg-surface px-3 text-sm"
                value={offer.availability_status}
                disabled={savingCatalog}
                onChange={(event) => void onCatalogChange(event.target.value as AddonAvailability, offer.is_active)}
              >
                {AVAILABILITY.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-input px-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={offer.is_active}
                disabled={savingCatalog}
                onChange={(event) => void onCatalogChange(offer.availability_status, event.target.checked)}
              />
              Ativo no catálogo
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-4 xl:grid-cols-2">
        <PriceEditor
          key={`${offer.id}-monthly-${offer.monthly_price?.id ?? "new"}-${offer.monthly_price?.amount_cents ?? 0}-${offer.monthly_price?.provider_status ?? "none"}`}
          offer={offer}
          interval="monthly"
          price={offer.monthly_price}
        />
        <PriceEditor
          key={`${offer.id}-annual-${offer.annual_price?.id ?? "new"}-${offer.annual_price?.amount_cents ?? 0}-${offer.annual_price?.provider_status ?? "none"}`}
          offer={offer}
          interval="annual"
          price={offer.annual_price}
        />
      </CardContent>
    </Card>
  );
}

function PriceEditor({
  offer,
  interval,
  price,
}: {
  offer: PlatformAddonOffer;
  interval: AddonBillingInterval;
  price: PlatformAddonPrice | null;
}) {
  const actions = usePlatformAddonPricingActions();
  const [amount, setAmount] = useState(price ? (price.amount_cents / 100).toFixed(2).replace(".", ",") : "");
  const [trialDays, setTrialDays] = useState(String(price?.trial_days ?? 0));
  const [metric, setMetric] = useState(price?.metering_metric_code ?? (offer.billing_model === "flat" ? "" : `${offer.code}.units`));
  const [included, setIncluded] = useState(price?.included_units == null ? "" : String(price.included_units));
  const [hardLimit, setHardLimit] = useState(price?.hard_limit_units == null ? "" : String(price.hard_limit_units));
  const [overage, setOverage] = useState(price?.overage_unit_amount_micros == null ? "" : String(price.overage_unit_amount_micros / 1_000_000).replace(".", ","));
  const [isActive, setIsActive] = useState(price?.is_active ?? true);

  const metered = offer.billing_model !== "flat";
  const amountNumber = Number(amount.replace(",", "."));
  const amountCents = Number.isFinite(amountNumber) ? Math.round(amountNumber * 100) : -1;

  async function save() {
    if (amountCents < 0) {
      toast.error("Informe um preço válido.");
      return;
    }
    try {
      await actions.upsertPrice.mutateAsync({
        addonId: offer.id,
        billingInterval: interval,
        amountCents,
        trialDays: Number(trialDays || 0),
        meteringMetricCode: metered ? metric.trim() || null : null,
        includedUnits: metered && included !== "" ? Number(included) : null,
        hardLimitUnits: metered && hardLimit !== "" ? Number(hardLimit) : null,
        overageUnitAmountMicros: metered && overage !== "" ? Math.round(Number(overage.replace(",", ".")) * 1_000_000) : null,
        isActive,
      });
      toast.success(`${offer.name}: preço ${interval === "monthly" ? "mensal" : "anual"} salvo.`);
    } catch {
      toast.error(`Não foi possível salvar o preço de ${offer.name}.`);
    }
  }

  async function syncProvider() {
    if (!price) return;
    try {
      const result = await actions.syncProvider.mutateAsync({ addonPriceId: price.id });
      toast.success(
        result.created
          ? `${offer.name}: plano TEST criado e homologado no Mercado Pago.`
          : `${offer.name}: preço TEST sincronizado com o Mercado Pago.`,
      );
    } catch (error) {
      toast.error(providerSyncErrorMessage(error));
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-muted/30 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold">{interval === "monthly" ? "Mensal" : "Anual"}</p>
          <p className="text-xs text-muted-foreground">
            {price ? `${brl.format(price.amount_cents / 100)} publicado localmente` : "Sem preço publicado"}
          </p>
        </div>
        <Badge variant={price?.provider_ready ? "default" : "outline"}>
          {price?.provider_ready
            ? "Mercado Pago TEST pronto"
            : price?.provider_status === "stale"
              ? "Provider desatualizado"
              : "Provider pendente"}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Preço (R$)">
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="129,00" />
        </Field>
        <Field label="Trial (dias)">
          <Input type="number" min={0} max={365} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
        </Field>

        {metered ? (
          <>
            <Field label="Métrica" wide>
              <Input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder={`${offer.code}.units`} />
            </Field>
            <Field label="Franquia incluída">
              <Input type="number" min={0} value={included} onChange={(e) => setIncluded(e.target.value)} placeholder="1000" />
            </Field>
            <Field label="Hard limit">
              <Input type="number" min={0} value={hardLimit} onChange={(e) => setHardLimit(e.target.value)} placeholder="1500" />
            </Field>
            <Field label="Excedente / unidade (R$)" wide>
              <Input inputMode="decimal" value={overage} onChange={(e) => setOverage(e.target.value)} placeholder="0,10" />
            </Field>
          </>
        ) : null}
      </div>

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Preço ativo
          </label>
          <Button onClick={() => void save()} disabled={actions.upsertPrice.isPending}>
            {actions.upsertPrice.isPending ? "Salvando…" : "Salvar preço"}
          </Button>
        </div>

        {price ? (
          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-foreground">Homologação Mercado Pago TEST</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Usa o último preço salvo no Comandiva e valida valor, moeda, intervalo e trial no provider.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={price.provider_ready ? "outline" : "default"}
              disabled={actions.syncProvider.isPending}
              onClick={() => void syncProvider()}
            >
              {actions.syncProvider.isPending ? (
                <><Loader2 className="size-3.5 animate-spin" /> Sincronizando…</>
              ) : (
                <><RefreshCw className="size-3.5" /> {price.provider_ready ? "Ressincronizar TEST" : "Sincronizar TEST"}</>
              )}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <Label>{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
