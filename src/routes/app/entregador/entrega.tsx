import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bike,
  Car,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  Clock3,
  CreditCard,
  MapPin,
  Navigation,
  Package,
  Phone,
  RotateCcw,
  RouteIcon,
  Store,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/feedback/ErrorState";
import { DeliveryProofCompletion } from "@/components/courier/DeliveryProofCompletion";
import { cn } from "@/lib/utils";
import {
  useCompleteDeliveryReturn,
  useConfirmArrivalAtStore,
  useConfirmOrderPickup,
  useMyCourierOperationalContext,
  useReportDeliveryOccurrence,
  useStartDelivery,
  useStartDeliveryReturn,
} from "@/store/couriers/hooks/useCouriers";
import {
  COURIER_VEHICLE_LABEL,
  DELIVERY_RETURN_REASON_LABEL,
  DELIVERY_STATUS_LABEL,
  OCCURRENCE_LABEL,
  formatRouteDistance,
  formatRouteDuration,
  routeQualityLabel,
} from "@/store/couriers/courier.formatters";
import type { DeliveryReturnReason } from "@/store/couriers/courier.types";

export const Route = createFileRoute("/app/entregador/entrega")({ component: DeliveryDetail });

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function directionsUrl(destination: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function missionFor(status: string, arrivedAtStore: boolean) {
  if ((status === "aceita" || status === "atribuida") && !arrivedAtStore) return { step: "1 de 4", title: "Vá até a loja", description: "Abra a rota e confirme somente quando estiver no ponto de coleta." };
  if ((status === "aceita" || status === "atribuida") && arrivedAtStore) return { step: "2 de 4", title: "Retire o pedido", description: "Confira o pedido com a loja antes de confirmar a coleta." };
  if (status === "coletada") return { step: "3 de 4", title: "Prepare a saída", description: "Confira endereço, pagamento e troco antes de iniciar a entrega." };
  if (status === "em_rota") return { step: "4 de 4", title: "Entregue ao cliente", description: "Só conclua quando o pedido realmente tiver sido entregue." };
  if (status === "retornando_loja") return { step: "Retorno", title: "Volte para a loja", description: "A entrega falhou. O pedido continua sob sua responsabilidade até ser devolvido à loja." };
  return { step: "Em andamento", title: "Acompanhe a entrega", description: "Siga a próxima ação operacional disponível." };
}

function DeliveryDetail() {
  const navigate = useNavigate();
  const { data: context, isLoading, isError } = useMyCourierOperationalContext();
  const arriveAtStore = useConfirmArrivalAtStore();
  const pickupOrder = useConfirmOrderPickup();
  const startDelivery = useStartDelivery();
  const startReturn = useStartDeliveryReturn();
  const completeReturn = useCompleteDeliveryReturn();
  const reportOccurrence = useReportDeliveryOccurrence();

  const [occurrenceCode, setOccurrenceCode] = useState("other");
  const [occurrenceNote, setOccurrenceNote] = useState("");
  const [isOccurrenceOpen, setIsOccurrenceOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState<DeliveryReturnReason>("customer_not_found");
  const [returnNote, setReturnNote] = useState("");

  if (isLoading) {
    return <div className="min-h-dvh space-y-4 bg-background p-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const delivery = context?.activeDelivery;
  if (isError || !delivery || !context) {
    return <div className="min-h-dvh bg-background p-4"><ErrorState title="Nenhuma entrega ativa" description="Você não possui uma entrega em curso neste momento." onRetry={() => navigate({ to: "/app/entregador" })} /></div>;
  }

  const handleAction = async (mutation: UseMutationResult<unknown, unknown, { deliveryId: string; expectedVersion: number; idempotencyKey: string }>) => {
    try {
      await mutation.mutateAsync({ deliveryId: delivery.deliveryId, expectedVersion: delivery.version, idempotencyKey: crypto.randomUUID() });
    } catch {
      // O hook centraliza a mensagem de erro.
    }
  };

  const handleReportOccurrence = async () => {
    try {
      await reportOccurrence.mutateAsync({ deliveryId: delivery.deliveryId, code: occurrenceCode, note: occurrenceNote, expectedVersion: delivery.version, idempotencyKey: crypto.randomUUID() });
      setIsOccurrenceOpen(false);
      setOccurrenceNote("");
    } catch {
      // O hook centraliza a mensagem de erro.
    }
  };

  const handleStartReturn = async () => {
    try {
      await startReturn.mutateAsync({
        deliveryId: delivery.deliveryId,
        expectedVersion: delivery.version,
        reasonCode: returnReason,
        note: returnNote,
        idempotencyKey: crypto.randomUUID(),
      });
      setReturnOpen(false);
      setReturnNote("");
    } catch {
      // O hook centraliza a mensagem de erro.
    }
  };

  const handleCompleteReturn = async () => {
    try {
      await completeReturn.mutateAsync({ deliveryId: delivery.deliveryId, expectedVersion: delivery.version, idempotencyKey: crypto.randomUUID() });
      await navigate({ to: "/app/entregador" });
    } catch {
      // O hook centraliza a mensagem de erro.
    }
  };

  const status = delivery.status as string;
  const arrivedAtStore = Boolean(delivery.arrivedAtStoreAt);
  const returning = status === "retornando_loja";
  const route = delivery.route ?? null;
  const VehicleIcon = context.vehicle === "carro" ? Car : Bike;
  const mission = missionFor(status, arrivedAtStore);
  const pickupAddress = context.storePublicAddress ?? "";
  const customerAddress = delivery.customer
    ? [delivery.customer.street, delivery.customer.number, delivery.customer.neighborhood].filter(Boolean).join(", ")
    : "";
  const pickupPhase = ["atribuida", "aceita"].includes(status);
  const customerPhase = ["coletada", "em_rota"].includes(status);
  const paymentAttention = delivery.payment?.kind === "cash" || delivery.payment?.needsChange || Boolean(delivery.payment?.instructions);

  return (
    <div className="min-h-dvh bg-background pb-36">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to="/app/entregador"><ChevronLeft className="h-6 w-6" /></Link></Button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-muted-foreground">Missão atual</p>
            <h1 className="truncate font-display text-xl font-black">Pedido #{delivery.orderNumber}</h1>
          </div>
          <Badge className={cn("h-9 gap-1.5 px-3 text-xs font-black uppercase", context.vehicle === "carro" ? "bg-warning text-warning-foreground" : "bg-brand text-brand-foreground")}>
            <VehicleIcon className="h-4 w-4" /> {COURIER_VEHICLE_LABEL[context.vehicle]}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <Card className={cn("overflow-hidden shadow-md", returning ? "border-warning/50" : "border-brand/30")}>
          <CardContent className="p-0">
            <div className={cn("px-4 py-4 text-white", returning ? "bg-warning text-warning-foreground" : "bg-brand text-brand-foreground")}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-[.14em]">{mission.step}</span>
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black uppercase">{DELIVERY_STATUS_LABEL[status] || status}</span>
              </div>
              <h2 className="mt-2 text-2xl font-black">{mission.title}</h2>
              <p className="mt-1 text-sm opacity-85">{mission.description}</p>
            </div>
          </CardContent>
        </Card>

        {returning ? (
          <Card className="border-2 border-warning/40 bg-warning-soft/50 shadow-md">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><RotateCcw className="h-5 w-5 text-warning" /> Retorno obrigatório</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><p className="text-xs font-black uppercase text-muted-foreground">Motivo</p><p className="mt-1 font-bold">{DELIVERY_RETURN_REASON_LABEL[delivery.returnReasonCode || ""] || delivery.returnReasonCode || "Não informado"}</p>{delivery.returnNote ? <p className="mt-1 text-sm text-muted-foreground">{delivery.returnNote}</p> : null}</div>
              <p className="rounded-xl border border-warning/25 bg-background/70 p-3 text-sm font-semibold">Não finalize como entregue. Leve o pedido de volta para <strong>{context.storeName}</strong> e confirme a devolução somente quando chegar.</p>
              <Button variant="brand" className="h-14 w-full font-black" asChild><a href={directionsUrl(pickupAddress)} target="_blank" rel="noreferrer"><Navigation className="mr-2 h-5 w-5" /> ROTA DE VOLTA PARA A LOJA</a></Button>
            </CardContent>
          </Card>
        ) : null}

        {context.vehicle === "carro" ? (
          <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4">
            <Car className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div><p className="text-sm font-black">ENTREGA DE CARRO</p><p className="mt-0.5 text-xs text-muted-foreground">Confirme espaço, acesso e rota antes de sair. Esta corrida exige carro.</p></div>
          </div>
        ) : null}

        <Card className={cn("border-2", pickupPhase || returning ? "border-brand shadow-md" : "border-border opacity-70")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-muted-foreground"><Store className="h-4 w-4" /> Loja</CardTitle>
            {!pickupPhase && !returning ? <CheckCircle2 className="h-5 w-5 text-success" /> : <CircleDot className="h-5 w-5 text-brand" />}
          </CardHeader>
          <CardContent className="space-y-4">
            <div><p className="text-xl font-black">{context.storeName}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{pickupAddress || "Endereço da loja não informado"}</p></div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-12 font-bold" asChild><a href={`tel:${context.storePhone}`}><Phone className="mr-2 h-4 w-4" /> Ligar</a></Button>
              <Button variant="brand" className="h-12 font-black" asChild><a href={directionsUrl(pickupAddress)} target="_blank" rel="noreferrer"><Navigation className="mr-2 h-4 w-4" /> Google Maps</a></Button>
            </div>
          </CardContent>
        </Card>

        {!returning ? (
          <Card className={cn("border-2", status === "em_rota" ? "border-brand shadow-md" : "border-border", !customerPhase && "opacity-60")}>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-muted-foreground"><VehicleIcon className="h-4 w-4" /> Cliente</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {delivery.customer ? (
                <>
                  <div><p className="text-xl font-black">{delivery.customer.firstName}</p><p className="mt-1 text-base font-bold leading-5">{delivery.customer.street}, {delivery.customer.number}</p>{delivery.customer.complement ? <p className="mt-1 text-sm text-muted-foreground">Complemento: {delivery.customer.complement}</p> : null}<p className="text-sm text-muted-foreground">{delivery.customer.neighborhood}</p></div>
                  {delivery.customer.reference ? <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-soft p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><div><p className="font-black">Referência</p><p className="text-muted-foreground">{delivery.customer.reference}</p></div></div> : null}
                  {delivery.customer.notes ? <div className="rounded-xl border border-border bg-surface-muted p-3"><p className="text-[10px] font-black uppercase tracking-[.12em] text-muted-foreground">Observação</p><p className="mt-1 text-sm font-medium">{delivery.customer.notes}</p></div> : null}
                  {route ? <div className="rounded-xl border border-border bg-surface-muted p-3"><div className="flex items-center gap-5 text-sm font-black"><span className="flex items-center gap-1.5"><RouteIcon className="h-4 w-4" />{formatRouteDistance(route.distanceMeters)}</span><span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{formatRouteDuration(route.durationSeconds)}</span></div><p className="mt-1 text-xs text-muted-foreground">{routeQualityLabel(route)} · estimativa de deslocamento</p></div> : null}
                  <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="h-12 font-bold" asChild><a href={`tel:${delivery.customer.phone}`}><Phone className="mr-2 h-4 w-4" /> Ligar</a></Button><Button variant="brand" className="h-12 font-black" asChild><a href={directionsUrl(customerAddress)} target="_blank" rel="noreferrer"><Navigation className="mr-2 h-4 w-4" /> Google Maps</a></Button></div>
                </>
              ) : <p className="text-sm text-muted-foreground">Dados do cliente indisponíveis.</p>}
            </CardContent>
          </Card>
        ) : null}

        {!returning ? (
          <Card className={cn(paymentAttention && "border-warning/40 bg-warning-soft/40")}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-muted-foreground"><CreditCard className="h-4 w-4" /> Pagamento</p><span className="text-lg font-black">{money.format(delivery.payment?.orderAmount || 0)}</span></div>
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-background/70 p-3"><div><p className="text-[10px] font-bold uppercase text-muted-foreground">Forma</p><p className="mt-1 text-sm font-black">{delivery.payment?.method || "Não informado"}</p></div><div><p className="text-[10px] font-bold uppercase text-muted-foreground">Troco</p><p className="mt-1 text-sm font-black">{delivery.payment?.needsChange ? `Para ${money.format(delivery.payment.changeFor || 0)}` : "Não precisa"}</p></div></div>
              {delivery.payment?.instructions ? <div className="rounded-xl border border-warning/30 bg-warning-soft p-3"><p className="text-[10px] font-black uppercase text-warning">Atenção no pagamento</p><p className="mt-1 text-sm font-bold">{delivery.payment.instructions}</p></div> : null}
            </CardContent>
          </Card>
        ) : null}

        {(delivery.occurrences?.length ?? 0) > 0 ? <Card><CardHeader><CardTitle className="text-sm">Ocorrências</CardTitle></CardHeader><CardContent className="space-y-2">{delivery.occurrences?.map((item) => <div key={item.occurrenceId} className="rounded-xl border border-border p-3"><p className="text-sm font-black">{OCCURRENCE_LABEL[item.code] || item.code}</p>{item.note ? <p className="mt-1 text-xs text-muted-foreground">{item.note}</p> : null}</div>)}</CardContent></Card> : null}

        {!returning ? (
          <div className="grid gap-2">
            {status === "em_rota" ? <Button variant="outline" className="h-13 border-warning/40 font-black text-warning" onClick={() => setReturnOpen(true)}><RotateCcw className="mr-2 h-4 w-4" /> NÃO CONSEGUI ENTREGAR — VOLTAR À LOJA</Button> : null}
            <Dialog open={isOccurrenceOpen} onOpenChange={setIsOccurrenceOpen}>
              <DialogTrigger asChild><Button variant="outline" className="h-12 w-full gap-2 border-destructive/25 font-black text-destructive"><AlertTriangle className="h-4 w-4" /> Informar outro problema</Button></DialogTrigger>
              <DialogContent className="max-w-[92vw] rounded-2xl"><DialogHeader><DialogTitle>Informar problema</DialogTitle></DialogHeader><div className="space-y-4 py-2"><RadioGroup value={occurrenceCode} onValueChange={setOccurrenceCode}>{Object.entries(OCCURRENCE_LABEL).map(([code, label]) => <div key={code} className="flex items-center gap-2 rounded-xl border p-3"><RadioGroupItem value={code} id={`occ-${code}`} /><Label htmlFor={`occ-${code}`} className="flex-1 cursor-pointer font-semibold">{label}</Label></div>)}</RadioGroup><Textarea placeholder="Detalhes opcionais" value={occurrenceNote} onChange={(e) => setOccurrenceNote(e.target.value)} /></div><DialogFooter><Button variant="ghost" onClick={() => setIsOccurrenceOpen(false)}>Cancelar</Button><Button variant="brand" onClick={handleReportOccurrence} disabled={reportOccurrence.isPending}>Registrar</Button></DialogFooter></DialogContent>
            </Dialog>
          </div>
        ) : null}

        <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
          <DialogContent className="max-w-[92vw] rounded-2xl">
            <DialogHeader><DialogTitle>Voltar com o pedido para a loja?</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm font-semibold">Ao confirmar, esta corrida entra em <strong>retorno à loja</strong>. Ela não poderá ser finalizada como entrega normal.</div>
              <RadioGroup value={returnReason} onValueChange={(value) => setReturnReason(value as DeliveryReturnReason)}>
                {Object.entries(DELIVERY_RETURN_REASON_LABEL).map(([code, label]) => <div key={code} className="flex items-center gap-2 rounded-xl border p-3"><RadioGroupItem value={code} id={`return-${code}`} /><Label htmlFor={`return-${code}`} className="flex-1 cursor-pointer font-semibold">{label}</Label></div>)}
              </RadioGroup>
              <Textarea maxLength={300} placeholder="Detalhes opcionais para a loja" value={returnNote} onChange={(e) => setReturnNote(e.target.value)} />
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setReturnOpen(false)}>Cancelar</Button><Button variant="brand" onClick={handleStartReturn} disabled={startReturn.isPending}><RotateCcw className="mr-2 h-4 w-4" /> Iniciar retorno</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-surface/95 p-4 shadow-2xl backdrop-blur" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto max-w-lg">
          {(status === "aceita" || status === "atribuida") && !arrivedAtStore ? <Button className="h-16 w-full text-lg font-black" variant="brand" onClick={() => handleAction(arriveAtStore)} disabled={arriveAtStore.isPending}><MapPin className="mr-2 h-5 w-5" /> CHEGUEI NA LOJA</Button> : null}
          {(status === "aceita" || status === "atribuida") && arrivedAtStore ? <Button className="h-16 w-full bg-success text-lg font-black text-success-foreground hover:bg-success/90" onClick={() => handleAction(pickupOrder)} disabled={pickupOrder.isPending}><Package className="mr-2 h-5 w-5" /> COLETEI O PEDIDO</Button> : null}
          {status === "coletada" ? <Button className="h-16 w-full text-lg font-black" variant="brand" onClick={() => handleAction(startDelivery)} disabled={startDelivery.isPending}><VehicleIcon className="mr-2 h-5 w-5" /> INICIAR ENTREGA</Button> : null}
          {status === "em_rota" ? <DeliveryProofCompletion deliveryId={delivery.deliveryId} expectedVersion={delivery.version} onCompleted={() => navigate({ to: "/app/entregador" })} /> : null}
          {status === "retornando_loja" ? <Button className="h-16 w-full bg-warning text-base font-black text-warning-foreground hover:bg-warning/90" onClick={handleCompleteReturn} disabled={completeReturn.isPending}><Store className="mr-2 h-5 w-5" /> CHEGUEI À LOJA E DEVOLVI O PEDIDO</Button> : null}
        </div>
      </footer>
    </div>
  );
}
