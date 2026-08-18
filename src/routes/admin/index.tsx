import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Banknote,
  Building2,
  CircleDollarSign,
  FileWarning,
  Gauge,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  WalletCards,
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

  const activeSubscriptions = billing?.activeSubscriptions ?? 0;
  const mrr = Number(billing?.monthlyRecurringRevenue ?? 0);
  const averageRevenue = activeSubscriptions > 0 ? mrr / activeSubscriptions : 0;
  const attentionCount =
    (health?.suspendedStores ?? 0) +
    (billing?.delinquentSubscriptions ?? 0) +
    (errors?.length ?? 0);
  const platformStatus =
    attentionCount === 0
      ? "Operação estável"
      : attentionCount <= 3
        ? "Atenção moderada"
        : "Atenção necessária";

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
    <main className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section
        id="visao-geral"
        className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#4B1D6D] p-5 text-white shadow-e2 sm:p-7 lg:p-8"
      >
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-[#FF6A4D]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-white/[.06] blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.25fr_.75fr] xl:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-extrabold text-white">
                <Sparkles className="size-3.5 text-[#FFB4A2]" /> SaaS Command Center
              </span>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  attentionCount === 0
                    ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                    : "border-amber-300/20 bg-amber-400/10 text-amber-100"
                }`}
              >
                {platformStatus}
              </span>
            </div>
            <h1 className="mt-5 max-w-4xl font-display text-3xl font-black tracking-[-.045em] text-white sm:text-4xl lg:text-5xl">
              Controle a plataforma sem perder o pulso da operação.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70 sm:text-base">
              Receita recorrente, lojas, operação e observabilidade reunidas em uma leitura executiva e acionável.
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <HeroStat
              label="MRR"
              value={billingLoading ? "—" : money.format(mrr)}
              icon={<CircleDollarSign className="size-4" />}
            />
            <HeroStat
              label="Lojas ativas"
              value={healthLoading ? "—" : String(health?.activeStores ?? 0)}
              icon={<Building2 className="size-4" />}
            />
          </div>
        </div>
      </section>

      <section id="operacao" className="space-y-3" aria-labelledby="operacao-title">
        <SectionHeading eyebrow="Tempo real" title="Operação da plataforma" id="operacao-title" aside="Indicadores consolidados" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SaasMetric
            title="Total de lojas"
            value={health?.totalStores}
            subValue={`${health?.activeStores ?? 0} ativas`}
            icon={<Store className="size-5" />}
            loading={healthLoading}
          />
          <SaasMetric
            title="Pedidos em 24h"
            value={health?.ordersLast24h}
            subValue="Volume recente"
            icon={<Activity className="size-5" />}
            loading={healthLoading}
          />
          <SaasMetric
            title="Entregadores online"
            value={health?.activeCouriers}
            subValue="Disponíveis agora"
            icon={<Users className="size-5" />}
            loading={healthLoading}
          />
          <SaasMetric
            title="Lojas suspensas"
            value={health?.suspendedStores}
            subValue="Exigem acompanhamento"
            icon={<AlertTriangle className="size-5" />}
            loading={healthLoading}
            danger={(health?.suspendedStores ?? 0) > 0}
          />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="financeiro-title">
        <SectionHeading eyebrow="Receita" title="Financeiro recorrente" id="financeiro-title" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SaasMetric
            title="MRR contratado"
            value={billing ? money.format(mrr) : undefined}
            subValue={`${activeSubscriptions} assinaturas ativas`}
            icon={<CircleDollarSign className="size-5" />}
            loading={billingLoading}
          />
          <SaasMetric
            title="Recebido no mês"
            value={billing ? money.format(Number(billing.paidCurrentMonth)) : undefined}
            subValue="Pagamentos confirmados"
            icon={<Banknote className="size-5" />}
            loading={billingLoading}
          />
          <SaasMetric
            title="Receita média"
            value={billing ? money.format(averageRevenue) : undefined}
            subValue="Por assinatura ativa"
            icon={<WalletCards className="size-5" />}
            loading={billingLoading}
          />
          <SaasMetric
            title="Inadimplentes"
            value={billing?.delinquentSubscriptions}
            subValue={`${billing?.suspendedSubscriptions ?? 0} assinaturas suspensas`}
            icon={<AlertTriangle className="size-5" />}
            loading={billingLoading}
            danger={(billing?.delinquentSubscriptions ?? 0) > 0}
          />
        </div>
      </section>

      <div className="grid min-w-0 gap-5 2xl:grid-cols-[1.45fr_.55fr]">
        <Card id="lojas" className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-border">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <CardTitle className="font-display text-xl">Diretório de lojas</CardTitle>
                <CardDescription>Gestão do ciclo de vida sem apagar dados ou histórico.</CardDescription>
              </div>
              <div className="relative w-full lg:w-80">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou slug..."
                  className="pl-10"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-w-full overflow-x-auto">
              <Table className="min-w-[680px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Loja</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pedidos</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead className="w-[58px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storesLoading
                    ? Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={index}>
                          <TableCell className="pl-6"><Skeleton className="h-5 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                        </TableRow>
                      ))
                    : stores?.items.map((store) => (
                        <TableRow key={store.id}>
                          <TableCell className="pl-6">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand/15 bg-brand-soft text-brand-soft-foreground">
                                <Building2 className="size-4" />
                              </span>
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate font-semibold text-foreground">{store.name}</span>
                                <span className="truncate text-xs text-muted-foreground">/{store.slug}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell><StatusBadge status={store.status} /></TableCell>
                          <TableCell className="font-semibold tabular-nums">{store.total_orders}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(store.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label={`Ações de ${store.name}`}>
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {store.status === "ativa" ? (
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setSuspendingStore({ id: store.id, name: store.name })}
                                  >
                                    <PauseCircle className="mr-2 size-4" />Suspender loja
                                  </DropdownMenuItem>
                                ) : store.status === "suspensa" ? (
                                  <DropdownMenuItem onClick={() => handleReactivate(store.id, store.name)}>
                                    <PlayCircle className="mr-2 size-4" />Reativar loja
                                  </DropdownMenuItem>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                  {!storesLoading && stores?.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                        Nenhuma loja encontrada.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="size-5 text-brand" />Radar executivo
              </CardTitle>
              <CardDescription>Pontos que merecem atenção administrativa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <RadarRow label="Inadimplentes" value={billing?.delinquentSubscriptions ?? 0} danger={(billing?.delinquentSubscriptions ?? 0) > 0} />
              <RadarRow label="Lojas suspensas" value={health?.suspendedStores ?? 0} danger={(health?.suspendedStores ?? 0) > 0} />
              <RadarRow label="Erros recentes" value={errors?.length ?? 0} danger={(errors?.length ?? 0) > 0} />
              <RadarRow label="Cortesias" value={billing?.courtesySubscriptions ?? 0} />
            </CardContent>
          </Card>

          <Card id="observabilidade">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-brand" />Observabilidade
              </CardTitle>
              <CardDescription>Últimos eventos sanitizados da aplicação.</CardDescription>
            </CardHeader>
            <CardContent>
              {errorsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : errors && errors.length > 0 ? (
                <div className="space-y-2">
                  {errors.slice(0, 6).map((item) => (
                    <div key={item.id} className="rounded-xl border border-border bg-surface-muted/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-warning">
                          {format(new Date(item.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                        <FileWarning className="size-4 text-warning" />
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-foreground">
                        {item.message ?? "Erro sem mensagem"}
                      </p>
                      <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                        {item.route ?? "rota não informada"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-success/15 bg-success-soft p-4">
                  <div className="flex items-center gap-2 text-success">
                    <ShieldCheck className="size-4" />
                    <span className="text-sm font-bold">Sem erros persistidos</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Nenhum evento recente exige análise.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={Boolean(suspendingStore)}
        onOpenChange={(open) => {
          if (!open) setSuspendingStore(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />Suspender {suspendingStore?.name}
            </DialogTitle>
            <DialogDescription>
              A loja deixa de operar, mas os dados e o histórico são preservados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <label className="text-sm font-medium" htmlFor="suspend-reason">Motivo</label>
            <Input
              id="suspend-reason"
              maxLength={500}
              placeholder="Informe o motivo da suspensão"
              value={suspendReason}
              onChange={(event) => setSuspendReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendingStore(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={!suspendReason.trim() || suspend.isPending}
            >
              {suspend.isPending ? "Suspendendo..." : "Confirmar suspensão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  id,
  aside,
}: {
  eyebrow: string;
  title: string;
  id: string;
  aside?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-brand">{eyebrow}</p>
        <h2 id={id} className="mt-1 font-display text-xl font-bold text-foreground">{title}</h2>
      </div>
      {aside ? <span className="hidden text-xs text-muted-foreground sm:inline">{aside}</span> : null}
    </div>
  );
}

function HeroStat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[.08] p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-[#FFB4A2]">
        {icon}
        <span className="truncate text-[11px] font-black uppercase tracking-[.14em] text-white/65">{label}</span>
      </div>
      <p className="mt-3 break-words font-display text-xl font-black tracking-[-.035em] text-white sm:text-2xl">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ativa") return <Badge className="border-success/20 bg-success-soft text-success">Ativa</Badge>;
  if (status === "suspensa") return <Badge variant="destructive">Suspensa</Badge>;
  if (status === "em_implantacao") return <Badge variant="secondary">Implantação</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function SaasMetric({
  title,
  value,
  subValue,
  icon,
  loading,
  danger = false,
}: {
  title: string;
  value?: number | string;
  subValue?: string;
  icon: ReactNode;
  loading: boolean;
  danger?: boolean;
}) {
  return (
    <Card className="group relative min-w-0 overflow-hidden">
      <div className="pointer-events-none absolute right-0 top-0 size-24 translate-x-8 -translate-y-8 rounded-full bg-brand/5 blur-2xl transition group-hover:bg-brand/10" />
      <CardHeader className="relative flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <CardTitle className="min-w-0 text-xs font-extrabold uppercase tracking-[.12em] text-muted-foreground">
          {title}
        </CardTitle>
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-xl border ${
            danger
              ? "border-danger/15 bg-danger-soft text-danger"
              : "border-brand/15 bg-brand-soft text-brand-soft-foreground"
          }`}
        >
          {icon}
        </span>
      </CardHeader>
      <CardContent className="relative">
        {loading ? (
          <Skeleton className="h-9 w-24" />
        ) : (
          <div className={`break-words font-display text-3xl font-black tracking-[-.045em] ${danger ? "text-danger" : "text-foreground"}`}>
            {value ?? 0}
          </div>
        )}
        {subValue && !loading ? <p className="mt-1 text-xs text-muted-foreground">{subValue}</p> : null}
      </CardContent>
    </Card>
  );
}

function RadarRow({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted/50 px-3.5 py-3">
      <span className="min-w-0 text-sm text-muted-foreground">{label}</span>
      <span
        className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-black tabular-nums ${
          danger ? "bg-warning-soft text-warning" : "bg-brand-soft text-brand-soft-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}