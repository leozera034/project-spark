import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  ChevronRight,
  Clock3,
  History,
  MapPin,
  Power,
  RefreshCcw,
  Signal,
  User,
  WifiOff,
} from "lucide-react";

import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useOnlineStatus } from "@/kitchen/useKitchenOrders";
import {
  useAcceptDeliveryAssignment,
  useCourierHeartbeat,
  useDeclineDeliveryAssignment,
  useMyCourierOperationalContext,
  useSetCourierOffline,
  useSetCourierOnline,
} from "@/store/couriers/hooks/useCouriers";
import { useMyCourierDeliveryCounter } from "@/courier/reports/courier-counter.queries";
import { derivePresence, PRESENCE_LABEL, relativeTime } from "@/store/couriers/courier.formatters";
import { CourierAlerts } from "@/notifications/courier/CourierAlerts";
import { PresenceBadge, ConnectivityChip } from "@/components/courier/PresenceBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/entregador/")({ component: CourierDashboard });

const STATUS_COPY: Record<string, { title: string; next: string }> = {
  aceita: { title: "Vá até a loja", next: "Ao chegar, confirme no painel da entrega." },
  chegou_na_loja: { title: "Aguardando coleta", next: "Confira o pedido e confirme a retirada." },
  coletada: { title: "Pedido coletado", next: "Inicie a rota para o cliente." },
  em_rota: { title: "A caminho do cliente", next: "Entregue o pedido e finalize somente após a entrega." },
  concluida: { title: "Entrega concluída", next: "Você já pode receber uma nova corrida." },
};

