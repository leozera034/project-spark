import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Banknote,
  CircleDollarSign,
  FileWarning,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Search,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import {
  useAdminActions,
  usePlatformBilling,
  usePlatformHealth,
  usePlatformRecentErrors,
  usePlatformStores,
} from "@/store/platform/platform-admin.queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function AdminDashboard() {
  const [search, setSearch] = useState("");
  const { data: health, isLoading: healthLoading } = usePlatformHealth();
  const { data: billing, isLoading: billingLoading } = usePlatformBilling();
  const { data: errors, isLoading: errorsLoading } = usePlatformRecentErrors(10);
  const { data: stores, isLoading: storesLoading } = usePlatformStores({ search });
  const { suspend, reactivate } = useAdminActions();
  const [suspendingStore, setSuspendingStore] = useState<{ id: string; name: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  async function handleSuspend() {
    if (!suspendingStore || !suspendReason.trim()) return;
    try {
      await suspend.mutateAsync({ storeId: suspendingStore.id, reason: suspendReason.trim() });
      toast.success(`Loja ${suspendingStore.name} suspensa.`);
      setSuspendingStore(null);
      setSuspendReason("");
    } catch {
      toast.error("Não foi possível suspender a loja.");
    }
  }

  async function handleReactivate(id: string, name: string) {
    try {
      await reactivate.mutateAsync({ storeId: id });
      toast.success(`Loja ${name} reativada.`);
    } catch {
      toast.error("Não foi possível reativar a loja.");
    }
  }

  const activeRate = (health?.totalStores ?? 0) > 0
    ? Math.round(((health?.activeStores ?? 0) / (health?.totalStores ?? 1)) * 100)
    : 0;

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-8 px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <section className="relative overflow-hidden rounded-[30px] border border-white/7 bg-carbon px-5 py-7 text-carbon-foreground shadow-e2 sm:px-8 sm:py-9">
        <div className="absolute -right-16 -top-24 size-72 rounded-full bg-brand/12 blur-3xl" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1.5 text-xs font-black text-brand"><ShieldCheck className="size-3.5" /> Cockpit da plataforma</div>
            <h1 className="pa-display mt-5 text-3xl font-bold sm:text-4xl">Visão executiva do Pediu Aqui</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-carbon-foreground/52">Acompanhe operação, receita recorrente, ciclo de vida das lojas e falhas recentes sem sair do mesmo painel.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-[430px]">
            <HeroMini label="Lojas ativas" value={healthLoading ? "…" : String(health?.activeStores ?? 0)} icon={<Store className="size-4" />} />
            <HeroMini label="Ativação" value={healthLoading ? "…" : `${activeRate}%`} icon={<TrendingUp className="size-4" />} />
            <HeroMini label="Pedidos 24h" value={healthLoading ? "…" : String(health?.ordersLast24h ?? 0)} icon={<Activity className="size-4" />} className="col-span-2 sm:col-span-1" />
          </div>
        </div>
      </section>

      <section aria-labelledby="operacao-title">
        <SectionHeading eyebrow="Operação" title="Saúde da plataforma" description="Sinais que mostram se a rede está ativa e operando." />
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PremiumMetric title="Total de lojas" value={health?.totalStores} subValue={`${health?.activeStores ?? 0} ativas`} icon={<Store className="size-5" />} loading={healthLoading} />
          <PremiumMetric title="Pedidos nas últimas 24h" value={health?.ordersLast24h} subValue="Volume recente da rede" icon={<Activity className="size-5" />} loading={healthLoading} />
          <PremiumMetric title="Entregadores online" value={health?.activeCouriers} subValue="Disponíveis agora" icon={<Users className="size-5" />} loading={healthLoading} />
          <PremiumMetric title="Lojas suspensas" value={health?.suspendedStores} subValue="Intervenção administrativa" icon={<ShieldAlert className="size-5" />} loading={healthLoading} alert={(health?.suspendedStores ?? 0) > 0} />
        </div>
      </section>

      <section aria-labelledby="financeiro-title">
        <SectionHeading eyebrow="Receita" title="Financeiro recorrente" description="Acompanhe contrato, recebimento e risco de cobrança." />
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PremiumMetric title="MRR contratado" value={billing ? money.format(Number(billing.monthlyRecurringRevenue)) : undefined} subValue={`${billing?.activeSubscriptions ?? 0} assinaturas ativas`} icon={<CircleDollarSign className="size-5" />} loading={billingLoading} />
          <PremiumMetric title="Recebido no mês" value={billing ? money.format(Number(billing.paidCurrentMonth)) : undefined} subValue="Pagamentos confirmados" icon={<Banknote className="size-5" />} loading={billingLoading} />
          <PremiumMetric title="Em cortesia" value={billing?.courtesySubscriptions} subValue="Sem cobrança neste momento" icon={<Sparkles className="size-5" />} loading={billingLoading} />
          <PremiumMetric title="Inadimplentes" value={billing?.delinquentSubscriptions} subValue={`${billing?.suspendedSubscriptions ?? 0} suspensas por cobrança`} icon={<AlertTriangle className="size-5" />} loading={billingLoading} alert={(billing?.delinquentSubscriptions ?? 0) > 0} />
        </div>
      </section>

      <Card className="overflow-hidden rounded-[26px] border-border/80 shadow-[0_12px_36px_rgba(4,24,30,.055)]">
        <CardHeader className="border-b border-border/70 bg-muted/25 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.14em] text-brand">Rede</p>
              <CardTitle className="mt-1 text-xl">Diretório de lojas</CardTitle>
              <CardDescription className="mt-1">Pesquise, acompanhe status e controle o ciclo de vida sem apagar histórico.</CardDescription>
            </div>
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou slug..." className="h-11 rounded-xl bg-background pl-10" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead className="pl-6">Loja</TableHead><TableHead>Status</TableHead><TableHead>Pedidos</TableHead><TableHead>Criada em</TableHead><TableHead className="w-[64px] pr-6" /></TableRow></TableHeader>
              <TableBody>
                {storesLoading ? Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={index}><TableCell className="pl-6"><Skeleton className="h-5 w-32" /></TableCell><TableCell><Skeleton className="h-5 w-20" /></TableCell><TableCell><Skeleton className="h-5 w-16" /></TableCell><TableCell><Skeleton className="h-5 w-24" /></TableCell><TableCell className="pr-6"><Skeleton className="h-8 w-8 rounded-full" /></TableCell></TableRow>
                )) : stores?.items.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="pl-6"><div className="flex flex-col"><span className="font-extrabold">{store.name}</span><span className="mt-0.5 font-mono text-[11px] text-muted-foreground">/{store.slug}</span></div></TableCell>
                    <TableCell><StatusBadge status={store.status} /></TableCell>
                    <TableCell><span className="font-bold tabular-nums">{store.total_orders}</span></TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(store.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                    <TableCell className="pr-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-xl" aria-label={`Ações de ${store.name}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações da loja</DropdownMenuLabel><DropdownMenuSeparator />
                          {store.status === "ativa" ? <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setSuspendingStore({ id: store.id, name: store.name })}><PauseCircle className="mr-2 size-4" />Suspender loja</DropdownMenuItem> : store.status === "suspensa" ? <DropdownMenuItem onClick={() => handleReactivate(store.id, store.name)}><PlayCircle className="mr-2 size-4" />Reativar loja</DropdownMenuItem> : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {!storesLoading && stores?.items.length === 0 ? <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">Nenhuma loja encontrada.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-[26px] border-border/80 shadow-[0_12px_36px_rgba(4,24,30,.055)]">
        <CardHeader className="border-b border-border/70 bg-muted/25 pb-5">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-2xl bg-warning-soft text-warning"><FileWarning className="size-5" /></div><div><CardTitle className="text-xl">Erros recentes</CardTitle><CardDescription className="mt-1">Eventos sanitizados capturados pela observabilidade da aplicação.</CardDescription></div></div>
        </CardHeader>
        <CardContent className="p-0">
          {errorsLoading ? <div className="space-y-2 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : errors && errors.length > 0 ? (
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="pl-6">Quando</TableHead><TableHead>Rota</TableHead><TableHead className="pr-6">Mensagem</TableHead></TableRow></TableHeader><TableBody>{errors.map((item) => <TableRow key={item.id}><TableCell className="whitespace-nowrap pl-6 text-muted-foreground">{format(new Date(item.createdAt), "dd/MM HH:mm", { locale: ptBR })}</TableCell><TableCell className="font-mono text-xs">{item.route ?? "—"}</TableCell><TableCell className="max-w-xl truncate pr-6">{item.message ?? "Erro sem mensagem"}</TableCell></TableRow>)}</TableBody></Table></div>
          ) : <div className="p-8 text-center"><ShieldCheck className="mx-auto size-7 text-success" /><p className="mt-3 text-sm font-bold">Nenhum erro persistido</p><p className="mt-1 text-xs text-muted-foreground">A observabilidade não registrou falhas recentes.</p></div>}
        </CardContent>
      </Card>

      <Dialog open={Boolean(suspendingStore)} onOpenChange={(open) => { if (!open) setSuspendingStore(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="size-5" />Suspender {suspendingStore?.name}</DialogTitle><DialogDescription>A loja deixa de operar, mas os dados e o histórico são preservados.</DialogDescription></DialogHeader>
          <div className="space-y-2 py-4"><label className="text-sm font-medium" htmlFor="suspend-reason">Motivo</label><Input id="suspend-reason" maxLength={500} placeholder="Informe o motivo da suspensão" value={suspendReason} onChange={(event) => setSuspendReason(event.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setSuspendingStore(null)}>Cancelar</Button><Button variant="destructive" onClick={handleSuspend} disabled={!suspendReason.trim() || suspend.isPending}>{suspend.isPending ? "Suspendendo..." : "Confirmar suspensão"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-brand">{eyebrow}</p><h2 className="pa-display mt-1 text-2xl font-bold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
}

function HeroMini({ label, value, icon, className = "" }: { label: string; value: string; icon: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/8 bg-white/[.035] p-4 ${className}`}><div className="flex items-center gap-2 text-brand">{icon}<span className="text-[10px] font-black uppercase tracking-[.12em] text-carbon-foreground/38">{label}</span></div><p className="mt-3 text-2xl font-black tabular-nums">{value}</p></div>;
}

