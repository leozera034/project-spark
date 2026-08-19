import { createFileRoute } from "@tanstack/react-router";
import { Boxes, CheckCircle2, CircleDollarSign, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AddonAvailability, AddonBillingInterval, PlatformAddonOffer, PlatformAddonPrice } from "@/lib/platform-addons.functions";
import { usePlatformAddonOffers, usePlatformAddonPricingActions } from "@/store/platform/platform-addons.queries";
import { usePlatformBillingProviderReadiness } from "@/store/platform/platform-billing-readiness.queries";

export const Route = createFileRoute("/admin/modulos")({
  head: () => ({ meta: [{ title: "Módulos e preços | Comandiva Admin" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: PlatformAddonPricingPage,
});

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const AVAILABILITY: Array<{ value: AddonAvailability; label: string }> = [
  { value: "planned", label: "Planejado" }, { value: "beta", label: "Beta" }, { value: "available", label: "Disponível" }, { value: "retired", label: "Retirado" },
];

function PlatformAddonPricingPage() {
  const offers = usePlatformAddonOffers();
  const actions = usePlatformAddonPricingActions();
  const readiness = usePlatformBillingProviderReadiness();
  const items = offers.data?.items ?? [];
  const providerReady = items.filter((item) => item.monthly_price?.provider_ready || item.annual_price?.provider_ready).length;

  return <main className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#4B1D6D] p-6 text-white shadow-e2 sm:p-8">
      <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-[#FF6A4D]/20 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[.12em]"><CircleDollarSign className="size-3.5"/> Monetização</div><h1 className="mt-4 font-display text-3xl font-black sm:text-4xl">Módulos e preços</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">Catálogo, preços e assinaturas do Comandiva processados exclusivamente pela Stripe.</p></div><Badge className="w-fit border-white/15 bg-white/10 text-white hover:bg-white/10">Provider: Stripe</Badge></div>
    </section>

    <section className="grid gap-3 sm:grid-cols-3"><Summary icon={Boxes} label="Módulos" value={items.length}/><Summary icon={ShieldCheck} label="Preços Stripe prontos" value={providerReady}/><Summary icon={CheckCircle2} label="Stripe" value={readiness.data?.ready_for_billing ? "Operacional" : "Pendente"}/></section>

    <Card className={readiness.data?.ready_for_billing ? "border-success/25" : "border-amber-500/25"}><CardHeader><div className="flex items-start justify-between gap-4"><div><CardTitle>Readiness Stripe</CardTitle><CardDescription className="mt-2">Secret key, publishable key, webhook e conectividade são verificados pelo backend.</CardDescription></div><Button size="sm" variant="outline" disabled={readiness.isFetching} onClick={() => void readiness.refetch()}>{readiness.isFetching ? <Loader2 className="size-4 animate-spin"/> : <RefreshCw className="size-4"/>} Atualizar</Button></div></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-4"><Signal label="API" ok={readiness.data?.provider_connected===true}/><Signal label="Publishable key" ok={readiness.data?.publishable_key_configured===true}/><Signal label="Webhook" ok={readiness.data?.webhook_secret_configured===true}/><Signal label="Connect" ok={readiness.data?.connect_enabled===true}/></div>{readiness.data?.last_error ? <p className="mt-3 text-xs text-destructive">Último erro: {readiness.data.last_error}</p> : null}</CardContent></Card>

    {offers.isLoading ? <div className="rounded-2xl border p-8 text-sm text-muted-foreground">Carregando catálogo…</div> : offers.isError ? <div className="rounded-2xl border border-destructive/20 p-6 text-sm text-destructive">Não foi possível carregar o catálogo.</div> : <section className="space-y-4">{items.map((offer) => <AddonCard key={offer.id} offer={offer} actions={actions}/>)}</section>}
  </main>;
}

function Summary({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: string|number }) { return <Card><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-bold uppercase tracking-[.1em] text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div><span className="grid size-10 place-items-center rounded-xl bg-brand-soft"><Icon className="size-5"/></span></CardContent></Card>; }
function Signal({label,ok}:{label:string;ok:boolean}){return <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-bold">{ok?"OK":"Pendente"}</p></div>}

function AddonCard({ offer, actions }: { offer: PlatformAddonOffer; actions: ReturnType<typeof usePlatformAddonPricingActions> }) {
  return <Card><CardHeader><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><CardTitle>{offer.name}</CardTitle><Badge variant="outline">{offer.code}</Badge><Badge variant="secondary">{offer.billing_model}</Badge></div><CardDescription className="mt-2">{offer.description}</CardDescription></div><div className="flex items-center gap-2"><select className="h-10 rounded-xl border border-input bg-surface px-3 text-sm" value={offer.availability_status} onChange={(e)=>void actions.updateCatalog.mutateAsync({addonId:offer.id,availabilityStatus:e.target.value as AddonAvailability,isActive:offer.is_active}).catch(()=>toast.error("Falha ao atualizar catálogo"))}>{AVAILABILITY.map(a=><option key={a.value} value={a.value}>{a.label}</option>)}</select><label className="flex h-10 items-center gap-2 rounded-xl border px-3 text-sm"><input type="checkbox" checked={offer.is_active} onChange={(e)=>void actions.updateCatalog.mutateAsync({addonId:offer.id,availabilityStatus:offer.availability_status,isActive:e.target.checked}).catch(()=>toast.error("Falha ao atualizar catálogo"))}/> Ativo</label></div></div></CardHeader><CardContent className="grid gap-4 lg:grid-cols-2"><PriceEditor offer={offer} interval="monthly" price={offer.monthly_price} actions={actions}/><PriceEditor offer={offer} interval="annual" price={offer.annual_price} actions={actions}/></CardContent></Card>;
}

function PriceEditor({ offer, interval, price, actions }: { offer:PlatformAddonOffer; interval:AddonBillingInterval; price:PlatformAddonPrice|null; actions:ReturnType<typeof usePlatformAddonPricingActions> }) {
  const [amount,setAmount]=useState(price ? (price.amount_cents/100).toFixed(2).replace(".",",") : "");
  const [trial,setTrial]=useState(String(price?.trial_days ?? 0));
  useEffect(()=>{setAmount(price ? (price.amount_cents/100).toFixed(2).replace(".",",") : "");setTrial(String(price?.trial_days ?? 0));},[price?.amount_cents,price?.trial_days]);
  const cents=Math.round(Number(amount.replace(",","."))*100);
  async function save(){if(!Number.isFinite(cents)||cents<0)return toast.error("Valor inválido");try{await actions.upsertPrice.mutateAsync({addonId:offer.id,billingInterval:interval,amountCents:cents,trialDays:Number(trial)||0,isActive:true});toast.success("Preço salvo") }catch{toast.error("Falha ao salvar preço")}}
  async function sync(){if(!price?.id)return toast.error("Salve o preço antes de sincronizar");try{await actions.syncProvider.mutateAsync({addonPriceId:price.id});toast.success("Preço sincronizado com a Stripe") }catch{toast.error("Falha ao sincronizar com a Stripe")}}
  return <div className="rounded-2xl border p-4"><div className="flex items-center justify-between"><p className="font-bold">{interval==="monthly"?"Mensal":"Anual"}</p><Badge variant={price?.provider_ready?"default":"outline"}>{price?.provider_ready?"Stripe ready":"Pendente"}</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><Label>Preço (R$)</Label><Input className="mt-1" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></div><div><Label>Trial (dias)</Label><Input className="mt-1" inputMode="numeric" value={trial} onChange={e=>setTrial(e.target.value)}/></div></div><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={()=>void save()}>Salvar preço</Button><Button size="sm" variant="outline" disabled={!price?.id||actions.syncProvider.isPending} onClick={()=>void sync()}>{actions.syncProvider.isPending?<Loader2 className="size-4 animate-spin"/>:null} Sincronizar Stripe</Button></div>{price ? <p className="mt-3 text-xs text-muted-foreground">Atual: {brl.format(price.amount_cents/100)} · status provider: {price.provider_status ?? "não sincronizado"}</p>:null}</div>;
}
