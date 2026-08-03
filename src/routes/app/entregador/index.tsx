import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
  Wifi,
  WifiOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/kitchen/useKitchenOrders";
import { useEffect, useState } from "react";
import { 
  useMyCourierOperationalContext, 
  useSetCourierOnline, 
  useSetCourierOffline,
  useCourierHeartbeat,
  useAcceptDeliveryAssignment,
  useDeclineDeliveryAssignment
} from "@/store/couriers/hooks/useCouriers";
import { useMyCourierDeliveryCounter } from "@/courier/reports/courier-counter.queries";
import { derivePresence, PRESENCE_LABEL, relativeTime } from "@/store/couriers/courier.formatters";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CourierAlerts } from "@/notifications/courier/CourierAlerts";


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
    isRefetching
  } = useMyCourierOperationalContext();

  const setOnline = useSetCourierOnline();
  const setOffline = useSetCourierOffline();
  const heartbeat = useCourierHeartbeat();
  const accept = useAcceptDeliveryAssignment();
  const decline = useDeclineDeliveryAssignment();

  // Heartbeat a cada 2 minutos se estiver online
  useEffect(() => {
    if (context?.onlineIntent && isOnline) {
      const interval = setInterval(() => {
        heartbeat.mutate(undefined as any);
      }, 120000);
      return () => clearInterval(interval);
    }
  }, [context?.onlineIntent, isOnline]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
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
    context?.serverNow
  );

  const activeDelivery = context?.activeDelivery;
  const pendingAssignment = context?.pendingAssignment;

  const handleToggleOnline = () => {
    if (context?.onlineIntent) {
      setOffline.mutate(undefined as any);
    } else {
      setOnline.mutate(undefined as any);
    }
  };

  const handleAccept = async () => {
    if (!pendingAssignment) return;
    try {
      await accept.mutateAsync({
        deliveryId: pendingAssignment.deliveryId,
        expectedVersion: pendingAssignment.version,
        idempotencyKey: crypto.randomUUID()
      });
    } catch (e) {
      // Erro tratado no hook
    }
  };

  const handleDecline = async () => {
    if (!pendingAssignment) return;
    const reason = window.prompt("Por que deseja recusar esta entrega? (Opcional)");
    if (reason === null) return; // Cancelou o prompt
    
    try {
      await decline.mutateAsync({
        deliveryId: pendingAssignment.deliveryId,
        expectedVersion: pendingAssignment.version,
        reasonCode: "other", // Simplificado para o MVP
        idempotencyKey: crypto.randomUUID()
      });
    } catch (e) {
      // Erro tratado no hook
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header Compacto Mobile-First */}
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand/10 flex items-center justify-center text-brand">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight">{authContext?.full_name}</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={cn(
                "h-2 w-2 rounded-full", 
                presence === "online" ? "bg-emerald-500" : 
                presence === "sem_sinal" ? "bg-amber-500 animate-pulse" : "bg-slate-300"
              )} />
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">
                {PRESENCE_LABEL[presence]}
              </span>
              {!isOnline && (
                <Badge variant="destructive" className="h-4 px-1 text-[8px] animate-pulse">OFFLINE</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRefetching && <RefreshCcw className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Button variant="ghost" size="icon" onClick={() => signOut("local").then(() => navigate({ to: "/entrar/entregador" }))}>
            <Power className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-6 max-w-lg mx-auto">
        <CourierAlerts />
        {/* Status de Disponibilidade */}
        <Card className={cn(
          "border-2 transition-colors",
          context?.onlineIntent ? "border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10" : "border-slate-200"
        )}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase opacity-60">Sua Disponibilidade</p>
              <p className="font-semibold text-sm">
                {context?.onlineIntent ? "Recebendo novas entregas" : "Pausado / Offline"}
              </p>
            </div>
            <Button 
              size="sm"
              variant={context?.onlineIntent ? "outline" : "brand"}
              onClick={handleToggleOnline}
              disabled={setOnline.isPending || setOffline.isPending || !isOnline}
              className="h-8 px-4 text-xs font-bold"
            >
              {context?.onlineIntent ? "FICAR OFFLINE" : "FICAR ONLINE"}
            </Button>
          </CardContent>
        </Card>

        {/* Notificação de Nova Entrega (Prioridade Máxima) */}
        {pendingAssignment && (
          <section className="animate-in fade-in slide-in-from-top-4 duration-500">
            <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20 shadow-xl overflow-hidden">
              <div className="bg-amber-500 px-4 py-2 flex items-center justify-between text-white">
                <span className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Nova Entrega Disponível
                </span>
                <span className="text-[10px] font-bold">#{pendingAssignment.orderNumber}</span>
              </div>
              <CardContent className="p-4 space-y-4">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase">Loja</p>
                  <p className="font-black text-xl">{context?.storeName}</p>
                  {pendingAssignment.neighborhood && (
                    <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>Para: {pendingAssignment.neighborhood}</span>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    className="h-12 border-amber-500/30 text-amber-700 dark:text-amber-400 font-bold"
                    onClick={handleDecline}
                    disabled={decline.isPending || accept.isPending}
                  >
                    RECUSAR
                  </Button>
                  <Button 
                    variant="brand" 
                    className="h-12 bg-amber-500 hover:bg-amber-600 border-none font-black text-white"
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

        {/* Contador de Entregas (Fase 20) */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase opacity-60 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Suas Entregas Concluídas
          </h2>
          <Card className="bg-emerald-500 text-white border-none shadow-md overflow-hidden">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Hoje</p>
                <p className="text-3xl font-black">{useMyCourierDeliveryCounter().data?.today ?? 0}</p>
              </div>
              <div className="h-10 w-px bg-white/20" />
              <div className="space-y-0.5 text-right">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Este Mês</p>
                <p className="text-xl font-bold">{useMyCourierDeliveryCounter().data?.currentMonth ?? 0}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Entrega Ativa (Destaque) */}
        {activeDelivery && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase opacity-60 flex items-center gap-2">
              <Bike className="h-4 w-4" /> Entrega em Curso
            </h2>
            <Card className="shadow-lg border-brand/20 bg-gradient-to-br from-background to-brand/[0.02]">
              <CardContent className="p-0">
                <div className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-2xl font-black text-brand">#{activeDelivery.orderNumber}</p>
                      <Badge variant="outline" className="mt-1 bg-brand/5 border-brand/20 text-brand uppercase text-[10px] font-bold">
                        {activeDelivery.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Iniciada</p>
                      <p className="font-bold flex items-center justify-end gap-1 text-emerald-600 text-sm">
                        <Clock className="h-3 w-3" /> {relativeTime(activeDelivery.assignedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase">Destino</p>
                        <p className="font-medium text-sm leading-snug">
                          {activeDelivery.neighborhood || "Endereço em anexo"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-muted/30 border-t">
                  <Button asChild className="w-full h-14 text-lg font-bold shadow-md" variant="brand">
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
          <div className="py-12 text-center space-y-3 opacity-40">
            <div className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-800 mx-auto flex items-center justify-center">
              <Bike className="h-8 w-8" />
            </div>
            <p className="text-sm font-medium">Nenhuma entrega no momento</p>
          </div>
        )}

        {/* Resumo de Conectividade */}
        <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase opacity-60">
            {isOnline ? <Wifi className="h-3 w-3 text-emerald-500" /> : <WifiOff className="h-3 w-3 text-destructive" />}
            {isOnline ? "Conectado" : "Sem Internet"}
          </div>
          <div className="text-[10px] font-bold uppercase opacity-40">
            v{context?.version || 1}
          </div>
        </div>
      </main>

      {/* Navegação Inferior (Padrão App) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t h-16 flex items-center justify-around px-6 z-20">
        <Link to="/app/entregador" className="flex flex-col items-center gap-1 text-brand">
          <Bike className="h-6 w-6" />
          <span className="text-[10px] font-bold">Início</span>
        </Link>
        <Link to="/preview/entregador/historico" className="flex flex-col items-center gap-1 text-muted-foreground pointer-events-none opacity-50">
          <History className="h-6 w-6" />
          <span className="text-[10px] font-bold">Histórico</span>
        </Link>
        <Link to="/preview/entregador/configuracoes" className="flex flex-col items-center gap-1 text-muted-foreground pointer-events-none opacity-50">
          <User className="h-6 w-6" />
          <span className="text-[10px] font-bold">Perfil</span>
        </Link>
      </nav>
    </div>
  );
}
