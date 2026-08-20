import { createFileRoute } from "@tanstack/react-router";
import { Activity, AlertTriangle, Store, Users } from "lucide-react";
import { usePlatformHealth, usePlatformStores } from "@/store/platform/platform-admin.queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/operacao")({ component: AdminOperationPage });

function AdminOperationPage() {
  const health = usePlatformHealth();
  const stores = usePlatformStores({ limit: 200 });
  const h = health.data;
  const attention = (stores.data?.items ?? []).filter((s) => s.status !== "ativa" || !s.stripe_recurring_confirmed);
  const metrics = [
    ["Lojas ativas", h?.activeStores ?? 0, Store],
    ["Pedidos 24h", h?.ordersLast24h ?? 0, Activity],
    ["Entregadores online", h?.activeCouriers ?? 0, Users],
    ["Lojas suspensas", h?.suspendedStores ?? 0, AlertTriangle],
  ] as const;
  return <main className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <header><p className="text-xs font-extrabold uppercase tracking-[.16em] text-brand">Operação</p><h1 className="mt-1 font-display text-3xl font-black">Pulso operacional da plataforma</h1><p className="mt-2 text-sm text-muted-foreground">Indicadores atualizados automaticamente a partir do backend.</p></header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label,value,Icon])=><Card key={label}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{label}</CardTitle><Icon className="size-5 text-brand" /></CardHeader><CardContent><div className="font-display text-3xl font-black">{health.isLoading?"—":value}</div></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>Lojas que exigem atenção</CardTitle></CardHeader><CardContent className="space-y-2">{attention.length===0?<p className="text-sm text-muted-foreground">Nenhuma loja exigindo atenção agora.</p>:attention.map((s)=><div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p className="font-semibold">{s.name}</p><p className="text-xs text-muted-foreground">{s.plan_name ?? "Sem plano"} · {s.provider_status ?? s.subscription_status ?? "sem cobrança vinculada"}</p></div><div className="flex gap-2"><Badge variant={s.status==="ativa"?"default":"destructive"}>{s.status}</Badge>{!s.stripe_recurring_confirmed?<Badge variant="outline">Sem Stripe recorrente</Badge>:null}</div></div>)}</CardContent></Card>
  </main>;
}
