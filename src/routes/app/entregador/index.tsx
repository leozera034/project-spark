import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bike,
  MapPin,
  Clock,
  CheckCircle2,
  History,
  Power,
  ChevronRight,
  User,
  AlertTriangle,
  RefreshCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/kitchen/useKitchenOrders";
import { useEffect } from "react";
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
import { PresenceBadge, ConnectivityChip } from "@/components/courier/PresenceBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/entregador/")({
  component: CourierDashboard,
});

function CourierDashboard() {
  const { authContext, signOut } = useAuth();
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();

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

  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  useEffect(() => {
    if (!context?.onlineIntent || !isOnline) return;

    const interval = window.setInterval(() => {
      heartbeat.mutate();
    }, 120000);

    return () => window.clearInterval(interval);
  }, [context?.onlineIntent, heartbeat, isOnline]);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background p-4 space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-dvh bg-background p-4">
        <ErrorState
          title="Erro ao carregar painel"
          description="Não foi possível sincronizar seus dados operacionais."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const presence = derivePresence(
    context?.onlineIntent ?? false,
    context?.lastSeenAt ?? null,
    context?.serverNow,
  );

  const activeDelivery = context?.activeDelivery;
  const pendingAssignment = context?.pendingAssignment;

  const handleToggleOnline = () => {
    if (context?.onlineIntent) {
      setOffline.mutate();
    } else {
      setOnline.mutate();
    }
  };

  const handleAccept = async () => {
    if (!pendingAssignment) return;
    try {
      await accept.mutateAsync({
        deliveryId: pendingAssignment.deliveryId,
        expectedVersion: pendingAssignment.version,
        idempotencyKey: crypto.randomUUID(),
      });
    } catch {
      // O hook centraliza a mensagem de erro para o entregador.
    }
  };

  const openDecline = () => {
    setDeclineReason("");
    setDeclineOpen(true);
  };

  const confirmDecline = async () => {
    if (!pendingAssignment) return;
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
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-sm font-bold leading-tight">{authContext?.full_name}</h1>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                  {PRESENCE_LABEL[presence]}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isRefetching && <RefreshCcw className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sair"
              onClick={() =>
                signOut("local").then(() => navigate({ to: "/entrar/entregador" }))
              }
            >
              <Power className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <PresenceBadge presence={presence} />
          <ConnectivityChip isOnline={isOnline} />
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-6 p-4">
        <CourierAlerts />

        <Card
          className={cn(
            "border-2 transition-colors",
            context?.onlineIntent ? "border-success/30 bg-success-soft/40" : "border-border",
          )}
        >
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase text-muted-foreground">Sua disponibilidade</p>
              <p className="text-sm font-semibold">
                {context?.onlineIntent ? "Recebendo novas entregas" : "Pausado / offline"}
              </p>
            </div>
            <Button
              size="lg"
              variant={context?.onlineIntent ? "outline" : "brand"}
              onClick={handleToggleOnline}
              disabled={setOnline.isPending || setOffline.isPending || !isOnline}
              className="h-12 min-w-[132px] px-4 text-xs font-black"
            >
              {context?.onlineIntent ? "FICAR OFFLINE" : "FICAR ONLINE"}
            </Button>
          </CardContent>
        </Card>

        {pendingAssignment && (
          <section
            className="animate-in fade-in slide-in-from-top-4 duration-500 motion-reduce:animate-none"
            aria-live="assertive"
          >
            <Card className="overflow-hidden border-warning/40 bg-warning-soft shadow-xl">
              <div className="flex items-center justify-between bg-warning px-4 py-2 text-warning-foreground">
                <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                  <AlertTriangle className="h-4 w-4" /> Nova entrega disponível
                </span>
                <span className="text-[10px] font-bold">#{pendingAssignment.orderNumber}</span>
              </div>
              <CardContent className="space-y-4 p-4">
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground">Loja</p>
                  <p className="font-display text-xl font-black">{context?.storeName}</p>
                  {pendingAssignment.neighborhood && (
                    <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>Para: {pendingAssignment.neighborhood}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="h-14 border-warning/40 font-bold text-warning-foreground"
                    onClick={openDecline}
                    disabled={decline.isPending || accept.isPending}
                  >
                    RECUSAR
                  </Button>
                  <Button
                    variant="brand"
                    className="h-14 font-black"
                    onClick={handleAccept}
                    disabled={accept.isPending || decline.isPending}
                  >
                    ACEITAR
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" /> Suas entregas concluídas
          </h2>
          <Card className="overflow-hidden border-none bg-success text-success-foreground shadow-md">
            <CardContent className="flex items-center justify-between p-4">
              <div className="space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Hoje</p>
                <p className="text-3xl font-black">{deliveryCounter.data?.today ?? 0}</p>
              </div>
              <div className="h-10 w-px bg-current opacity-20" />
              <div className="space-y-0.5 text-right">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Este mês</p>
                <p className="text-xl font-bold">{deliveryCounter.data?.currentMonth ?? 0}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {activeDelivery && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground">
              <Bike className="h-4 w-4" /> Entrega em curso
            </h2>
            <Card className="border-brand/30 shadow-lg">
              <CardContent className="p-0">
                <div className="space-y-4 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-2xl font-black text-brand">#{activeDelivery.orderNumber}</p>
                      <Badge
                        variant="outline"
                        className="mt-1 border-brand/30 bg-brand-soft text-[10px] font-bold uppercase text-brand"
                      >
                        {activeDelivery.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Iniciada</p>
                      <p className="flex items-center justify-end gap-1 text-sm font-bold text-success">
                        <Clock className="h-3 w-3" /> {relativeTime(activeDelivery.assignedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground">Destino</p>
                      <p className="text-sm font-medium leading-snug">
                        {activeDelivery.neighborhood || "Endereço em anexo"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t bg-surface-muted p-3">
                  <Button asChild className="h-16 w-full text-lg font-black shadow-md" variant="brand">
                    <Link to="/app/entregador/entrega">
                      ABRIR PAINEL DE ENTREGA
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {!activeDelivery && !pendingAssignment && (
          <div className="space-y-3 py-12 text-center text-muted-foreground">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted">
              <Bike className="h-8 w-8" />
            </div>
            <p className="text-sm font-medium">Nenhuma entrega no momento</p>
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg bg-surface-muted p-3 text-[10px] font-bold uppercase text-muted-foreground">
          <span>Versão do painel</span>
          <span>v{context?.version || 1}</span>
        </div>
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-20 flex h-16 items-center justify-around border-t border-border bg-surface px-6"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <Link to="/app/entregador" className="flex min-h-11 flex-col items-center justify-center gap-1 text-brand">
          <Bike className="h-6 w-6" />
          <span className="text-[10px] font-bold">Início</span>
        </Link>
        <Link
          to="/app/entregador/historico"
          className="flex min-h-11 flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-brand"
        >
          <History className="h-6 w-6" />
          <span className="text-[10px] font-bold">Histórico</span>
        </Link>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex min-h-11 flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-destructive"
        >
          <User className="h-6 w-6" />
          <span className="text-[10px] font-bold">Sair</span>
        </button>
      </nav>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="max-w-[90vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>Recusar esta entrega?</DialogTitle>
            <DialogDescription>Você pode informar o motivo (opcional).</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="decline-reason" className="text-xs font-bold uppercase text-muted-foreground">
              Motivo (opcional)
            </Label>
            <Textarea
              id="decline-reason"
              placeholder="Ex: muito longe, sem combustível..."
              value={declineReason}
              onChange={(event) => setDeclineReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeclineOpen(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={confirmDecline} disabled={decline.isPending}>
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
