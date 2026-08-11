import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  FileWarning,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Search,
  ShieldAlert,
  Store,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-10 px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-border bg-carbon px-5 py-7 text-carbon-foreground shadow-e2 sm:px-7 lg:px-8">
        <div className="pointer-events-none absolute right-[-7rem] top-[-8rem] size-80 rounded-full bg-brand/12 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Pediu Aqui · plataforma</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Controle executivo da operação</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-carbon-foreground/55">
              Uma visão única de saúde, lojas, cobrança recorrente e incidentes persistidos pela aplicação.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-carbon-foreground/45">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Dados reais do sistema</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Ações administrativas auditáveis</span>
          </div>
        </div>
      </section>

      <section id="operacao" className="scroll-mt-28 space-y-4" aria-labelledby="operacao-title">
        <SectionHeader eyebrow="Operação" title="Saúde da plataforma" description="Indicadores do fluxo operacional atual." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Total de lojas" value={health?.totalStores} subValue={`${health?.activeStores ?? 0} ativas`} icon={<Store className="size-5" />} loading={healthLoading} />
          <MetricCard title="Pedidos (24h)" value={health?.ordersLast24h} icon={<Activity className="size-5" />} loading={healthLoading} />
          <MetricCard title="Entregadores online" value={health?.activeCouriers} icon={<Users className="size-5" />} loading={healthLoading} />
          <MetricCard title="Lojas suspensas" value={health?.suspendedStores} icon={<ShieldAlert className="size-5" />} loading={healthLoading} danger={(health?.suspendedStores ?? 0) > 0} />
        </div>
      </section>

      <section id="financeiro" className="scroll-mt-28 space-y-4" aria-labelledby="financeiro-title">
        <SectionHeader eyebrow="Financeiro" title="Receita recorrente e cobrança" description="Assinaturas, recebimentos e situações que exigem atenção." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="MRR contratado" value={billing ? money.format(Number(billing.monthlyRecurringRevenue)) : undefined} subValue={`${billing?.activeSubscriptions ?? 0} assinaturas ativas`} icon={<CircleDollarSign className="size-5" />} loading={billingLoading} />
          <MetricCard title="Recebido no mês" value={billing ? money.format(Number(billing.paidCurrentMonth)) : undefined} icon={<Banknote className="size-5" />} loading={billingLoading} />
          <MetricCard title="Em cortesia" value={billing?.courtesySubscriptions} icon={<Store className="size-5" />} loading={billingLoading} />
          <MetricCard title="Inadimplentes" value={billing?.delinquentSubscriptions} subValue={`${billing?.suspendedSubscriptions ?? 0} assinaturas suspensas`} icon={<AlertTriangle className="size-5" />} loading={billingLoading} danger={(billing?.delinquentSubscriptions ?? 0) > 0} />
        </div>
      </section>

      <section id="lojas" className="scroll-mt-28">
        <Card className="overflow-hidden border-border/80 shadow-e1">
          <CardHeader className="border-b border-border/70 bg-surface-muted/35">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-brand">Diretório</p>
                <CardTitle className="mt-2 text-2xl">Lojas da plataforma</CardTitle>
                <CardDescription className="mt-1">Pesquise, acompanhe status e execute ações de ciclo de vida sem apagar histórico.</CardDescription>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar por nome ou slug" className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader className="bg-muted/35"><TableRow><TableHead className="pl-6">Loja</TableHead><TableHead>Status</TableHead><TableHead>Pedidos</TableHead><TableHead>Criada em</TableHead><TableHead className="w-[64px]" /></TableRow></TableHeader>
                <TableBody>
                  {storesLoading ? Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}><TableCell className="pl-6"><Skeleton className="h-5 w-36" /></TableCell><TableCell><Skeleton className="h-5 w-20" /></TableCell><TableCell><Skeleton className="h-5 w-16" /></TableCell><TableCell><Skeleton className="h-5 w-24" /></TableCell><TableCell><Skeleton className="size-9 rounded-xl" /></TableCell></TableRow>
                  )) : stores?.items.map((store) => (
                    <TableRow key={store.id} className="group">
                      <TableCell className="pl-6"><div className="flex flex-col"><span className="font-semibold">{store.name}</span><span className="mt-0.5 font-mono text-[11px] text-muted-foreground">/{store.slug}</span></div></TableCell>
                      <TableCell><StatusBadge status={store.status} /></TableCell>
                      <TableCell className="font-semibold tabular-nums">{store.total_orders}</TableCell>
                      <TableCell className="text-muted-foreground">{format(new Date(store.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell><StoreActions store={store} onSuspend={() => setSuspendingStore({ id: store.id, name: store.name })} onReactivate={() => handleReactivate(store.id, store.name)} /></TableCell>
                    </TableRow>
                  ))}
                  {!storesLoading && stores?.items.length === 0 ? <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">Nenhuma loja encontrada para essa busca.</TableCell></TableRow> : null}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 p-4 md:hidden">
              {storesLoading ? Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-28 w-full rounded-2xl" />) : stores?.items.map((store) => (
                <article key={store.id} className="rounded-2xl border border-border bg-background p-4 shadow-e1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate font-semibold">{store.name}</p><p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">/{store.slug}</p></div>
                    <StoreActions store={store} onSuspend={() => setSuspendingStore({ id: store.id, name: store.name })} onReactivate={() => handleReactivate(store.id, store.name)} />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3"><StatusBadge status={store.status} /><span className="text-xs text-muted-foreground">{store.total_orders} pedidos</span></div>
                </article>
              ))}
              {!storesLoading && stores?.items.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhuma loja encontrada para essa busca.</div> : null}
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="erros" className="scroll-mt-28">
        <Card className="overflow-hidden border-border/80 shadow-e1">
          <CardHeader className="border-b border-border/70 bg-surface-muted/35">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger"><FileWarning className="size-5" /></span>
              <div><CardTitle className="text-xl">Erros recentes</CardTitle><CardDescription className="mt-1">Eventos sanitizados capturados pela observabilidade da aplicação.</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {errorsLoading ? <div className="space-y-2 p-5"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : errors && errors.length > 0 ? (
              <div className="overflow-x-auto"><Table><TableHeader className="bg-muted/35"><TableRow><TableHead className="pl-6">Quando</TableHead><TableHead>Rota</TableHead><TableHead>Mensagem</TableHead></TableRow></TableHeader><TableBody>{errors.map((item) => <TableRow key={item.id}><TableCell className="whitespace-nowrap pl-6 text-muted-foreground">{format(new Date(item.createdAt), "dd/MM HH:mm", { locale: ptBR })}</TableCell><TableCell className="max-w-56 truncate font-mono text-xs">{item.route ?? "—"}</TableCell><TableCell className="max-w-xl truncate">{item.message ?? "Erro sem mensagem"}</TableCell></TableRow>)}</TableBody></Table></div>
            ) : <div className="p-8 text-center"><div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-success-soft text-success"><Activity className="size-5" /></div><p className="mt-3 text-sm font-semibold">Nenhum erro persistido</p><p className="mt-1 text-xs text-muted-foreground">A observabilidade não registrou eventos recentes.</p></div>}
          </CardContent>
        </Card>
      </section>

      <Dialog open={Boolean(suspendingStore)} onOpenChange={(open) => { if (!open) { setSuspendingStore(null); setSuspendReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="size-5" />Suspender {suspendingStore?.name}</DialogTitle><DialogDescription>A loja deixa de operar, mas os dados e o histórico são preservados. O estado financeiro da assinatura não é alterado automaticamente.</DialogDescription></DialogHeader>
          <div className="space-y-2 py-4"><label className="text-sm font-semibold" htmlFor="suspend-reason">Motivo da suspensão</label><Input id="suspend-reason" maxLength={500} placeholder="Descreva o motivo para auditoria" value={suspendReason} onChange={(event) => setSuspendReason(event.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setSuspendingStore(null)}>Cancelar</Button><Button variant="destructive" onClick={handleSuspend} disabled={!suspendReason.trim() || suspend.isPending} loading={suspend.isPending} loadingLabel="Suspendendo loja">Confirmar suspensão</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">{eyebrow}</p><h2 className="mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ativa") return <Badge className="border border-success/20 bg-success-soft text-success hover:bg-success-soft">Ativa</Badge>;
  if (status === "suspensa") return <Badge variant="destructive">Suspensa</Badge>;
  if (status === "em_implantacao") return <Badge variant="secondary">Implantação</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

type StoreRow = { id: string; name: string; status: string };
function StoreActions({ store, onSuspend, onReactivate }: { store: StoreRow; onSuspend: () => void; onReactivate: () => void }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Ações de ${store.name}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Ações da loja</DropdownMenuLabel><DropdownMenuSeparator />{store.status === "ativa" ? <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onSuspend}><PauseCircle className="mr-2 size-4" />Suspender loja</DropdownMenuItem> : store.status === "suspensa" ? <DropdownMenuItem onClick={onReactivate}><PlayCircle className="mr-2 size-4" />Reativar loja</DropdownMenuItem> : <DropdownMenuItem disabled><ArrowUpRight className="mr-2 size-4" />Sem ação disponível</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>;
}

function MetricCard({ title, value, subValue, icon, loading, danger = false }: { title: string; value?: number | string; subValue?: string; icon: ReactNode; loading: boolean; danger?: boolean }) {
  return (
    <Card className={cn("group overflow-hidden border-border/80 shadow-e1 transition-all hover:-translate-y-0.5 hover:shadow-e2", danger && "border-danger/20")}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-muted-foreground">{title}</p>{loading ? <Skeleton className="mt-3 h-8 w-24" /> : <p className={cn("mt-2 text-2xl font-bold tracking-tight tabular-nums", danger && "text-danger")}>{value ?? 0}</p>}{subValue && !loading ? <p className="mt-1 text-[11px] text-muted-foreground">{subValue}</p> : null}</div><span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground transition-colors group-hover:bg-brand group-hover:text-brand-foreground", danger && "bg-danger-soft text-danger group-hover:bg-danger group-hover:text-danger-foreground")}>{icon}</span></div>
      </CardContent>
    </Card>
  );
}
