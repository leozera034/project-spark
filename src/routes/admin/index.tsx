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
  ShieldAlert,
  Store,
  Users,
} from "lucide-react";
import { useState } from "react";
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
    <main className="container mx-auto space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
        <p className="mt-1 text-muted-foreground">Saúde operacional, lojas, assinaturas e erros da plataforma.</p>
      </div>

      <section className="space-y-3" aria-labelledby="operacao-title">
        <h2 id="operacao-title" className="text-lg font-semibold">Operação</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <HealthCard title="Total de lojas" value={health?.totalStores} subValue={`${health?.activeStores ?? 0} ativas`} icon={<Store className="h-4 w-4 text-muted-foreground" />} loading={healthLoading} />
          <HealthCard title="Pedidos (24h)" value={health?.ordersLast24h} icon={<Activity className="h-4 w-4 text-muted-foreground" />} loading={healthLoading} />
          <HealthCard title="Entregadores online" value={health?.activeCouriers} icon={<Users className="h-4 w-4 text-muted-foreground" />} loading={healthLoading} />
          <HealthCard title="Lojas suspensas" value={health?.suspendedStores} icon={<ShieldAlert className="h-4 w-4 text-destructive" />} loading={healthLoading} colorClass={(health?.suspendedStores ?? 0) > 0 ? "text-destructive" : ""} />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="financeiro-title">
        <h2 id="financeiro-title" className="text-lg font-semibold">Financeiro recorrente</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="MRR contratado" value={billing ? money.format(Number(billing.monthlyRecurringRevenue)) : undefined} subValue={`${billing?.activeSubscriptions ?? 0} assinaturas ativas`} icon={<CircleDollarSign className="h-4 w-4 text-muted-foreground" />} loading={billingLoading} />
          <MetricCard title="Recebido no mês" value={billing ? money.format(Number(billing.paidCurrentMonth)) : undefined} icon={<Banknote className="h-4 w-4 text-muted-foreground" />} loading={billingLoading} />
          <HealthCard title="Em cortesia" value={billing?.courtesySubscriptions} icon={<Store className="h-4 w-4 text-muted-foreground" />} loading={billingLoading} />
          <HealthCard title="Inadimplentes" value={billing?.delinquentSubscriptions} subValue={`${billing?.suspendedSubscriptions ?? 0} assinaturas suspensas`} icon={<AlertTriangle className="h-4 w-4 text-destructive" />} loading={billingLoading} colorClass={(billing?.delinquentSubscriptions ?? 0) > 0 ? "text-destructive" : ""} />
        </div>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Diretório de lojas</CardTitle>
              <CardDescription>Gestão do ciclo de vida das lojas sem apagar dados.</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou slug..." className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Loja</TableHead><TableHead>Status</TableHead><TableHead>Pedidos</TableHead><TableHead>Criada em</TableHead><TableHead className="w-[50px]" /></TableRow></TableHeader>
              <TableBody>
                {storesLoading ? Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={index}><TableCell><Skeleton className="h-5 w-32" /></TableCell><TableCell><Skeleton className="h-5 w-20" /></TableCell><TableCell><Skeleton className="h-5 w-16" /></TableCell><TableCell><Skeleton className="h-5 w-24" /></TableCell><TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell></TableRow>
                )) : stores?.items.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell><div className="flex flex-col"><span className="font-medium">{store.name}</span><span className="text-xs text-muted-foreground">/{store.slug}</span></div></TableCell>
                    <TableCell><StatusBadge status={store.status} /></TableCell>
                    <TableCell>{store.total_orders}</TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(store.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Ações de ${store.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel><DropdownMenuSeparator />
                          {store.status === "ativa" ? (
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setSuspendingStore({ id: store.id, name: store.name })}><PauseCircle className="mr-2 h-4 w-4" />Suspender loja</DropdownMenuItem>
                          ) : store.status === "suspensa" ? (
                            <DropdownMenuItem onClick={() => handleReactivate(store.id, store.name)}><PlayCircle className="mr-2 h-4 w-4" />Reativar loja</DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {!storesLoading && stores?.items.length === 0 ? <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Nenhuma loja encontrada.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileWarning className="h-5 w-5" />Erros recentes</CardTitle><CardDescription>Eventos sanitizados capturados pela observabilidade da aplicação.</CardDescription></CardHeader>
        <CardContent>
          {errorsLoading ? <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : errors && errors.length > 0 ? (
            <div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Quando</TableHead><TableHead>Rota</TableHead><TableHead>Mensagem</TableHead></TableRow></TableHeader><TableBody>{errors.map((item) => <TableRow key={item.id}><TableCell className="whitespace-nowrap text-muted-foreground">{format(new Date(item.createdAt), "dd/MM HH:mm", { locale: ptBR })}</TableCell><TableCell className="font-mono text-xs">{item.route ?? "—"}</TableCell><TableCell className="max-w-xl truncate">{item.message ?? "Erro sem mensagem"}</TableCell></TableRow>)}</TableBody></Table></div>
          ) : <p className="text-sm text-muted-foreground">Nenhum erro persistido até agora.</p>}
        </CardContent>
      </Card>

      <Dialog open={Boolean(suspendingStore)} onOpenChange={(open) => { if (!open) setSuspendingStore(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Suspender {suspendingStore?.name}</DialogTitle><DialogDescription>A loja deixa de operar, mas os dados e o histórico são preservados.</DialogDescription></DialogHeader>
          <div className="space-y-2 py-4"><label className="text-sm font-medium" htmlFor="suspend-reason">Motivo</label><Input id="suspend-reason" maxLength={500} placeholder="Informe o motivo da suspensão" value={suspendReason} onChange={(event) => setSuspendReason(event.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setSuspendingStore(null)}>Cancelar</Button><Button variant="destructive" onClick={handleSuspend} disabled={!suspendReason.trim() || suspend.isPending}>{suspend.isPending ? "Suspendendo..." : "Confirmar suspensão"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ativa") return <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600">Ativa</Badge>;
  if (status === "suspensa") return <Badge variant="destructive">Suspensa</Badge>;
  if (status === "em_implantacao") return <Badge variant="secondary">Implantação</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function HealthCard({ title, value, subValue, icon, loading, colorClass = "" }: { title: string; value?: number; subValue?: string; icon: React.ReactNode; loading: boolean; colorClass?: string }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle>{icon}</CardHeader><CardContent>{loading ? <Skeleton className="h-8 w-16" /> : <div className={`text-2xl font-bold ${colorClass}`}>{value ?? 0}</div>}{subValue && !loading ? <p className="text-xs text-muted-foreground">{subValue}</p> : null}</CardContent></Card>;
}

function MetricCard({ title, value, subValue, icon, loading }: { title: string; value?: string; subValue?: string; icon: React.ReactNode; loading: boolean }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle>{icon}</CardHeader><CardContent>{loading ? <Skeleton className="h-8 w-28" /> : <div className="text-2xl font-bold">{value ?? "R$ 0,00"}</div>}{subValue && !loading ? <p className="text-xs text-muted-foreground">{subValue}</p> : null}</CardContent></Card>;
}