function PremiumMetric({ title, value, subValue, icon, loading, alert = false }: { title: string; value?: number | string; subValue?: string; icon: ReactNode; loading: boolean; alert?: boolean }) {
  return <Card className={`rounded-[22px] border-border/80 ${alert ? "border-destructive/22 bg-destructive/[.025]" : ""}`}><CardContent className="p-5"><div className="flex items-start justify-between gap-4"><div className={`grid size-10 place-items-center rounded-2xl ${alert ? "bg-destructive/10 text-destructive" : "bg-brand/10 text-brand"}`}>{icon}</div><span className="text-[10px] font-black uppercase tracking-[.12em] text-muted-foreground">{title}</span></div>{loading ? <Skeleton className="mt-5 h-9 w-24" /> : <p className={`mt-5 text-3xl font-black tracking-tight tabular-nums ${alert ? "text-destructive" : ""}`}>{value ?? 0}</p>}{subValue && !loading ? <p className="mt-1 text-xs text-muted-foreground">{subValue}</p> : null}</CardContent></Card>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ativa") return <Badge className="border-success/20 bg-success/10 text-success">Ativa</Badge>;
  if (status === "suspensa") return <Badge variant="destructive">Suspensa</Badge>;
  if (status === "em_implantacao") return <Badge variant="secondary">Implantação</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}
