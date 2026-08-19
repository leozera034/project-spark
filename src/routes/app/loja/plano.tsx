import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarDays, CreditCard, FileText, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/auth/useAuth";
import { PlanCatalog, type BillingInterval } from "@/components/billing/PlanCatalog";
import { StripeConnectStatus } from "@/components/billing/StripeConnectStatus";
import { WhatsAppAddonStatus } from "@/components/billing/WhatsAppAddonStatus";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listPublicPlans } from "@/lib/marketing.functions";
import {
  cancelStorePlanAtPeriodEnd,
  changeStorePlan,
  createStoreBillingPortal,
  createStorePlanCheckout,
  getMyStorePlanBillingDetail,
  resumeStorePlan,
  type StorePlanBillingDetail,
} from "@/lib/store-plan-billing.functions";
import type { StoreBillingAccess, StoreBillingStage } from "@/lib/store-billing.functions";
import { useStoreBillingAccess } from "@/store/billing/store-billing.queries";
import { useStripeConnectStatus, useStripeRuntimeReadiness } from "@/store/billing/stripe-connect.queries";
import { useWhatsAppAddonProvisioning } from "@/store/billing/whatsapp-addon.queries";

// @ts-ignore -- TanStack route tree is regenerated during build.
export const Route = createFileRoute("/app/loja/plano")({
  loader: () => listPublicPlans(),
  head: () => ({ meta: [{ title: "Plano e cobrança | Comandiva" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: StorePlanPage,
});

type StageCopy = { label: string; description: string; variant: "success" | "warning" | "danger" | "outline" | "brand" };
const STAGE_COPY: Record<StoreBillingStage, StageCopy> = {
  billing_unconfigured:{label:"Configuração pendente",description:"A configuração comercial desta loja ainda precisa ser concluída.",variant:"warning"},
  complimentary:{label:"Cortesia ativa",description:"Sua loja está usando uma cortesia administrativa da Comandiva.",variant:"brand"},
  free:{label:"Plano gratuito",description:"A loja está no plano gratuito, sem assinatura Stripe recorrente.",variant:"outline"},
  trial:{label:"Período de teste",description:"O teste do plano pago está ativo até a data exibida abaixo.",variant:"brand"},
  full:{label:"Assinatura ativa",description:"A assinatura está regular e os recursos do plano permanecem liberados.",variant:"success"},
  notice:{label:"Pagamento pendente",description:"Existe uma cobrança pendente. Atualize a forma de pagamento para evitar restrições.",variant:"warning"},
  restricted_growth:{label:"Crescimento restrito",description:"Recursos de crescimento estão pausados até a regularização da cobrança.",variant:"warning"},
  restricted_writes:{label:"Alterações restritas",description:"Algumas alterações administrativas estão pausadas enquanto a cobrança permanece pendente.",variant:"warning"},
  suspended_orders:{label:"Novos pedidos pausados",description:"Novos pedidos estão temporariamente suspensos; os dados da loja continuam preservados.",variant:"danger"},
  trial_expired:{label:"Teste encerrado",description:"O período de teste terminou e a conta segue a política de fallback configurada.",variant:"outline"},
};

type PurchaseIntent = { planCode: "essencial"|"profissional"|"avancado"; interval: BillingInterval } | null;
function queryIntent(): { purchase: PurchaseIntent; stripe: string | null } {
  if (typeof window === "undefined") return { purchase: null, stripe: null };
  const q = new URLSearchParams(window.location.search);
  const raw = q.get("purchase"), interval: BillingInterval = q.get("interval") === "annual" ? "annual" : "monthly";
  const purchase = raw && ["essencial","profissional","avancado"].includes(raw) ? { planCode: raw as PurchaseIntent extends infer _ ? "essencial"|"profissional"|"avancado" : never, interval } : null;
  return { purchase, stripe: q.get("stripe") };
}
function formatDate(value:string|null|undefined){if(!value)return null;const d=new Date(value);if(!Number.isFinite(d.getTime()))return null;return new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium"}).format(d)}
function formatMoney(cents:number|null|undefined,currency="BRL"){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:currency||"BRL"}).format((cents??0)/100)}
function providerLabel(status:string|null|undefined){switch(status){case"active":return"Ativo";case"trialing":return"Em teste";case"past_due":return"Pagamento em atraso";case"unpaid":return"Não pago";case"incomplete":return"Pagamento pendente";case"incomplete_expired":return"Pagamento expirado";case"canceled":return"Cancelado";case"paused":return"Pausado";default:return status?status:"Sem assinatura Stripe"}}
function idempotency(storeId:string,planCode:string,interval:string){const key=`comandiva:plan-checkout:${storeId}:${planCode}:${interval}`;if(typeof sessionStorage==="undefined")return `${key}:${crypto.randomUUID()}`;let value=sessionStorage.getItem(key);if(!value){value=crypto.randomUUID();sessionStorage.setItem(key,value)}return `${key}:${value}`.slice(0,160)}
function clearIntentUrl(){if(typeof window==="undefined")return;const u=new URL(window.location.href);u.searchParams.delete("purchase");u.searchParams.delete("interval");u.searchParams.delete("stripe");u.searchParams.delete("session_id");window.history.replaceState({},"",`${u.pathname}${u.search}${u.hash}`)}
function planName(access:StoreBillingAccess,plans:Awaited<ReturnType<typeof listPublicPlans>>){if(!access.plan_code)return"Não configurado";return plans.find(p=>p.code===access.plan_code)?.name??access.plan_code}

function StorePlanPage(){
  const plans=Route.useLoaderData();const {authContext}=useAuth();const storeId=authContext?.store_ids?.[0]??null;
  const billingQuery=useStoreBillingAccess(storeId),whatsappQuery=useWhatsAppAddonProvisioning(storeId),stripeStatusQuery=useStripeConnectStatus(storeId),stripeReadinessQuery=useStripeRuntimeReadiness();
  const getDetail=useServerFn(getMyStorePlanBillingDetail),createCheckout=useServerFn(createStorePlanCheckout),createPortal=useServerFn(createStoreBillingPortal),changePlan=useServerFn(changeStorePlan),cancelPlan=useServerFn(cancelStorePlanAtPeriodEnd),resumePlan=useServerFn(resumeStorePlan);
  const [detail,setDetail]=useState<StorePlanBillingDetail|null>(null),[detailLoading,setDetailLoading]=useState(false),[detailError,setDetailError]=useState<string|null>(null),[busyPlan,setBusyPlan]=useState<string|null>(null),[actionBusy,setActionBusy]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null),[confirming,setConfirming]=useState(false);
  const query=useMemo(queryIntent,[]),handledIntent=useRef(false);

  const loadDetail=useCallback(async()=>{if(!storeId)return null;setDetailLoading(true);try{const d=await getDetail({data:{storeId}});setDetail(d);setDetailError(null);return d}catch{setDetailError("Não foi possível carregar os detalhes de cobrança.");return null}finally{setDetailLoading(false)}},[getDetail,storeId]);
  useEffect(()=>{void loadDetail()},[loadDetail]);

  const refreshAll=useCallback(async()=>{await Promise.all([loadDetail(),billingQuery.refetch(),stripeStatusQuery.refetch(),stripeReadinessQuery.refetch()])},[loadDetail,billingQuery,stripeStatusQuery,stripeReadinessQuery]);

  const startCheckout=useCallback(async(planCode:"essencial"|"profissional"|"avancado",interval:BillingInterval)=>{if(!storeId)return;setBusyPlan(planCode);setNotice(null);try{const r=await createCheckout({data:{storeId,planCode,billingInterval:interval,idempotencyKey:idempotency(storeId,planCode,interval)}});window.location.assign(r.checkoutUrl)}catch(e){setNotice(e instanceof Error?`Não foi possível abrir o checkout (${e.message}).`:"Não foi possível abrir o checkout.");setBusyPlan(null)}},[createCheckout,storeId]);

  const selectPlan=useCallback(async(planCode:string,interval:BillingInterval)=>{if(!storeId||!detail)return;setNotice(null);if(planCode==="gratis"){if(detail.subscription.provider_status&&!["canceled","incomplete_expired"].includes(detail.subscription.provider_status)){setActionBusy("cancel");try{const r=await cancelPlan({data:{storeId}});setNotice(`Cancelamento agendado. Seu plano continua ativo${r.effectiveAt?` até ${formatDate(r.effectiveAt)}`:" até o fim do período atual"}.`);await refreshAll()}catch(e){setNotice(e instanceof Error?`Não foi possível agendar o cancelamento (${e.message}).`:"Não foi possível agendar o cancelamento.")}finally{setActionBusy(null)}}return}
    const paid=planCode as "essencial"|"profissional"|"avancado";if(!detail.subscription.provider_status||["canceled","incomplete_expired"].includes(detail.subscription.provider_status)||detail.plan.code==="gratis"){await startCheckout(paid,interval);return}
    setBusyPlan(paid);try{const r=await changePlan({data:{storeId,planCode:paid,billingInterval:interval}});setNotice(r.action==="downgrade"?`Mudança agendada para ${formatDate(r.effectiveAt)??"o fim do período atual"}.`:"Upgrade solicitado à Stripe. A liberação acompanha a confirmação financeira.");await refreshAll()}catch(e){setNotice(e instanceof Error?`Não foi possível alterar o plano (${e.message}).`:"Não foi possível alterar o plano.")}finally{setBusyPlan(null)}
  },[storeId,detail,cancelPlan,changePlan,refreshAll,startCheckout]);

  useEffect(()=>{if(!storeId||!detail||handledIntent.current)return;handledIntent.current=true;
    if(query.stripe==="cancelled"){setNotice("Checkout cancelado. Nenhum plano pago foi ativado.");clearIntentUrl();return}
    if(query.stripe==="success"){
      setConfirming(true);let stopped=false;let tries=0;const run=async()=>{while(!stopped&&tries<12){tries++;const d=await loadDetail();const status=d?.subscription.provider_status;if(status&&["active","trialing","past_due","unpaid"].includes(status)){setConfirming(false);setNotice(status==="active"||status==="trialing"?"Assinatura confirmada pela Stripe.":"A assinatura foi localizada, mas existe uma pendência de cobrança.");clearIntentUrl();await billingQuery.refetch();return}await new Promise(r=>setTimeout(r,2500))}if(!stopped){setConfirming(false);setNotice("O pagamento foi enviado à Stripe e ainda está sendo conciliado. Esta tela continuará refletindo somente o estado confirmado pelo backend.")}};void run();return()=>{stopped=true}}
    if(query.purchase){const same=detail.plan.code===query.purchase.planCode&&["active","trialing"].includes(detail.subscription.provider_status??"");if(same){setNotice("Esse plano já está ativo nesta loja.");clearIntentUrl();return}void selectPlan(query.purchase.planCode,query.purchase.interval)}
  },[storeId,detail,query.stripe,query.purchase,loadDetail,billingQuery,selectPlan]);

  if(!storeId)return <div className="mx-auto max-w-4xl px-4 py-8"><ErrorState kind="unexpected" title="Nenhuma loja vinculada" description="Sua conta precisa estar vinculada a uma loja antes de consultar cobrança."/></div>;
  if(billingQuery.isLoading&&!detail)return <div className="mx-auto max-w-7xl px-4 py-8"><div className="h-52 animate-pulse rounded-[28px] border bg-muted/55"/></div>;
  if(billingQuery.error||!billingQuery.data)return <div className="mx-auto max-w-4xl px-4 py-8"><ErrorState kind="network" title="Não foi possível consultar sua assinatura" description="Nenhuma informação comercial foi alterada." onRetry={()=>void refreshAll()}/></div>;
  const access=billingQuery.data,stage=STAGE_COPY[access.stage],price=detail?.price,subscription=detail?.subscription;
  const nextDate=formatDate(subscription?.current_period_end),trialEnd=formatDate(subscription?.trial_ends_at),graceEnd=formatDate(subscription?.grace_until);
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
    <section className="relative overflow-hidden rounded-[28px] bg-[#4B1D6D] p-6 text-white shadow-e2 lg:p-8"><div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-[#FF6A4D]/20 blur-3xl"/><div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-extrabold"><CreditCard className="size-3.5"/> Plano e cobrança</span><h1 className="mt-5 font-display text-4xl font-black tracking-[-.045em]">{planName(access,plans)}</h1><p className="mt-2 text-white/70">Assinatura, cobranças, faturas e alterações do plano em um único lugar.</p></div><div className="flex flex-wrap items-center gap-2"><Badge variant={stage.variant}>{stage.label}</Badge><Button variant="secondary" disabled={actionBusy==="portal"||!detail?.subscription.provider_status} onClick={async()=>{setActionBusy("portal");try{const r=await createPortal({data:{storeId}});window.location.assign(r.url)}catch(e){setNotice(e instanceof Error?`Não foi possível abrir a gestão de pagamento (${e.message}).`:"Não foi possível abrir a gestão de pagamento.")}finally{setActionBusy(null)}}}>Gerenciar pagamento</Button></div></div></section>

    {confirming?<div className="mt-5 flex items-center gap-3 rounded-2xl border border-brand/20 bg-brand-soft p-4 text-sm font-semibold"><RefreshCw className="size-5 animate-spin"/> Confirmando sua assinatura com o backend e a Stripe…</div>:null}
    {notice?<div className="mt-5 rounded-2xl border border-border bg-card p-4 text-sm font-semibold">{notice}</div>:null}
    {detailError?<div className="mt-5 rounded-2xl border border-danger/20 bg-danger-soft p-4 text-sm text-danger">{detailError}</div>:null}

    <section className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
      <article className="panel p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-xl bg-brand-soft"><ShieldCheck className="size-5 text-brand"/></span><div><p className="text-xs font-extrabold uppercase tracking-[.12em] text-muted-foreground">Sua assinatura</p><h2 className="mt-1 font-display text-xl font-black">{stage.label}</h2><p className="mt-2 text-sm text-muted-foreground">{stage.description}</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Info label="Valor" value={price?price.amount_cents===0?"R$ 0/mês":`${formatMoney(price.amount_cents,price.currency)}/${price.billing_interval==="annual"?"ano":"mês"}`:"Sem cobrança"}/><Info label="Status Stripe" value={providerLabel(subscription?.provider_status)}/><Info label="Próxima data" value={trialEnd?`Teste até ${trialEnd}`:nextDate??"—"}/><Info label="Tolerância" value={graceEnd?`Até ${graceEnd}`:"Sem tolerância ativa"}/></div>
        {detail?.pending_change?<div className="mt-4 rounded-xl border border-warning/25 bg-warning-soft p-3 text-sm font-semibold">Seu plano mudará para {detail.pending_change.plan_name} em {formatDate(detail.pending_change.effective_at)??"uma data programada"}.</div>:null}
        {subscription?.cancel_at_period_end?<div className="mt-4 flex flex-col gap-3 rounded-xl border border-warning/25 bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between"><div><strong>Cancelamento agendado</strong><p className="text-sm">O acesso pago continua até {nextDate??"o fim do período atual"}. Depois, a loja volta ao plano Gratuito.</p></div><Button variant="outline" disabled={actionBusy==="resume"} onClick={async()=>{setActionBusy("resume");try{await resumePlan({data:{storeId}});setNotice("Cancelamento removido. A assinatura continuará renovando normalmente.");await refreshAll()}catch(e){setNotice(e instanceof Error?`Não foi possível manter a assinatura (${e.message}).`:"Não foi possível manter a assinatura.")}finally{setActionBusy(null)}}}>Manter assinatura</Button></div>:subscription?.provider_status&&!["canceled","incomplete_expired"].includes(subscription.provider_status)?<div className="mt-4 flex justify-end"><Button variant="outline" disabled={actionBusy==="cancel"} onClick={()=>void selectPlan("gratis","monthly")}>Cancelar no fim do período</Button></div>:null}
      </article>
      <article className="panel p-5 sm:p-6"><Sparkles className="size-6 text-brand"/><h2 className="mt-4 font-display text-lg font-black">Cobrança protegida</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Preço, plano, prorrata e autorização são resolvidos no backend. O retorno do checkout nunca ativa recursos sozinho.</p>{subscription?.last_payment_failure_at?<div className="mt-4 flex gap-2 rounded-xl border border-warning/25 bg-warning-soft p-3 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0"/> Houve uma falha recente de cobrança. Use “Gerenciar pagamento” para atualizar o método de pagamento.</div>:null}</article>
    </section>

    <section className="mt-5 panel p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.15em] text-muted-foreground">Faturas</p><h2 className="mt-1 font-display text-xl font-black">Histórico de cobranças</h2></div><FileText className="size-6 text-brand"/></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs uppercase text-muted-foreground"><tr><th className="py-2">Data</th><th>Valor</th><th>Status</th><th>Vencimento</th><th>Invoice Stripe</th></tr></thead><tbody>{detail?.invoices?.length?detail.invoices.map(i=><tr key={i.id} className="border-t border-border"><td className="py-3">{formatDate(i.created_at)??"—"}</td><td>{formatMoney(i.amount_cents,i.currency)}</td><td>{i.provider_status??i.status}</td><td>{formatDate(i.due_at)??"—"}</td><td className="font-mono text-xs">{i.invoice_id??"—"}</td></tr>):<tr><td colSpan={5} className="border-t border-border py-6 text-center text-muted-foreground">Nenhuma cobrança registrada.</td></tr>}</tbody></table></div></section>

    <section className="mt-9" aria-labelledby="compare-plans-title"><div className="mx-auto max-w-3xl text-center"><p className="text-xs font-black uppercase tracking-[.18em] text-brand">Alterar plano</p><h2 id="compare-plans-title" className="mt-3 font-display text-3xl font-black tracking-[-.04em]">Planos Comandiva</h2><p className="mt-3 text-sm text-muted-foreground">Upgrade é processado pela Stripe com cobrança/prorrata quando aplicável; downgrade é agendado para o fim do período atual.</p></div><PlanCatalog plans={plans} context="panel" currentPlanCode={access.plan_code} busyPlanCode={busyPlan} onSelectPlan={(code,interval)=>void selectPlan(code,interval)} className="mt-7"/></section>

    <section className="mt-9"><h2 className="mb-4 font-display text-2xl font-black">Pagamentos das vendas</h2><StripeConnectStatus storeId={storeId} status={stripeStatusQuery.data} readiness={stripeReadinessQuery.data} loading={stripeStatusQuery.isLoading||stripeReadinessQuery.isLoading} onRefresh={async()=>{await Promise.all([stripeStatusQuery.refetch(),stripeReadinessQuery.refetch()])}}/></section>
    <section className="mt-5"><WhatsAppAddonStatus data={whatsappQuery.data} loading={whatsappQuery.isLoading}/></section>
    {detailLoading?<p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw className="size-3 animate-spin"/> Atualizando dados financeiros…</p>:null}
  </div>;
}

function Info({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-border bg-muted/35 p-3.5"><div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><CalendarDays className="size-3.5"/>{label}</div><p className="mt-1.5 text-sm font-extrabold">{value}</p></div>}
