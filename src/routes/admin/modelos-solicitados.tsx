import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Layers3, Store, TrendingUp } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";
import { getOtherProfileDemand } from "@/lib/platform-admin.functions";

export const Route = createFileRoute("/admin/modelos-solicitados")({ component: RequestedModelsPage });

function RequestedModelsPage(){
  const fn=useServerFn(getOtherProfileDemand);
  const query=useQuery({queryKey:["admin","other-profile-demand"],queryFn:()=>fn(),staleTime:30_000});
  const data=query.data;
  return <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
    <section><div className="flex items-center gap-2 text-[#4B1D6D]"><Layers3 className="size-5"/><span className="text-xs font-black uppercase tracking-[.14em]">Expansão de modelos</span></div><h1 className="mt-2 font-display text-3xl font-black tracking-tight">Tipos de loja ainda sem modelo</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Toda escolha “Outro” fica registrada aqui. Use a recorrência para decidir quais novos cardápios, regras e banners devem entrar na Comandiva.</p></section>
    {query.isLoading?<div className="h-40 animate-pulse rounded-2xl border bg-muted/40"/>:query.error?<ErrorState title="Não foi possível carregar as demandas" onRetry={()=>void query.refetch()}/>:!data||data.summary.length===0?<EmptyState title="Nenhuma demanda registrada" description="Quando uma loja escolher “Outro” e informar o tipo de negócio, a demanda aparecerá aqui."/>:<>
      <section className="grid gap-3 sm:grid-cols-3"><Metric icon={Store} label="Tipos diferentes" value={data.summary.length}/><Metric icon={TrendingUp} label="Lojas sinalizadas" value={data.summary.reduce((sum,item)=>sum+Number(item.stores||0),0)}/><Metric icon={Layers3} label="Seleções acumuladas" value={data.summary.reduce((sum,item)=>sum+Number(item.selections||0),0)}/></section>
      <Card><CardHeader><CardTitle>Ranking de demanda</CardTitle><CardDescription>Quanto mais lojas pedirem o mesmo tipo, maior o sinal para criar um modelo dedicado.</CardDescription></CardHeader><CardContent className="space-y-2">{data.summary.map((item,index)=><div key={item.normalized_label} className="flex min-w-0 items-center gap-3 rounded-xl border bg-muted/25 p-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-sm font-black text-brand-soft-foreground">{index+1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.label}</p><p className="text-xs text-muted-foreground">{item.stores} loja(s) · {item.selections} seleção(ões) · último sinal {new Date(item.last_seen_at).toLocaleDateString("pt-BR")}</p></div><Badge variant="secondary">{item.status}</Badge></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Registros por loja</CardTitle><CardDescription>Origem e histórico para entender quem está pedindo cada novo segmento.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="px-2 py-3">Loja</th><th className="px-2 py-3">Tipo informado</th><th className="px-2 py-3">Origem</th><th className="px-2 py-3">Vezes</th><th className="px-2 py-3">Último registro</th></tr></thead><tbody>{data.items.map(item=><tr key={item.id} className="border-b last:border-0"><td className="px-2 py-3 font-semibold">{item.store_name}</td><td className="px-2 py-3">{item.label}</td><td className="px-2 py-3 text-muted-foreground">{item.source}</td><td className="px-2 py-3 tabular-nums">{item.selection_count}</td><td className="px-2 py-3 text-muted-foreground">{new Date(item.last_seen_at).toLocaleString("pt-BR")}</td></tr>)}</tbody></table></CardContent></Card>
    </>}
  </main>;
}

function Metric({icon:Icon,label,value}:{icon:typeof Store;label:string;value:number}){return <Card><CardContent className="flex items-center gap-4 p-5"><span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand-soft-foreground"><Icon className="size-5"/></span><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-display text-3xl font-black tabular-nums">{value}</p></div></CardContent></Card>}
