import { Check, Minus, Sparkles } from "lucide-react";
import { useState } from "react";

import type { PublicPlan, PublicPlanPrice } from "@/lib/marketing.functions";
import { cn } from "@/lib/utils";

export type BillingInterval = "monthly" | "annual";
type CatalogContext = "marketing" | "panel";

export type PlanCatalogProps = {
  plans: PublicPlan[];
  context?: CatalogContext;
  currentPlanCode?: string | null;
  className?: string;
  busyPlanCode?: string | null;
  onSelectPlan?: (planCode: string, interval: BillingInterval) => void;
};

const FEATURE_LABELS = [
  ["catalog", "Cardápio digital"], ["orders", "Gestão de pedidos"], ["pickup", "Pedidos para retirada"],
  ["delivery", "Operação de entrega"], ["tracking", "Acompanhamento de pedidos"], ["thermal_print", "Impressão térmica"],
  ["kds", "Tela de cozinha (KDS)"], ["growth", "Recursos de crescimento"], ["priority_support", "Suporte prioritário"],
] as const;
const REPORT_LABELS: Record<string,string> = { basic:"Relatórios básicos", standard:"Relatórios completos", advanced:"Relatórios avançados" };
function priceFor(plan:PublicPlan,interval:BillingInterval):PublicPlanPrice|null { const exact=plan.prices.find(p=>p.billing_interval===interval)??null;if(exact)return exact;const monthly=plan.prices.find(p=>p.billing_interval==="monthly")??null;return interval==="annual"&&monthly?.amount_cents===0?monthly:null; }
function money(cents:number,currency="BRL"){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:currency||"BRL"}).format(cents/100)}
function count(v:number){return new Intl.NumberFormat("pt-BR").format(v)}
function limits(plan:PublicPlan){return [plan.max_orders_month===null?"Pedidos mensais ilimitados":`Até ${count(plan.max_orders_month)} pedidos/mês`,plan.max_team_members===null?"Equipe sem limite cadastrado":`Até ${count(plan.max_team_members)} membros da equipe`,plan.max_couriers===null?"Entregadores sem limite cadastrado":`Até ${count(plan.max_couriers)} entregadores`]}
function benefit(plan:PublicPlan){const m=plan.prices.find(p=>p.billing_interval==="monthly"),a=plan.prices.find(p=>p.billing_interval==="annual");if(!m||!a||m.amount_cents<=0)return null;const saved=m.amount_cents*12-a.amount_cents;if(saved<=0)return null;const months=saved/m.amount_cents,rounded=Math.round(months);return Math.abs(months-rounded)<.01&&rounded>0?`${rounded} ${rounded===1?"mês grátis":"meses grátis"}`:`${Math.round(saved/(m.amount_cents*12)*100)}% de economia`}
function trialDays(plan:PublicPlan){return plan.prices.reduce((m,p)=>Math.max(m,p.trial_days||0),0)}
function features(plan:PublicPlan){const rows=FEATURE_LABELS.map(([key,label])=>({label,enabled:plan.features[key]===true}));const reports=plan.features.reports;if(typeof reports==="string"&&reports.trim())rows.push({label:REPORT_LABELS[reports]??`Relatórios: ${reports}`,enabled:true});return rows}

