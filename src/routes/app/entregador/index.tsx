import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  ChevronRight,
  Clock,
  History,
  LogOut,
  MapPin,
  Navigation,
  RefreshCcw,
  ShieldCheck,
  User,
  Wifi,
  WifiOff,
} from "lucide-react";

import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/kitchen/useKitchenOrders";
import {
  useMyCourierOperationalContext,
  useSetCourierOnline,
  useSetCourierOffline,
  useCourierHeartbeat,
  useAcceptDeliveryAssignment,
  useDeclineDeliveryAssignment,
} from "@/store/couriers/hooks/useCouriers";
import { useMyCourierDeliveryCounter } from "@/courier/reports/courier-counter.queries";
import { derivePresence, PRESENCE_LABEL, relativeTime } from "@/store/couriers/courier.formatters";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { CourierAlerts } from "@/notifications/courier/CourierAlerts";

export const Route = createFileRoute("/app/entregador/")({ component: CourierDashboard });

function CourierDashboard() {
  const { authContext, signOut } = useAuth();
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const [declineOpen, setDeclineOpen] = useState(false);

  const {
    data: context,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useMyCourierOperationalContext();

  const setOnline = useSetCourierOnline();
  const setOffline = useSetCourierOffline();
  const heartbeat = useCourierHeartbeat();
  const accept = useAcceptDeliveryAssignment();
  const decline = useDeclineDeliveryAssignment();
  const deliveryCounter = useMyCourierDeliveryCounter();

  useEffect(() => {
    if (!context?.onlineIntent || !isOnline) return;
    const interval = window.setInterval(() => heartbeat.mutate(), 120000);
    return () => window.clearInterval(interval);
  }, [context?.onlineIntent, heartbeat, isOnline]);

  if (isLoading) {
    return (
      <div className="min-h-svh bg-surface-muted/45 px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mx-auto max-w-lg space-y-4">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-svh bg-surface-muted/45 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-background p-5 shadow-e1">
          <ErrorState
            title="Não foi possível carregar sua operação"
            description={isOnline ? "Tivemos uma falha ao sincronizar suas entregas. Tente novamente." : "Você está sem conexão. Reconecte à internet e tente novamente."}
            onRetry={() => refetch()}
          />
        </div>
      </div>
    );
  }

  const presence = derivePresence(context?.onlineIntent ?? false, context?.lastSeenAt ?? null, context?.serverNow);
  const activeDelivery = context?.activeDelivery;
  const pendingAssignment = context?.pendingAssignment;

  const handleToggleOnline = () => {
    if (!isOnline) return;
    if (context?.onlineIntent) setOffline.mutate();
    else setOnline.mutate();
  };

  async function handleAccept() {
    if (!pendingAssignment || !isOnline) return;
    try {
      await accept.mutateAsync({
        deliveryId: pendingAssignment.deliveryId,
        expectedVersion: pendingAssignment.version,
        idempotencyKey: crypto.randomUUID(),
      });
    } catch {
      // O hook centraliza a mensagem de erro para o entregador.
    }
  }

  async function handleDeclineConfirm() {
    if (!pendingAssignment || !isOnline) return;
    try {
      await decline.mutateAsync({
        deliveryId: pendingAssignment.deliveryId,
        expectedVersion: pendingAssignment.version,
        reasonCode: "other",
        idempotencyKey: crypto.randomUUID(),
      });
      setDeclineOpen(false);
    } catch {
      // O hook centraliza a mensagem de erro para o entregador.
    }
  }

  return (
    <div className="min-h-svh bg-surface-muted/45 pb-24 text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/88 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-carbon text-carbon-foreground shadow-e1">
              <User className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{authContext?.full_name ?? "Entregador"}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className={cn("size-2 rounded-full", presence === "online" ? "bg-success" : presence === "sem_sinal" ? "bg-warning soft-pulse" : "bg-muted-foreground/35")} />
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{PRESENCE_LABEL[presence]}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isRefetching ? <RefreshCcw className="size-4 animate-spin text-muted-foreground" /> : null}
            <Button variant="ghost" size="icon" aria-label="Sair" onClick={() => void signOut("local").then(() => navigate({ to: "/entrar/entregador" }))}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {!isOnline ? (
        <div className="sticky top-[4.3rem] z-20 border-b border-danger/15 bg-danger-soft px-4 py-2.5 text-danger">
          <div className="mx-auto flex max-w-lg items-center gap-2 text-xs font-semibold"><WifiOff className="size-4" /> Sem internet. Ações operacionais ficam bloqueadas até reconectar.</div>
        </div>
      ) : null}

      <main className="mx-auto max-w-lg space-y-5 px-4 py-5">
        <CourierAlerts />

        <section className="relative overflow-hidden rounded-[1.6rem] bg-carbon p-5 text-carbon-foreground shadow-e2">
          <div className="pointer-events-none absolute -right-12 -top-14 size-44 rounded-full bg-brand/14 blur-3xl" />
          <div className="relative flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">Disponibilidade</p>
              <h1 className="mt-2 text-xl font-bold">{context?.onlineIntent ? "Recebendo entregas" : "Você está pausado"}</h1>
              <p className="mt-1 max-w-[17rem] text-xs leading-5 text-carbon-foreground/48">{context?.onlineIntent ? "Mantenha a conexão ativa para receber novas atribuições." : "Fique online quando estiver pronto para receber entregas."}</p>
            </div>
            <Button size="sm" variant={context?.onlineIntent ? "outline" : "brand"} className={cn("shrink-0", context?.onlineIntent && "border-white/15 bg-white/[0.03] text-white hover:bg-white/8 hover:text-white")} onClick={handleToggleOnline} disabled={setOnline.isPending || setOffline.isPending || !isOnline} loading={setOnline.isPending || setOffline.isPending} loadingLabel="Atualizando disponibilidade">
              {context?.onlineIntent ? "Pausar" : "Ficar online"}
            </Button>
          </div>
        </section>

        {pendingAssignment ? (
          <section className="rise-in">
            <Card className="overflow-hidden border-warning/30 bg-warning-soft shadow-e2">
              <div className="flex items-center justify-between bg-warning px-4 py-2.5 text-warning-foreground">
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em]"><AlertTriangle className="size-4" /> Nova entrega</span>
                <span className="text-xs font-black">#{pendingAssignment.orderNumber}</span>
              </div>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Retirada</p><p className="mt-1 text-xl font-bold">{context?.storeName}</p></div>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-background/70 text-warning"><Navigation className="size-5" /></span>
                </div>
                {pendingAssignment.neighborhood ? <div className="mt-4 flex items-center gap-2 rounded-xl border border-warning/15 bg-background/55 px-3.5 py-3 text-sm"><MapPin className="size-4 shrink-0 text-warning" /><span>Destino: <strong>{pendingAssignment.neighborhood}</strong></span></div> : null}
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Button variant="outline" size="touch" onClick={() => setDeclineOpen(true)} disabled={decline.isPending || accept.isPending || !isOnline}>Recusar</Button>
                  <Button variant="brand" size="touch" onClick={handleAccept} disabled={accept.isPending || decline.isPending || !isOnline} loading={accept.isPending} loadingLabel="Aceitando entrega">Aceitar</Button>
                </div>
              </CardContent>
            </Card>
          </section>
        ) : null}

        {activeDelivery ? (
          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground"><Bike className="size-4 text-brand" /> Entrega em curso</h2><Badge variant="brandSoft">{activeDelivery.status.replace("_", " ")}</Badge></div>
            <Card className="overflow-hidden border-brand/20 shadow-e2">
              <CardContent className="p-0">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="text-xs text-muted-foreground">Pedido</p><p className="mt-1 text-3xl font-black tracking-tight text-brand">#{activeDelivery.orderNumber}</p></div>
                    <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Em andamento</p><p className="mt-1 flex items-center justify-end gap-1.5 text-sm font-semibold"><Clock className="size-3.5 text-brand" />{relativeTime(activeDelivery.assignedAt)}</p></div>
                  </div>
                  <div className="mt-5 flex items-start gap-3 rounded-xl bg-surface-muted p-4"><MapPin className="mt-0.5 size-5 shrink-0 text-brand" /><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Destino</p><p className="mt-1 text-sm font-semibold">{activeDelivery.neighborhood || "Endereço disponível no painel da entrega"}</p></div></div>
                </div>
                <div className="border-t border-border bg-surface-muted/55 p-3"><Button asChild className="w-full" size="touch" variant="brand"><Link to="/app/entregador/entrega">Abrir painel da entrega <ChevronRight className="size-5" /></Link></Button></div>
              </CardContent>
            </Card>
          </section>
        ) : null}

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground"><CheckCircle2 className="size-4 text-success" /> Entregas concluídas</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-success/15 bg-success-soft"><CardContent className="p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-success">Hoje</p><p className="mt-2 text-3xl font-black tabular-nums text-success">{deliveryCounter.data?.today ?? 0}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Este mês</p><p className="mt-2 text-3xl font-black tabular-nums">{deliveryCounter.data?.currentMonth ?? 0}</p></CardContent></Card>
          </div>
        </section>

        {!activeDelivery && !pendingAssignment ? (
          <section className="rounded-2xl border border-dashed border-border bg-background/55 px-5 py-10 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-soft-foreground"><Bike className="size-6" /></div>
            <p className="mt-4 font-semibold">Nenhuma entrega agora</p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Quando uma nova entrega for atribuída a você, ela aparecerá aqui com prioridade.</p>
          </section>
        ) : null}

        <div className="flex items-center justify-between rounded-xl border border-border bg-background/70 px-3.5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          <span className="flex items-center gap-2">{isOnline ? <Wifi className="size-3.5 text-success" /> : <WifiOff className="size-3.5 text-danger" />}{isOnline ? "Conectado" : "Sem internet"}</span>
          <span>v{context?.version || 1}</span>
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-border/80 bg-background/94 px-8 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_32px_-24px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <Link to="/app/entregador" className="flex flex-col items-center gap-1.5 rounded-xl py-1.5 text-brand"><Bike className="size-5" /><span className="text-[10px] font-bold">Início</span></Link>
        <Link to="/app/entregador/historico" className="flex flex-col items-center gap-1.5 rounded-xl py-1.5 text-muted-foreground transition-colors hover:text-brand"><History className="size-5" /><span className="text-[10px] font-bold">Histórico</span></Link>
        <button type="button" onClick={() => void signOut("local").then(() => navigate({ to: "/entrar/entregador" }))} className="flex flex-col items-center gap-1.5 rounded-xl py-1.5 text-muted-foreground transition-colors hover:text-danger"><User className="size-5" /><span className="text-[10px] font-bold">Conta</span></button>
      </nav>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recusar esta entrega?</DialogTitle><DialogDescription>A entrega voltará para o fluxo operacional da loja. Confirme apenas se você realmente não puder realizá-la.</DialogDescription></DialogHeader>
          <div className="flex items-start gap-3 rounded-xl bg-info-soft p-3.5 text-sm text-info"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><span>A ação usa uma chave de idempotência para evitar recusas duplicadas.</span></div>
          <DialogFooter><Button variant="outline" onClick={() => setDeclineOpen(false)}>Voltar</Button><Button variant="destructive" onClick={handleDeclineConfirm} disabled={!isOnline || decline.isPending} loading={decline.isPending} loadingLabel="Recusando entrega">Confirmar recusa</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