function CourierDashboard() {
  const { authContext, signOut } = useAuth();
  const connected = useOnlineStatus();
  const navigate = useNavigate();
  const { data: context, isLoading, isError, refetch, isRefetching } = useMyCourierOperationalContext();
  const setOnline = useSetCourierOnline();
  const setOffline = useSetCourierOffline();
  const heartbeat = useCourierHeartbeat();
  const accept = useAcceptDeliveryAssignment();
  const decline = useDeclineDeliveryAssignment();
  const counter = useMyCourierDeliveryCounter();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  useEffect(() => {
    if (!context?.onlineIntent || !connected) return;
    const id = window.setInterval(() => heartbeat.mutate(), 120000);
    return () => window.clearInterval(id);
  }, [context?.onlineIntent, connected, heartbeat]);

  if (isLoading) {
    return <div className="min-h-dvh space-y-4 bg-background p-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /><Skeleton className="h-72 w-full" /></div>;
  }

  if (isError) {
    return <div className="min-h-dvh bg-background p-4"><ErrorState title="Não foi possível abrir sua operação" description="Verifique sua conexão e tente novamente." onRetry={() => refetch()} /></div>;
  }

  const presence = derivePresence(context?.onlineIntent ?? false, context?.lastSeenAt ?? null, context?.serverNow);
  const active = context?.activeDelivery;
  const offer = context?.pendingAssignment;
  const mission = active ? STATUS_COPY[active.status] ?? { title: "Entrega em andamento", next: "Abra a entrega para ver a próxima ação." } : null;

  async function handleAccept() {
    if (!offer) return;
    try {
      await accept.mutateAsync({ deliveryId: offer.deliveryId, expectedVersion: offer.version, idempotencyKey: crypto.randomUUID() });
    } catch {}
  }

  async function confirmDecline() {
    if (!offer) return;
    try {
      await decline.mutateAsync({ deliveryId: offer.deliveryId, expectedVersion: offer.version, reasonCode: "other", idempotencyKey: crypto.randomUUID() });
      setDeclineOpen(false);
    } catch {}
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-brand">Comandiva Entregas</p>
            <h1 className="truncate font-display text-lg font-black">{authContext?.full_name ?? "Entregador"}</h1>
          </div>
          <div className="flex items-center gap-2">
            {isRefetching ? <RefreshCcw className="size-4 animate-spin text-muted-foreground" /> : null}
            <Button variant="ghost" size="icon" aria-label="Sair" onClick={() => void signOut("local").then(() => navigate({ to: "/entrar/entregador" }))}><Power className="size-5" /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <CourierAlerts />

        {!connected ? (
          <div role="alert" className="flex gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
            <WifiOff className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div><p className="font-bold">Sem conexão</p><p className="mt-1 text-sm text-muted-foreground">Você não recebe novas corridas enquanto estiver desconectado.</p></div>
          </div>
        ) : null}

        <section className="rounded-[26px] border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Disponibilidade</p>
              <div className="mt-2 flex flex-wrap items-center gap-2"><PresenceBadge presence={presence} /><ConnectivityChip isOnline={connected} /></div>
              <p className="mt-3 text-sm text-muted-foreground">{context?.onlineIntent ? "Você está visível para receber novas entregas." : "Ative quando estiver pronto para trabalhar."}</p>
            </div>
            <div className={`grid size-12 shrink-0 place-items-center rounded-2xl ${context?.onlineIntent ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}><Signal className="size-6" /></div>
          </div>
          <Button className="mt-4 h-14 w-full text-base font-black" variant={context?.onlineIntent ? "outline" : "brand"} disabled={!connected || setOnline.isPending || setOffline.isPending} onClick={() => context?.onlineIntent ? setOffline.mutate() : setOnline.mutate()}>
            {context?.onlineIntent ? "PAUSAR NOVAS ENTREGAS" : "COMEÇAR A RECEBER ENTREGAS"}
          </Button>
        </section>

        {offer ? (
          <section aria-live="assertive" className="overflow-hidden rounded-[26px] border-2 border-warning/50 bg-warning-soft shadow-xl">
            <div className="flex items-center justify-between bg-warning px-4 py-3 text-warning-foreground">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest"><AlertTriangle className="size-4" /> Nova corrida</span>
              <span className="font-mono text-xs font-black">#{offer.orderNumber}</span>
            </div>
            <div className="space-y-4 p-4">
              <div><p className="text-xs font-bold uppercase text-muted-foreground">Coleta</p><p className="mt-1 text-xl font-black">{context?.storeName}</p></div>
              <div className="flex items-center gap-2 rounded-xl bg-background/70 p-3"><MapPin className="size-5 text-brand" /><div><p className="text-[10px] font-bold uppercase text-muted-foreground">Destino</p><p className="font-bold">{offer.neighborhood || "Endereço disponível após aceitar"}</p></div></div>
              <div className="grid grid-cols-2 gap-3"><Button variant="outline" className="h-14 font-black" onClick={() => { setDeclineReason(""); setDeclineOpen(true); }} disabled={accept.isPending || decline.isPending}>RECUSAR</Button><Button variant="brand" className="h-14 font-black" onClick={handleAccept} disabled={accept.isPending || decline.isPending}>ACEITAR CORRIDA</Button></div>
            </div>
          </section>
        ) : null}

        {active ? (
          <section className="rounded-[28px] border-2 border-brand/25 bg-card shadow-lg">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Missão atual</p><p className="mt-1 text-3xl font-black text-brand">#{active.orderNumber}</p></div><Badge variant="outline" className="border-brand/25 bg-brand-soft font-bold">{active.status.replaceAll("_", " ")}</Badge></div>
              <div className="mt-5 rounded-2xl bg-brand-soft p-4"><p className="font-display text-lg font-black">{mission?.title}</p><p className="mt-1 text-sm text-muted-foreground">{mission?.next}</p></div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl border border-border p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Destino</p><p className="mt-1 font-bold">{active.neighborhood || "Ver endereço"}</p></div><div className="rounded-xl border border-border p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Aceita há</p><p className="mt-1 flex items-center gap-1 font-bold"><Clock3 className="size-4" /> {relativeTime(active.assignedAt)}</p></div></div>
            </div>
            <div className="border-t border-border p-3"><Button asChild variant="brand" className="h-16 w-full text-lg font-black"><Link to="/app/entregador/entrega">CONTINUAR ENTREGA <ChevronRight className="ml-2 size-5" /></Link></Button></div>
          </section>
        ) : null}

        {!active && !offer ? (
          <section className="rounded-[26px] border border-dashed border-border p-8 text-center"><div className="mx-auto grid size-16 place-items-center rounded-full bg-muted"><Bike className="size-8" /></div><h2 className="mt-4 font-display text-lg font-black">Nenhuma entrega agora</h2><p className="mt-1 text-sm text-muted-foreground">{context?.onlineIntent ? "Você está disponível. A próxima oferta aparecerá aqui automaticamente." : "Fique online quando quiser começar."}</p></section>
        ) : null}

        <section className="grid grid-cols-2 gap-3">
          <Card><CardContent className="p-4"><CheckCircle2 className="size-5 text-success" /><p className="mt-3 text-3xl font-black">{counter.data?.today ?? 0}</p><p className="text-xs font-bold uppercase text-muted-foreground">Entregas hoje</p></CardContent></Card>
          <Card><CardContent className="p-4"><History className="size-5 text-brand" /><p className="mt-3 text-3xl font-black">{counter.data?.currentMonth ?? 0}</p><p className="text-xs font-bold uppercase text-muted-foreground">Neste mês</p></CardContent></Card>
        </section>

        <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sincronização operacional · {PRESENCE_LABEL[presence]} · v{context?.version || 1}</p>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/95 backdrop-blur-xl" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <Link to="/app/entregador" className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-brand"><Bike className="size-5" /><span className="text-[10px] font-bold">Operação</span></Link>
        <Link to="/app/entregador/historico" className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-muted-foreground"><History className="size-5" /><span className="text-[10px] font-bold">Histórico</span></Link>
        <button type="button" onClick={() => void signOut()} className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-muted-foreground"><User className="size-5" /><span className="text-[10px] font-bold">Sair</span></button>
      </nav>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="max-w-[92vw] rounded-2xl"><DialogHeader><DialogTitle>Recusar esta corrida?</DialogTitle><DialogDescription>A entrega volta para a fila. Informe o motivo se quiser.</DialogDescription></DialogHeader><div className="space-y-2 py-2"><Label htmlFor="decline-reason">Motivo</Label><Textarea id="decline-reason" placeholder="Ex.: distância, veículo, indisponibilidade..." value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} /></div><DialogFooter><Button variant="ghost" onClick={() => setDeclineOpen(false)}>Voltar</Button><Button variant="destructive" onClick={confirmDecline} disabled={decline.isPending}>Confirmar recusa</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