export function PlanCatalog({plans,context="marketing",currentPlanCode=null,className,busyPlanCode=null,onSelectPlan}:PlanCatalogProps){
  const [interval,setInterval]=useState<BillingInterval>("monthly");const marketing=context==="marketing";const hasAnnual=plans.some(p=>p.prices.some(x=>x.billing_interval==="annual"));
  if(!plans.length)return <div className={cn("rounded-[28px] border p-6 text-center sm:p-8",marketing?"border-[#4B1D6D]/10 bg-white text-[#4B1D6D]":"border-border bg-card text-foreground",className)}><p className="font-display text-xl font-extrabold">Planos temporariamente indisponíveis</p><p className={cn("mx-auto mt-2 max-w-xl text-sm leading-6",marketing?"text-[#706675]":"text-muted-foreground")}>Não vamos exibir valores de exemplo enquanto o catálogo comercial não estiver disponível.</p>{marketing?<a href="/criar-loja" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#FF6A4D] px-5 text-sm font-extrabold text-white">Criar minha loja</a>:null}</div>;
  return <div className={className}>
    <div className="flex justify-center"><div role="group" aria-label="Período de cobrança" className={cn("inline-flex rounded-2xl border p-1",marketing?"border-[#4B1D6D]/10 bg-white":"border-border bg-muted/50")}>
      {(["monthly","annual"] as const).map(v=><button key={v} type="button" aria-pressed={interval===v} disabled={v==="annual"&&!hasAnnual} onClick={()=>setInterval(v)} className={cn("min-h-10 rounded-xl px-4 text-sm font-extrabold transition disabled:opacity-40",interval===v?(marketing?"bg-[#4B1D6D] text-white shadow-sm":"bg-background text-foreground shadow-sm"):(marketing?"text-[#6F6573] hover:text-[#4B1D6D]":"text-muted-foreground hover:text-foreground"))}>{v==="monthly"?"Mensal":"Anual"}</button>)}
    </div></div>
    <div className="mt-8 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">{plans.map(plan=>{const selected=priceFor(plan,interval),monthly=plan.prices.find(p=>p.billing_interval==="monthly")??null,annualBenefit=benefit(plan),trial=trialDays(plan),highlighted=plan.code==="profissional",current=currentPlanCode===plan.code,isFree=selected?.amount_cents===0,annualEquivalent=interval==="annual"&&selected?.billing_interval==="annual"?Math.round(selected.amount_cents/12):null,busy=busyPlanCode===plan.code;const ctaClass=cn("inline-flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-center text-sm font-black transition",highlighted&&marketing?"bg-[#FF6A4D] text-white hover:bg-[#F15C40]":marketing?"bg-[#4B1D6D] text-white hover:bg-[#3E175A]":"bg-brand text-brand-foreground hover:opacity-90");return <article key={plan.code} className={cn("relative flex min-w-0 flex-col overflow-hidden rounded-[28px] border p-5 shadow-sm sm:p-6",marketing?(highlighted?"border-[#4B1D6D]/35 bg-[#4B1D6D] text-white shadow-[0_22px_55px_rgba(75,29,109,.18)]":"border-[#4B1D6D]/10 bg-white text-[#2A2030]"):(highlighted?"border-brand/30 bg-card shadow-e2":"border-border bg-card"),current&&!marketing&&"ring-2 ring-brand/35 ring-offset-2 ring-offset-background")}>
      <div className="flex min-h-7 flex-wrap items-center gap-2">{highlighted?<span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[.08em]",marketing?"bg-[#FF8068] text-white":"bg-brand-soft text-brand-soft-foreground")}><Sparkles className="size-3"/> Mais escolhido</span>:null}{current&&!marketing?<span className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-black uppercase tracking-[.08em] text-success">Plano atual</span>:null}{interval==="annual"&&annualBenefit?<span className={cn("rounded-full px-2.5 py-1 text-[11px] font-black",marketing&&highlighted?"bg-white/12 text-white":marketing?"bg-[#FFF0EA] text-[#D94F37]":"bg-success-soft text-success")}>{annualBenefit}</span>:null}</div>
      <h3 className={cn("mt-5 font-display text-2xl font-black tracking-[-.035em]",!marketing&&"text-foreground")}>{plan.name}</h3><p className={cn("mt-2 min-h-12 text-sm leading-6",marketing?(highlighted?"text-white/70":"text-[#776D7B]"):"text-muted-foreground")}>{plan.description||"Plano comercial Comandiva."}</p>
      <div className="mt-6 min-h-[88px]">{!selected?<><p className="text-lg font-black">Preço indisponível</p><p className="mt-1 text-xs opacity-60">Consulte novamente quando o catálogo estiver atualizado.</p></>:isFree?<><p className="font-display text-4xl font-black tracking-[-.05em]">Grátis</p><p className="mt-1 text-xs opacity-60">Sem cobrança recorrente.</p></>:annualEquivalent!==null?<><div className="flex items-end gap-1.5"><span className="font-display text-4xl font-black tracking-[-.05em]">{money(annualEquivalent,selected.currency)}</span><span className="pb-1 text-xs font-bold opacity-60">/mês</span></div><p className="mt-1 text-xs opacity-60">{money(selected.amount_cents,selected.currency)} cobrados no ano</p></>:<><div className="flex items-end gap-1.5"><span className="font-display text-4xl font-black tracking-[-.05em]">{money(selected.amount_cents,selected.currency)}</span><span className="pb-1 text-xs font-bold opacity-60">/mês</span></div>{monthly&&interval==="monthly"?<p className="mt-1 text-xs opacity-60">Cobrança mensal.</p>:null}</>}</div>
      <div className={cn("mt-5 border-t pt-5",marketing&&highlighted?"border-white/12":marketing?"border-[#4B1D6D]/10":"border-border")}><p className="text-[11px] font-black uppercase tracking-[.12em] opacity-60">Limites</p><ul className="mt-3 space-y-2.5">{limits(plan).map(item=><li key={item} className="flex gap-2 text-xs leading-5"><Check className="mt-0.5 size-3.5 shrink-0"/><span>{item}</span></li>)}</ul></div>
      <div className="mt-5 flex-1"><p className="text-[11px] font-black uppercase tracking-[.12em] opacity-60">Recursos</p><ul className="mt-3 space-y-2.5">{features(plan).map(item=><li key={item.label} className={cn("flex gap-2 text-xs leading-5",!item.enabled&&"opacity-45")}>{item.enabled?<Check className="mt-0.5 size-3.5 shrink-0"/>:<Minus className="mt-0.5 size-3.5 shrink-0"/>}<span>{item.label}</span></li>)}</ul></div>
      <div className="mt-6">{marketing?<a href={`/criar-loja?plan=${encodeURIComponent(plan.code)}&interval=${interval}`} className={ctaClass}>{isFree?"Começar grátis":trial>0?`Testar ${trial} dias grátis`:"Assinar agora"}</a>:<button type="button" disabled={current||busy||!onSelectPlan||!selected} onClick={()=>onSelectPlan?.(plan.code,interval)} className={cn(ctaClass,"disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-muted disabled:text-muted-foreground")}>{current?"Plano atual":busy?"Processando…":isFree?"Plano gratuito":"Selecionar plano"}</button>}</div>
    </article>})}</div>
  </div>;
}
